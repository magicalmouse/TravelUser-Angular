var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var config = require('./config');
var util = require('./util');

var gCallback;
var transId;
var tripNbr;

function Trip() {
    this.tripNbr = 0;
    this.chargeNbr = '';
    this.dueDtTm = '';
    this.firstName = '';
    this.lastName = '';
    this.phone = '';
    this.pkupStrNbr = '';
    this.pkupStrName = '';
    this.pkupCity = '';
    this.destStrNbr = '';
    this.destStrName = '';
    this.destCity = '';
    this.wu_username = '';
    this.wu_fname = '';
    this.wu_lname = '';
}

function User() {
    this.wu_username = '';
    this.wu_fname = '';
    this.wu_lname = '';
}

exports.activateTrip = (event, dbConfig, callback) => {
    var conn = new Connection(dbConfig);
    gCallback = callback;
    conn.on('connect', (err) => {
        if (err) {
            gCallback(
                null,
                util.configureResponse({
                    status: 'CONNECTION_ERROR',
                    error: err,
                })
            );
            return;
        }
        var tripNbr = event.tripNbr;
        transId = 0;

        var sql = `
            DECLARE @fl_id varchar(3), @now AS datetime, @veh_nbr smallint, @dr_id int
            SELECT @fl_id = trp_fl_id, @now = GETDATE(), @veh_nbr = trp_vh_nbr, @dr_id = trp_dr_id FROM XDispTrips WHERE trp_nbr = ${tripNbr}
    
            UPDATE XDispTrips WITH (ROWLOCK) SET 
            trp_due_dt_tm = dbo.ntsGetCurrentLocalTime_ByTrip(${tripNbr}),
            trp_status = '${util.STATUS_UNASSIGNED}'
            WHERE trp_nbr = ${tripNbr}                            
                                              
            EXEC TDS_XDispTrans_Write @fl_id, ${util.TRAN_ACTION_UPDATE}, ${tripNbr}, ${tripNbr}, @now, '1900-01-01', 0,
                ${util.WEB_USER}, @veh_nbr, @dr_id, '', 0, 0, ''
                
            DECLARE @zone_nbr smallint, @desc varchar(15), @priority smallint

            SET DATEFIRST 7
            SELECT @fl_id = trp_fl_id, @zone_nbr = trp_pkup_zn_nbr, @veh_nbr = trp_vh_nbr, @dr_id = trp_dr_id, 
                @desc = exct_desc, @priority = exct_priority, @now = dbo.ntsGetCurrentLocalTime_ByTrip(${tripNbr})
            FROM XDispTrips WITH (NOLOCK)
            LEFT JOIN XDispExceptionCodes WITH (NOLOCK) ON exct_code = ${util.EXCEPTION_CODE_ACTIVATE}
            WHERE trp_nbr = ${tripNbr}

            IF @fl_id IS NOT NULL BEGIN

                INSERT INTO XDispActExcepts WITH (ROWLOCK)
                (exc_fl_id, exc_zn_nbr, exc_vh_nbr, exc_dr_id, exc_trp_nbr, exc_exct_code,
                exc_exct_desc, exc_exct_priority, exc_created_dt_tm, exc_desc, exc_resolved_dt_tm,
                exc_resolved_user_id, exc_resolved_code,exc_mads_exc_nbr) VALUES (
                @fl_id, @zone_nbr, @veh_nbr, @dr_id, ${tripNbr}, ${util.EXCEPTION_CODE_ACTIVATE}, @desc, @priority,
                @now, 'CLIENT ACTIVATED TRIP - WEB', '1900-01-01', 0,0, 0)
            
            END`;

        var request = new Request(sql, function (err, rowCount, rows) {
            if (err) {
                gCallback(
                    null,
                    util.configureResponse({ status: 'ERROR', error: err })
                );
                conn.close();
            } else {
                if (transId > 0) {
                    gCallback(null, util.configureResponse({ status: 'OK' }));
                } else {
                    gCallback(
                        null,
                        util.configureResponse({
                            status: 'ERROR',
                            error: 'Could not activate trip.',
                        })
                    );
                }
                conn.close();
            }
        });

        request.on('row', function (columns) {
            transId = columns[0].value;
        });

        // request.on('doneProc', function(rowCount, more, rows) {
        //     if (transId > 0) {
        //         gCallback(null, util.configureResponse( { status: 'OK'} ));
        //     } else {
        //         gCallback(null, util.configureResponse( {status: 'ERROR', error: 'Could not activate trip.'} ));
        //     }
        //     conn.close();
        // });

        // request.on('done', function(rowCount, more, rows) {
        //     if (transId > 0) {
        //         gCallback(null, util.configureResponse( { status: 'OK'} ));
        //     } else {
        //         gCallback(null, util.configureResponse( {status: 'ERROR', error: 'Could not activate trip.'} ));
        //     }
        //     conn.close();
        // });

        conn.execSql(request);
    });
};

