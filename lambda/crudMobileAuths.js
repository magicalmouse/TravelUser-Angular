var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');

function MobileAuth() {
    this.recId = 0;
    this.phone = '';
    this.pin = '';
    this.active = '';
}

var auth;
var auths;
var zone;
var gCallback;
var params;
var docClient;

exports.crudAuths = (event, dbConfig, callback) => {     
    gCallback = callback;
    zone = event.zone;
    var conn = new Connection(dbConfig);
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
        var action = event.crudAction;
        if (!action) {        
            gCallback(null, util.configureResponse( {status: 'ERROR', error: "'action' parameter missing"} ));
            return;
        }    
        action = action.toString().trim().toUpperCase();

        auths = [];
        var chargeNbr = event.chargeNbr;
        var fleetId = event.fleetId;
        var phone = event.phone;
        var pin = event.pin;
        var active = event.active;
        var recId = event.recId;
        var firstName = event.firstName;
        var lastName = event.lastName;

        var sql = `
            SELECT c4mca_rec_id, c4mca_phone_nbr, c4mca_pin_nbr, c4mca_active
            FROM XDispClient4MyCabAuths
            INNER JOIN XDispFleetSettings ON c4mca_site_id = fld_exts_site
            WHERE c4mca_charge_nbr = '${chargeNbr}' AND fld_id = '${fleetId}'
            ORDER BY c4mca_rec_id`;
        
        switch (action) {
            case util.ACTION_CREATE:
                sql =`
                    DECLARE @site varchar(10)
                    SELECT @site = fld_exts_site FROM XDispFleetSettings WHERE fld_id = '${fleetId}'
                    DECLARE @name varchar(30)
                    SELECT @name = Name FROM Customer WHERE CustId = '${chargeNbr}' AND FleetId = '${fleetId}'
                    INSERT INTO XDispClient4MyCabAuths (c4mca_phone_nbr, c4mca_charge_nbr, c4mca_pin_nbr, c4mca_active, c4mca_company_name, c4mca_site_id)
                    VALUES ('${phone}', '${chargeNbr}', '${pin}', '${active}', @name, @site )` + 
                    sql;
                break;
            // case util.ACTION_UPDATE:
            //     sql =`
            //         UPDATE XDispClient4MyCabAuths SET
            //         c4mca_phone_nbr = '${phone}',
            //         c4mca_pin_nbr = '${pin}',
            //         c4mca_active = '${active}'
            //         WHERE c4mca_rec_id = ${recId}` + 
            //         sql;
            //     break;
            case util.ACTION_DELETE:
                sql =`
                    DELETE FROM XDispClient4MyCabAuths
                    WHERE c4mca_rec_id = ${recId}` + 
                    sql;
                break;
        }
        
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
                    conn.close();
                } else {                    
                    // gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: auths} ));
                    conn.close();
                    if(action == util.ACTION_DELETE) {
                        docClient = new AWS.DynamoDB.DocumentClient();
                        params = {
                            TableName : 'Portal_MobileAppAuths',
                            Key: {
                                phoneNumber: phone,
                                chargeNumber: chargeNbr
                            }
                        };
                        docClient.delete(params, (err, data) => {
                            if (err) {
                                gCallback(null, util.configureResponse( {status: 'USER_SCAN_ERROR', error: err} ));
                                return;
                            } else {
                                docClient = new AWS.DynamoDB.DocumentClient();
                                var paramKeys = [];
                                auths.forEach( (auth) => {
                                    var key = {
                                        phoneNumber: String(auth.phone),
                                        chargeNumber: String(chargeNbr)
                                    };
                                    paramKeys.push(key);
                                });
                                    
                                params = {
                                    "RequestItems" : {
                                        "Portal_MobileAppAuths" : {
                                            "Keys" : []
                                        }
                        
                                    }
                                };
                                
                                paramKeys.forEach( (key) => {
                                    params.RequestItems.Portal_MobileAppAuths.Keys.push(key);
                                });
                                docClient.batchGet(params, function(err, data) {
                                    if (err) {
                                        gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: []} ));
                                        return;
                                    } else {
                                        data.Responses.Portal_MobileAppAuths.forEach( (dynamoAuth) => {
                                            auths.forEach( (sqlAuth) => {
                                                if(dynamoAuth.phoneNumber == sqlAuth.phone) {
                                                    auths[auths.indexOf(sqlAuth)].firstName = dynamoAuth.firstName;
                                                    auths[auths.indexOf(sqlAuth)].lastName = dynamoAuth.lastName;
                                                }
                                            });
                                        });
                                        gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: auths} ));
                                        return;
                                    }
                                });
                            }
                        });
                    } else if(action == util.ACTION_CREATE) {
                        docClient = new AWS.DynamoDB.DocumentClient();
                        params = {
                            TableName : 'Portal_MobileAppAuths',
                            Item: {
                                phoneNumber: phone,
                                chargeNumber: chargeNbr,
                                firstName: firstName,
                                lastName: lastName,
                                fleetId: fleetId,
                                pin: pin.toString(),
                                status: 'ready'

                            }
                        };
                        docClient.put(params, (err, data) => {
                            if (err) {
                                gCallback(null, util.configureResponse( {status: 'USER_SCAN_ERROR', error: err} ));
                                return;
                            } else {
                                docClient = new AWS.DynamoDB.DocumentClient();
                                var paramKeys = [];
                                auths.forEach( (auth) => {
                                    var key = {
                                        phoneNumber: String(auth.phone),
                                        chargeNumber: String(chargeNbr)
                                    };
                                    paramKeys.push(key);
                                });
                                    
                                params = {
                                    "RequestItems" : {
                                        "Portal_MobileAppAuths" : {
                                            "Keys" : []
                                        }
                        
                                    }
                                };
                                
                                paramKeys.forEach( (key) => {
                                    params.RequestItems.Portal_MobileAppAuths.Keys.push(key);
                                });
                                docClient.batchGet(params, function(err, data) {
                                    if (err) {
                                        gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: []} ));
                                        return;
                                    } else {
                                        data.Responses.Portal_MobileAppAuths.forEach( (dynamoAuth) => {
                                            auths.forEach( (sqlAuth) => {
                                                if(dynamoAuth.phoneNumber == sqlAuth.phone) {
                                                    auths[auths.indexOf(sqlAuth)].firstName = dynamoAuth.firstName;
                                                    auths[auths.indexOf(sqlAuth)].lastName = dynamoAuth.lastName;
                                                }
                                            });
                                        });
                                        gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: auths} ));
                                        return;
                                    }
                                });
                            }
                        });
                    } else {
                        docClient = new AWS.DynamoDB.DocumentClient();
                        var paramKeys = [];
                        auths.forEach( (auth) => {
                            var key = {
                                phoneNumber: String(auth.phone),
                                chargeNumber: String(chargeNbr)
                            };
                            paramKeys.push(key);
                        });
                            
                        params = {
                            "RequestItems" : {
                                "Portal_MobileAppAuths" : {
                                    "Keys" : []
                                }
                
                            }
                        };
                        
                        paramKeys.forEach( (key) => {
                            params.RequestItems.Portal_MobileAppAuths.Keys.push(key);
                        });
                        docClient.batchGet(params, function(err, data) {
                            if (err) {
                                gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: []} ));
                                return;
                            } else {
                                data.Responses.Portal_MobileAppAuths.forEach( (dynamoAuth) => {
                                    auths.forEach( (sqlAuth) => {
                                        if(dynamoAuth.phoneNumber == sqlAuth.phone) {
                                            auths[auths.indexOf(sqlAuth)].firstName = dynamoAuth.firstName;
                                            auths[auths.indexOf(sqlAuth)].lastName = dynamoAuth.lastName;
                                        }
                                    });
                                });
                                gCallback(null, util.configureResponse( {status: 'OK', mobileAuths: auths} ));
                                return;
                            }
                        });
                    }
                    
                    
                }
        });

        request.on('row', (columns) => {
            auth = new MobileAuth
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'c4mca_rec_id':
                        auth.recId = column.value;
                        break;
                    case 'c4mca_phone_nbr':
                        auth.phone = column.value;
                        break;
                    case 'c4mca_pin_nbr':
                        auth.pin = column.value;
                        break;
                    case 'c4mca_active':
                        auth.active = column.value;
                        break;
                }
            });
            auths.push(auth);
        });
        conn.execSql(request);
       
    });
    
}