exports.cancelTrip = (event, dbConfig, callback) => {
    gCallback = callback;
    let trip = new Trip();
    let createdUser = new User();
    let cancelledUser = new User();
    getTripDetails(event.tripNbr, dbConfig)
        .then((tripDetails) => {
            trip = tripDetails;
            createdUser.wu_username = trip.wu_username;
            createdUser.wu_fname = trip.wu_fname;
            createdUser.wu_lname = trip.wu_lname;
            return getCancelledUser(event.webUserId, dbConfig);
        })
        .then((user) => {
            cancelledUser = user;
            var conn = new Connection(dbConfig);
            conn.on('connect', (err) => {
                if (err) {
                    gCallback(
                        null,
                        util.configureResponse({
                            status: 'CONNECTION_ERROR',
                            error: err,
                        })
                    );
                    return;
                }
                var tripNbr = event.tripNbr;
                transId = 0;

                var sql = `
                DECLARE @fl_id varchar(3), @now AS datetime, @veh_nbr as smallint, @dr_id int
                SELECT @fl_id = trp_fl_id, @now = GETDATE(), @veh_nbr = trp_vh_nbr, @dr_id = trp_dr_id FROM XDispTrips WHERE trp_nbr = ${tripNbr}
                                                  
                EXEC TDS_XDispTrans_Write @fl_id, ${util.TRAN_ACTION_CANCEL}, ${tripNbr}, ${tripNbr}, @now, '1900-01-01', 0,
                    ${util.WEB_USER}, @veh_nbr, @dr_id, '', 0, 0, ''`;
                var request = new Request(sql, function (err, rowCount, rows) {
                    if (err) {
                        gCallback(
                            null,
                            util.configureResponse({
                                status: 'ERROR',
                                error: err,
                            })
                        );
                        conn.close();
                    } else {
                        if (transId > 0) {
                            // send email
                            conn.close();
                            sendCancelNotice(cancelledUser, createdUser, trip);
                        } else {
                            gCallback(
                                null,
                                util.configureResponse({
                                    status: 'ERROR',
                                    error: 'Could not cancel trip.',
                                })
                            );
                            conn.close();
                        }
                    }
                });

                request.on('row', function (columns) {
                    transId = columns[0].value;
                });

                conn.execSql(request);
            });
        });
};

const sendCancelNotice = (cancelledUser, createdUser, trip) => {
    if (
        (createdUser.wu_username != null &&
            createdUser.wu_username.includes('@')) ||
        (cancelledUser.wu_username != null &&
            cancelledUser.wu_username.includes('@'))
    ) {
        const to = [];
        if (
            createdUser.wu_username != null &&
            createdUser.wu_username.includes('@')
        ) {
            to.push(createdUser.wu_username);
        }
        if (
            cancelledUser.wu_username != null &&
            cancelledUser.wu_username.includes('@') &&
            createdUser.wu_username !== cancelledUser.wu_username
        ) {
            to.push(cancelledUser.wu_username);
        }
        const smtpConfig = {
            host: 'email-smtp.us-east-1.amazonaws.com',
            port: 587,
            secure: false,
            auth: {
                user: 'AKIARTNPUXZ6T4Q26XGM',
pass: 'BBpaHp0B2MmeVF+aGe7GPUau+NCF+Qpc5Y8E/WnQrWdA',
            },
        };
        const transporter = require('nodemailer').createTransport(smtpConfig);
        const mailOptions = {
            from: 'support@nts.taxi',
            subject: 'Trip Cancel Notice',
            text: `
Trip # ${trip.tripNbr} has been cancelled.
Created By: ${formatUser(createdUser)}
Cancelled By: ${formatUser(cancelledUser)}

Trip Details:
Confirmation #: ${trip.tripNbr}
Account #: ${trip.chargeNbr}
Passenger Name: ${trip.firstName} ${trip.lastName}
Passenger Phone #: ${formatPhone(trip.phone)}
Due Pickup Time: ${displayDateTime(trip.dueDtTm)}
Pickup Address: ${addressDisplay(
                trip.pkupStrNbr,
                trip.pkupStrName,
                trip.pkupCity
            )}
Drop-Off Address: ${addressDisplay(
                trip.destStrNbr,
                trip.destStrName,
                trip.destCity
            )}
Comments: ${trip.comments}

            `,
            html: `
            <h2>Trip # ${trip.tripNbr} has been cancelled.</h2>
            <p>Created By: ${formatUser(createdUser)}</p>
            <p>Cancelled By: ${formatUser(cancelledUser)}</p>
            <br />
            <h2>Trip Details:</h2>
            <p>Confirmation #: ${trip.tripNbr}</p>
            <p>Account #: ${trip.chargeNbr}</p>
            <p>Passenger Name: ${trip.firstName} ${trip.lastName}</p>
            <p>Passenger Phone #: ${formatPhone(trip.phone)}</p>
            <p>Due Pickup Time: ${displayDateTime(trip.dueDtTm)}</p>
            <p>Pickup Address: ${addressDisplay(
                trip.pkupStrNbr,
                trip.pkupStrName,
                trip.pkupCity
            )}</p>
            <p>Drop-Off Address: ${addressDisplay(
                trip.destStrNbr,
                trip.destStrName,
                trip.destCity
            )}</p>
            <p>Comments: ${trip.comments}</p>
            `,
            to,
        };
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                gCallback(
                    null,
                    util.configureResponse({
                        status: 'EMAIL_ERROR',
                        error: err,
                    })
                );
            } else {
                gCallback(null, util.configureResponse({ status: 'OK' }));
                return;
            }
        });
    } else {
        // return
        gCallback(null, util.configureResponse({ status: 'OK' }));
        return;
    }
};

const formatUser = (user) => {
    if (user.wu_username === '' || user.wu_username == null) {
        return 'Call Center';
    } else {
        return `${user.wu_fname} ${user.wu_lname} (${user.wu_username}) via Taxi Account Portal`;
    }
};

const isWillCall = (date) => {
    return date.getUTCHours() === 23 && date.getUTCMinutes() === 47;
};

const displayDateTime = (date) => {
    if (date === '') {
        return '';
    }
    const dt = new Date(date);
    let d =
        (dt.getUTCMonth() + 1).toString().padStart(2, '0') +
        '/' +
        dt.getUTCDate().toString().padStart(2, '0') +
        '/' +
        dt.getUTCFullYear() +
        ' ';
    if (isWillCall(dt)) {
        d += '(Will Call)';
    } else {
        d +=
            getAmPmHour(dt).padStart(2, '0') +
            ':' +
            dt.getUTCMinutes().toString().padStart(2, '0') +
            ' ' +
            getAmPm(dt);
    }
    return d;
};

const getAmPmHour = (dt) => {
    const hour = dt.getUTCHours();
    if (hour === 0) {
        return '12';
    } else if (hour < 13) {
        return hour.toString();
    } else {
        return (hour - 12).toString();
    }
};

const getAmPm = (dt) => {
    if (dt.getUTCHours() < 12) {
        return 'AM';
    } else {
        return 'PM';
    }
};

const addressDisplay = (strNbr, strName, city) => {
    let addr = '';
    if (strNbr !== '' && strName !== '') {
        addr += strNbr + ' ' + strName;
    }
    if (addr !== '' && city !== '') {
        addr += ', ';
    }
    if (city !== '') {
        addr += city;
    }
    return addr;
};

const formatPhone = (input) => {
    const output = unformatPhone(input).split('');
    if (output.length === 10) {
        output.splice(3, 0, '.');
        output.splice(7, 0, '.');
    }
    return output.join('');
};

const unformatPhone = (input) => {
    const chars = input.split('');
    let output = '';
    chars.forEach((char) => {
        if (output.length < 10) {
            if (!isNaN(parseInt(char, 10))) {
                output += char;
            }
        }
    });
    return output;
};

const getCancelledUser = (userId, dbConfig) => {
    return new Promise((resolve, reject) => {
        var conn = new Connection(dbConfig);
        conn.on('connect', (err) => {
            if (err) {
                gCallback(
                    null,
                    util.configureResponse({
                        status: 'CONNECTION_ERROR',
                        error: err,
                    })
                );
                return;
            }
            let user = new User();
            var sql = `
                SELECT wu_username, wu_fname, wu_lname 
                FROM XWebUser
                WHERE wu_id = ${userId}`;
            var request = new Request(sql, function (err, rowCount, rows) {
                if (err) {
                    gCallback(
                        null,
                        util.configureResponse({ status: 'ERROR', error: err })
                    );
                    conn.close();
                } else {
                    conn.close();
                    resolve(user);
                }
            });

            request.on('row', function (columns) {
                columns.forEach((column) => {
                    switch (column.metadata.colName) {
                        case 'wu_username':
                            user.wu_username = column.value;
                            break;
                        case 'wu_fname':
                            user.wu_fname = column.value;
                            break;
                        case 'wu_lname':
                            user.wu_lname = column.value;
                            break;
                    }
                });
            });

            conn.execSql(request);
        });
    });
};

const getTripDetails = (tripNbr, dbConfig) => {
    return new Promise((resolve, reject) => {
        var conn = new Connection(dbConfig);
        conn.on('connect', (err) => {
            if (err) {
                gCallback(
                    null,
                    util.configureResponse({
                        status: 'CONNECTION_ERROR',
                        error: err,
                    })
                );
                return;
            }
            let trip = new Trip();
            var sql = `
                SELECT trp_nbr, trp_charge_nbr, trp_due_dt_tm, trp_pass_first_name, trp_pass_last_name, trp_pkup_ph_nbr, trp_general_cmnt,
                trp_pkup_str_nbr, trp_pkup_str_name, ISNULL(cPkup.city_name, '') AS pkup_city, 
                trp_dest_str_nbr, trp_dest_str_name, ISNULL(cDest.city_name, '') AS dest_city,
                wu_username, wu_fname, wu_lname
                FROM XDispTrips 
                LEFT OUTER JOIN xdispcities cPkup ON trp_pkup_city = cPkup.city_code AND trp_pkup_state = cPkup.city_state
                LEFT OUTER JOIN xdispcities cDest ON trp_dest_city = cDest.city_code AND trp_dest_state = cDest.city_state
                LEFT OUTER JOIN XWebUser ON CAST(trp_ext_charge_nbr AS int) = XWebUser.wu_id
                WHERE trp_nbr = ${tripNbr}`;
            var request = new Request(sql, function (err, rowCount, rows) {
                if (err) {
                    gCallback(
                        null,
                        util.configureResponse({ status: 'ERROR', error: err })
                    );
                    conn.close();
                } else {
                    if (trip.tripNbr < 1) {
                        trip = null;
                    }
                    conn.close();
                    resolve(trip);
                }
            });

            request.on('row', (columns) => {
                columns.forEach((column) => {
                    switch (column.metadata.colName) {
                        case 'trp_nbr':
                            trip.tripNbr = column.value;
                            break;
                        case 'trp_charge_nbr':
                            trip.chargeNbr = column.value;
                            break;
                        case 'trp_due_dt_tm':
                            trip.dueDtTm = column.value;
                            break;
                        case 'trp_pass_first_name':
                            trip.firstName = column.value;
                            break;
                        case 'trp_pass_last_name':
                            trip.lastName = column.value;
                            break;
                        case 'trp_pkup_ph_nbr':
                            trip.phone = column.value;
                            break;
                        case 'trp_general_cmnt':
                            trip.comments = column.value;
                            break;
                        case 'trp_pkup_str_nbr':
                            trip.pkupStrNbr = column.value;
                            break;
                        case 'trp_pkup_str_name':
                            trip.pkupStrName = column.value;
                            break;
                        case 'pkup_city':
                            trip.pkupCity = column.value;
                            break;
                        case 'trp_dest_str_nbr':
                            trip.destStrNbr = column.value;
                            break;
                        case 'trp_dest_str_name':
                            trip.destStrName = column.value;
                            break;
                        case 'dest_city':
                            trip.destCity = column.value;
                            break;
                        case 'wu_username':
                            trip.wu_username = column.value;
                            break;
                        case 'wu_lname':
                            trip.wu_lname = column.value;
                            break;
                        case 'wu_fname':
                            trip.wu_fname = column.value;
                            break;
                    }
                });
            });

            conn.execSql(request);
        });
    });
};

exports.updateComments = (event, dbConfig, callback) => {
    var conn = new Connection(dbConfig);
    gCallback = callback;
    conn.on('connect', (err) => {
        if (err) {
            gCallback(
                null,
                util.configureResponse({
                    status: 'CONNECTION_ERROR',
                    error: err,
                })
            );
            return;
        }

        var _tripNbr = event.tripNbr;
        var comments = event.comments;
        if (comments) {
            comments = event.comments.toString().trim();
        } else {
            gCallback(
                null,
                util.configureResponse({ status: 'OK', tripNbr: 0 })
            );
            conn.close();
            return;
        }
        if (comments.length > 255) {
            comments = comments.substr(0, 255);
        }
        tripNbr = 0;
        var sql = `
            UPDATE XDispTrips SET trp_general_cmnt = '${comments}'
            WHERE trp_nbr = ${_tripNbr}
            
            SELECT ${_tripNbr}`;
        var request = new Request(sql, function (err, rowCount, rows) {
            if (err) {
                gCallback(
                    null,
                    util.configureResponse({ status: 'ERROR', error: err })
                );
                conn.close();
            } else {
                gCallback(
                    null,
                    util.configureResponse({ status: 'OK', tripNbr: tripNbr })
                );
                conn.close();
            }
        });

        request.on('row', function (columns) {
            tripNbr = columns[0].value;
        });

        // request.on('doneProc', function(rowCount, more, rows) {
        //     gCallback(null, util.configureResponse( {status: 'OK', tripNbr: tripNbr} ));
        //     conn.close();
        // });

        // request.on('done', function(rowCount, more, rows) {
        //     gCallback(null, util.configureResponse( {status: 'OK', tripNbr: tripNbr} ));
        //     conn.close();
        // });

        conn.execSql(request);
    });
};

// exports.cancelTrip = (event, dbConfig, callback) => {
//     var conn = new Connection(dbConfig);
//     gCallback = callback;
//     conn.on('connect', (err) => {
//         if (err) {
//             gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
//             return;
//         }
//         var tripNbr = event.tripNbr;
//         transId = 0;

//         var sql = `
//             DECLARE @fl_id varchar(3), @now AS datetime, @veh_nbr as smallint, @dr_id int
//             SELECT @fl_id = trp_fl_id, @now = GETDATE(), @veh_nbr = trp_vh_nbr, @dr_id = trp_dr_id FROM XDispTrips WHERE trp_nbr = ${tripNbr}

//             EXEC TDS_XDispTrans_Write @fl_id, ${util.TRAN_ACTION_CANCEL}, ${tripNbr}, ${tripNbr}, @now, '1900-01-01', 0,
//                 ${util.WEB_USER}, @veh_nbr, @dr_id, '', 0, 0, ''`;
//         var request = new Request(
//             sql,
//             function(err, rowCount, rows) {
//                 if (err) {
//                     gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
//                     conn.close();
//                 } else {
//                     if (transId > 0) {
//                         gCallback(null, util.configureResponse( {status: 'OK'} ));
//                     } else {
//                         gCallback(null, util.configureResponse( {status: 'ERROR', error: 'Could not cancel trip.'} ));
//                     }
//                     conn.close();
//                 }
//         });

//         request.on('row', function(columns) {
//             transId = columns[0].value;
//         });

//         // request.on('doneProc', function(rowCount, more, rows) {
//         //     if (transId > 0) {
//         //         gCallback(null, util.configureResponse( {status: 'OK'} ));
//         //     } else {
//         //         gCallback(null, util.configureResponse( {status: 'ERROR', error: 'Could not cancel trip.'} ));
//         //     }
//         //     conn.close();
//         // });

//         // request.on('done', function(rowCount, more, rows) {
//         //     if (transId > 0) {
//         //         gCallback(null, util.configureResponse( {status: 'OK'} ));
//         //     } else {
//         //         gCallback(null, util.configureResponse( {status: 'ERROR', error: 'Could not cancel trip.'} ));
//         //     }
//         //     conn.close();
//         // });

//         conn.execSql(request);
//     });
// }
