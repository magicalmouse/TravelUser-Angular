var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');
const uuid = require('uuid/v1');
var config = require('./config');

function ListUser() {
	this.webUserId = 0;
	this.userId = '';
	this.firstName = '';
	this.lastName = '';
	this.pending = false;
	this.secretExpires = '';
	this.accounts = [];
	this.allowInvoice = 0;
	this.allowReservations = 0;
	this.allowTracking = 0;
	this.allowTripActivate = 0;
	this.allowPhoneAuth = 0;
	this.allowMobileAppAuth = 0;
	this.reservationRestrictions = 0;
	this.rootAdmin = 0;
	this.admin = 0;
}

function User() {
	this.webUserId = 0;
	this.firstName = '';
	this.lastName = '';
	this.allowInvoice = 0;
	this.allowReservations = 0;
	this.allowTracking = 0;
	this.allowTripActivate = 0;
	this.allowPhoneAuth = 0;
	this.allowMobileAppAuth = 0;
	this.reservationRestrictions = 0;
	this.rootAdmin = 0;
	this.admin = 0;
}

function Account() {
	this.custId = '';
	this.fleetId = '';
	this.fleetName = '';
	this.name = '';
}

var docClient;
var webUserId;
var rootAdmin;
var admin;
var user;
var users;
var usersOutput;
var account;
var accounts;
var gCallback;
var conn;
var zone;
var idx;
var userId;
var secret;

exports.crudUser = (event, dbConfig, callback) => {
	gCallback = callback;

	switch (event.crudAction) {
		case util.ACTION_CREATE:
			createUser(event, dbConfig);
			break;
		case util.ACTION_READ:
			readUser(event, dbConfig);
			break;
		case util.ACTION_UPDATE:
			updateUser(event, dbConfig);
			break;
		case util.ACTION_DELETE:
			deleteUser(event, dbConfig);
			break;
	}
};

createUser = (event, dbConfig) => {
	conn = new Connection(dbConfig);
	zone = event.zone;

	user = new User();
	user.firstName = event.fn ? event.fn : ' ';
	user.lastName = event.ln ? event.ln : ' ';
	user.allowReservations = event.ar ? parseInt(event.ar) : 0;
	user.allowTracking = event.at ? parseInt(event.at) : 0;
	user.allowInvoice = event.ai ? parseInt(event.ai) : 0;
	user.allowTripActivate = event.ata ? parseInt(event.ata) : 0;
	user.allowPhoneAuth = event.apa ? parseInt(event.apa) : 0;
	user.allowMobileAppAuth = event.amaa ? parseInt(event.amaa) : 0;
	user.reservationRestrictions = event.rr ? parseInt(event.rr) : 0;
	user.admin = event.adm ? parseInt(event.adm) : 0;
	userId = event.email;
	var acct = (event.acct + '').split('|');
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
		accounts = [];
		var sql = `         
            DECLARE @webUserId int
            INSERT INTO XWebUser VALUES (
                '${userId}',
                '',
                '${user.firstName}',
                '${user.lastName}',
                '',
                ${user.allowReservations},
                ${user.allowTracking},
                ${user.allowInvoice},
                ${user.allowTripActivate},
                ${user.reservationRestrictions},
                '',
                ''
            )   
            SELECT @webUserId = @@IDENTITY`;

		acct.forEach((item) => {
			var tokens = item.split(':');
			sql += `
                INSERT INTO XWebUserAccount VALUES (
                    @webUserId,
                    '${tokens[0]}',
                    '${tokens[1]}'
                )`;
		});

		sql += `
            SELECT @webUserId, NEWID()`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'SQL_REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				conn.close();
				var params = {
					TableName: 'userPermissions',
					Item: {
						applicationNbr: 1,
						userId: userId.toLowerCase(),
						zoneId: zone,
						password: ' ',
						webUserId: user.webUserId,
						firstName: user.firstName,
						lastName: user.lastName,
						allowInvoice: user.allowInvoice,
						allowReservations: user.allowReservations,
						allowTracking: user.allowTracking,
						allowTripActivate: user.allowTripActivate,
						allowPhoneAuth: user.allowPhoneAuth,
						allowMobileAppAuth: user.allowMobileAppAuth,
						reservationRestrictions: user.reservationRestrictions,
						rootAdmin: user.rootAdmin,
						admin: user.admin,
						businessPortalUser: 0,
						secret: secret,
						secretExpires: new Date().getTime() + 86400000,
					},
				};

				docClient = new AWS.DynamoDB.DocumentClient();
				docClient.put(params, (err, data) => {
					if (err) {
						gCallback(
							null,
							util.configureResponse({
								status: 'USER_DATA_ERROR',
								error: err,
							})
						);
					} else {
						var smtpConfig = {
							host: 'email-smtp.us-east-1.amazonaws.com',
							port: 587,
							secure: false,
							auth: {
								user: 'AKIARTNPUXZ6T4Q26XGM',
								pass:
									'BBpaHp0B2MmeVF+aGe7GPUau+NCF+Qpc5Y8E/WnQrWdA',
							},
						};
						var transporter = require('nodemailer').createTransport(
							smtpConfig
						);
						var mailOptions = {
							from: 'support@nts.taxi',
							subject: 'Taxi Account Portal User Activation',
							text:
								'A User Account has been created for you at the Taxi Account Portal\n\n' +
								'To activate this account, click the link below. (Link good for 24 hours after this email was sent.)\n\n' +
								`https://portal.nts.taxi/?completeRegistration=true&secret=${secret}`,
							html: `
                                    <p>A User Account has been created for you at the Taxi Account Portal</p>
                                    
                                    <p>To activate this account, click the link below. (Link good for 24 hours after this email was sent.)</p>
                                    
                                    <p><a href="https://portal.nts.taxi/?completeRegistration=true&secret=${secret}">https://portal.nts.taxi/?completeRegistration=true&secret=${secret}</a></p>`,
							to: userId,
						};

						// send email
						transporter.sendMail(mailOptions, function (err, info) {
							if (err) {
								gCallback(
									null,
									util.configureResponse({
										status: 'EMAIL_ERROR',
										error: err,
									})
								);
							} else {
								gCallback(
									null,
									util.configureResponse({
										status: 'OK',
										user: user,
									})
								);
							}
						});
					}
				});
			}
		});

		request.on('row', (columns) => {
			user.webUserId = columns[0].value;
			secret = columns[1].value;
		});

		conn.execSql(request);
	});
};

readUser = (event, dbConfig) => {
	conn = new Connection(dbConfig);
	zone = event.zone;

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
		user = new User();
		accounts = [];
		var sql = `
            SELECT wua_cu_charge_nbr, wua_fl_id
            FROM XWebUserAccount
            WHERE wua_wu_id = ${event.webUserId} AND
                ('${zone}' IN ('${util.masterZones.join(
			"','"
		)}') OR wua_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'SQL_REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				conn.close();

				var params = {
					TableName: 'userPermissions',
					ExpressionAttributeValues: {
						':z': event.zone,
						':w': parseInt(event.webUserId),
					},
					IndexName: 'webUserId-zoneId-index',
					FilterExpression: 'zoneId = :z and webUserId = :w',
				};

				docClient = new AWS.DynamoDB.DocumentClient();
				docClient.scan(params, (err, data) => {
					if (err) {
						gCallback(
							null,
							util.configureResponse({
								status: 'USER_DATA_ERROR',
								error: err,
							})
						);
					} else {
						if (data.Count == 1) {
							item = data.Items[0];
							user = {
								userId: item.userId,
								firstName: item.firstName,
								lastName: item.lastName,
								allowReservations: item.allowReservations,
								allowTracking: item.allowTracking,
								allowTripActivate: item.allowTripActivate,
								allowPhoneAuth: item.allowPhoneAuth,
								allowMobileAppAuth: item.allowMobileAppAuth,
								admin: item.admin,
								accounts: accounts,
							};
							gCallback(
								null,
								util.configureResponse({
									status: 'OK',
									user: user,
								})
							);
						} else {
							gCallback(
								null,
								util.configureResponse({ status: 'NOT_FOUND' })
							);
						}
					}
				});
			}
		});

		request.on('row', (columns) => {
			account = new Account();
			account.custId = columns[0].value;
			account.fleetId = columns[1].value;
			accounts.push(account);
		});

		conn.execSql(request);
	});
};

updateUser = (event, dbConfig) => {
	conn = new Connection(dbConfig);
	zone = event.zone;

	user = new User();
	user.webUserId = event.webUserId;
	user.firstName = event.fn ? event.fn : ' ';
	user.lastName = event.ln ? event.ln : ' ';
	user.allowReservations = event.ar ? parseInt(event.ar) : 0;
	user.allowTracking = event.at ? parseInt(event.at) : 0;
	user.allowInvoice = event.ai ? parseInt(event.ai) : 0;
	user.allowTripActivate = event.ata ? parseInt(event.ata) : 0;
	user.allowPhoneAuth = event.apa ? parseInt(event.apa) : 0;
	user.allowMobileAppAuth = event.amaa ? parseInt(event.amaa) : 0;
	user.reservationRestrictions = event.rr ? parseInt(event.rr) : 0;
	user.admin = event.adm ? parseInt(event.adm) : 0;
	var acct = (event.acct + '').split('|');

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
		accounts = [];
		var sql = `         
            UPDATE XWebUser
            SET wu_fname = '${user.firstName}',
                wu_lname = '${user.lastName}',
                wu_allow_reservations = ${user.allowReservations},
                wu_allow_tracking = ${user.allowTracking},
                wu_allow_invoice = ${user.allowInvoice},
                wu_allow_tripactivate = ${user.allowTripActivate},
                wu_reservation_restrictions = ${user.reservationRestrictions}
            WHERE wu_id = ${user.webUserId}
            
            DELETE FROM XWebUserAccount WHERE wua_wu_id = ${user.webUserId}`;

		acct.forEach((item) => {
			var tokens = item.split(':');
			sql += `
                INSERT INTO XWebUserAccount VALUES (
                    ${user.webUserId},
                    '${tokens[0]}',
                    '${tokens[1]}'
                )`;
		});

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'SQL_REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				conn.close();
				var params = {
					TableName: 'userPermissions',
					Key: { userId: event.uid, applicationNbr: 1 },
					UpdateExpression:
						'SET #fn = :fn, #ln = :ln, #ai = :ai, #ar = :ar, #at = :at, #ata = :ata, #apa = :apa, #amaa = :amaa, #rr = :rr, #a = :a',
					ExpressionAttributeNames: {
						'#fn': 'firstName',
						'#ln': 'lastName',
						'#ai': 'allowInvoice',
						'#ar': 'allowReservations',
						'#at': 'allowTracking',
						'#ata': 'allowTripActivate',
						'#apa': 'allowPhoneAuth',
						'#amaa': 'allowMobileAppAuth',
						'#rr': 'reservationRestrictions',
						'#a': 'admin',
					},
					ExpressionAttributeValues: {
						':fn': user.firstName,
						':ln': user.lastName,
						':ai': user.allowInvoice,
						':ar': user.allowReservations,
						':at': user.allowTracking,
						':ata': user.allowTripActivate,
						':apa': user.allowPhoneAuth,
						':amaa': user.allowMobileAppAuth,
						':rr': user.reservationRestrictions,
						':a': user.admin,
					},
				};

				docClient = new AWS.DynamoDB.DocumentClient();
				docClient.update(params, (err, data) => {
					if (err) {
						gCallback(
							null,
							util.configureResponse({
								status: 'USER_DATA_ERROR',
								error: err,
							})
						);
					} else {
						gCallback(
							null,
							util.configureResponse({ status: 'OK' })
						);
					}
				});
			}
		});

		request.on('row', (columns) => {
			user.webUserId = columns[0].value;
			secret = columns[1].value;
		});

		conn.execSql(request);
	});
};

deleteUser = (event, dbConfig) => {
	conn = new Connection(dbConfig);

	var params = {
		TableName: 'userPermissions',
		Key: {
			userId: event.uid,
			applicationNbr: 1,
		},
	};

	docClient = new AWS.DynamoDB.DocumentClient();
	docClient.delete(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'USER_SCAN_ERROR',
					error: err,
				})
			);
			return;
		} else {
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
				} else {
					var sql = ` 
                        DELETE FROM XWebUserAccount WHERE wua_wu_id = ${
							event.webUserId
						}
                        
                        UPDATE XWebUser SET wu_password = 'DELETED:${new Date().getTime()}' WHERE wu_id = ${
						event.webUserId
					}`;

					var request = new Request(sql, (err, rowCount, rows) => {
						if (err) {
							gCallback(
								null,
								util.configureResponse({
									status: 'SQL_REQUEST_ERROR',
									error: err,
								})
							);
							conn.close();
						} else {
							gCallback(
								null,
								util.configureResponse({ status: 'OK' })
							);
							conn.close();
						}
					});
				}

				conn.execSql(request);
			});
		}
	});
};

exports.validateUser = (event, callback) => {
	gCallback = callback;
	var params = {
		TableName: 'userPermissions',
		ExpressionAttributeValues: {
			':s': event.secret,
		},
		IndexName: 'secret-index',
		FilterExpression: 'secret = :s',
	};

	docClient = new AWS.DynamoDB.DocumentClient();
	docClient.scan(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'USER_DATA_ERROR',
					error: err,
				})
			);
		} else {
			var result = { status: '' };
			if (data.Count == 1) {
				if (new Date().getTime() <= data.Items[0].secretExpires) {
					result.status = 'OK';
					result['userId'] = data.Items[0].userId;
					result['webUserId'] = data.Items[0].webUserId;
					result['zoneId'] = data.Items[0].zoneId;
				} else {
					result.status = 'EXPIRED_TIME_ERROR';
				}
			} else {
				result.status = 'NOT_FOUND_ERROR';
			}
			gCallback(null, util.configureResponse(result));
		}
	});
};

exports.activateUser = (event, callback) => {
	var dbConfig;
	if (config.ccsiZones.includes(event.zone)) {
		dbConfig = config.ccsiConfig;
	} else if (config.bnlZones.includes(event.zone)) {
		dbConfig = config.bnlConfig;
	} else {
		callback(
			null,
			util.configureResponse({
				status: 'INPUT_ERROR',
				error: 'no valid zone submitted',
			})
		);
	}
	conn = new Connection(dbConfig);
	gCallback = callback;

	var hashed_password = require('crypto')
		.createHash('sha1')
		.update(event.password)
		.digest('hex')
		.toUpperCase();

	var params = {
		TableName: 'userPermissions',
		Key: { userId: event.userId, applicationNbr: 1 },
		UpdateExpression: 'SET #a = :x, #b = :y REMOVE secret, secretExpires',
		ExpressionAttributeNames: {
			'#a': 'password',
			'#b': 'businessPortalUser',
		},
		ExpressionAttributeValues: {
			':x': hashed_password,
			':y': 1,
		},
	};

	docClient = new AWS.DynamoDB.DocumentClient();
	docClient.update(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'USER_ACTIVATE_ERROR',
					error: err,
				})
			);
		} else {
			conn.on('connect', (err) => {
				if (err) {
					conn.close();
					gCallback(
						null,
						util.configureResponse({
							status: 'CONNECTION_ERROR',
							error: err,
						})
					);
					return;
				}
				var sql = ` 
                    UPDATE XWebUser
                        SET wu_password = '${hashed_password}'
                    WHERE wu_id = ${event.webUserId}`;
				var request = new Request(sql, (err, rowCount, rows) => {
					if (err) {
						conn.close();
						gCallback(
							null,
							util.configureResponse({
								status: 'SQL_REQUEST_ERROR',
								error: err,
							})
						);
						return;
					} else {
						conn.close();
						gCallback(
							null,
							util.configureResponse({
								status: 'OK',
								activated: true,
							})
						);
						return;
					}
				});
				conn.execSql(request);
			});
		}
	});
};

exports.getUserList = (event, dbConfig, callback) => {
	conn = new Connection(dbConfig);
	webUserId = parseInt(event.webUserId);
	gCallback = callback;
	zone = event.zone;
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
		users = [];
		var sql = `
            SELECT DISTINCT wua_wu_id
            FROM XWebUserAccount
            WHERE wua_cu_charge_nbr + ':' + wua_fl_id IN (
                    SELECT wua_cu_charge_nbr + ':' + wua_fl_id
                    FROM  XWebUserAccount
                    WHERE wua_wu_id = ${webUserId} AND
                        ('${zone}' IN ('${util.masterZones.join(
			"','"
		)}') OR wua_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))
                ) AND
                wua_wu_id <> ${webUserId}`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'SQL_REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				conn.close();
				getUserAccounts(dbConfig);
			}
		});

		request.on('row', (columns) => {
			user = new ListUser();
			user.webUserId = columns[0].value;
			users.push(user);
		});

		conn.execSql(request);
	});
};

getUserAccounts = (dbConfig) => {
	conn = new Connection(dbConfig);

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

		var webuserIds = [];
		users.forEach((user) => {
			webuserIds.push(user.webUserId);
		});
		accounts = [];
		var sql = `
            SELECT wua_wu_id, wua_cu_charge_nbr, wua_fl_id, RTRIM(Name) as name
            FROM XWebUserAccount
            INNER JOIN Customer ON wua_cu_charge_nbr = CustId AND wua_fl_id = FleetId
            WHERE wua_wu_id IN (${webuserIds.join(',')}) AND
                ('${zone}' IN ('${util.masterZones.join(
			"','"
		)}') OR wua_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))
            ORDER BY wua_fl_id, wua_cu_charge_nbr`;

		var request = new Request(sql, (err, rowCount, rows) => {
			var i;
			var j;

			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'SQL_REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				conn.close();
				for (i = 0; i < users.length; i++) {
					for (j = 0; j < accounts.length; j++) {
						if (accounts[j].webUserId == users[i].webUserId) {
							users[i].accounts.push({
								custId: accounts[j].custId,
								fleetId: accounts[j].fleetId,
								name: accounts[j].name,
							});
						}
					}
				}
				usersOutput = [];
				populateList();
			}
		});

		request.on('row', (columns) => {
			account = new Account();
			account.webUserId = columns[0].value;
			account.custId = columns[1].value;
			account.fleetId = columns[2].value;
			account.name = columns[3].value;
			accounts.push(account);
		});

		conn.execSql(request);
	});
};

populateList = () => {
	if (users.length < 1) {
		gCallback(
			null,
			util.configureResponse({ status: 'OK', users: usersOutput })
		);
		return;
	}

	user = users.shift();
	var params = {
		TableName: 'userPermissions',
		ExpressionAttributeValues: {
			':z': zone,
			':w': user.webUserId,
		},
		IndexName: 'webUserId-zoneId-index',
		FilterExpression: 'zoneId = :z and webUserId = :w',
	};

	var docClient = new AWS.DynamoDB.DocumentClient();
	docClient.scan(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'USER_DATA_ERROR',
					error: err,
				})
			);
		} else {
			if (data.Count == 1) {
				item = data.Items[0];
				user.userId = item.userId;
				user.firstName = item.firstName ? item.firstName : '';
				user.lastName = item.lastName ? item.lastName : '';
				user.pending = item.businessPortalUser == 0 ? true : false;
				user.secretExpires = item.secretExpires;
				user.allowInvoice = item.allowInvoice;
				user.allowReservations = item.allowReservations;
				user.allowTracking = item.allowTracking;
				user.allowTripActivate = item.allowTripActivate;
				user.allowPhoneAuth = item.allowPhoneAuth;
				user.allowMobileAppAuth = item.allowMobileAppAuth;
				user.reservationRestrictions = item.reservationRestrictions;
				user.admin = item.admin;
				user.rootAdmin = item.rootAdmin;
				usersOutput.push(user);
			}
			populateList();
		}
	});
};

exports.reinviteUser = (event, callback) => {
	gCallback = callback;
	var params = {
		TableName: 'userPermissions',
		Key: { userId: event.userId, applicationNbr: 1 },
	};

	docClient = new AWS.DynamoDB.DocumentClient();
	docClient.get(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'USER_DATA_ERROR',
					error: err,
				})
			);
		} else {
			if (data.Item) {
				var item = data.Item;
				var newSecret = uuid();
				var newSecretExpires = new Date().getTime() + 86400000;

				var params = {
					TableName: 'userPermissions',
					Key: { userId: event.userId, applicationNbr: 1 },
					UpdateExpression: 'SET #s = :s, #se = :se',
					ExpressionAttributeNames: {
						'#s': 'secret',
						'#se': 'secretExpires',
					},
					ExpressionAttributeValues: {
						':s': newSecret,
						':se': newSecretExpires,
					},
				};

				docClient = new AWS.DynamoDB.DocumentClient();
				docClient.update(params, (err, data) => {
					if (err) {
						gCallback(
							null,
							util.configureResponse({
								status: 'USER_DATA_ERROR',
								error: err,
							})
						);
					} else {
						// gCallback(null, util.configureResponse( {status: 'OK'} ));
						var smtpConfig = {
							host: 'email-smtp.us-east-1.amazonaws.com',
							port: 587,
							secure: false,
							auth: {
								user: 'AKIARTNPUXZ6T4Q26XGM',
								pass:
									'BBpaHp0B2MmeVF+aGe7GPUau+NCF+Qpc5Y8E/WnQrWdA',
							},
						};
						var transporter = require('nodemailer').createTransport(
							smtpConfig
						);

						var mailOptions = {
							from: 'support@nts.taxi',
							subject: 'Taxi Account Portal User Activation',
							text:
								'A User Account has been created for you at the Taxi Account Portal\n\n' +
								'To activate this account, click the link below. (Link good for 24 hours after this email was sent.)\n\n' +
								`https://portal.nts.taxi/?completeRegistration=true&secret=${newSecret}`,
							html: `
                                <p>A User Account has been created for you at the Taxi Account Portal</p>
                                
                                <p>To activate this account, click the link below. (Link good for 24 hours after this email was sent.)</p>
                                
                                <p><a href="https://portal.nts.taxi/?completeRegistration=true&secret=${newSecret}">https://portal.nts.taxi/?completeRegistration=true&secret=${newSecret}</a></p>`,
							to: event.userId,
						};

						// send email
						transporter.sendMail(mailOptions, function (err, info) {
							if (err) {
								gCallback(
									null,
									util.configureResponse({
										status: 'EMAIL_ERROR',
										error: err,
									})
								);
							} else {
								gCallback(
									null,
									util.configureResponse({ status: 'OK' })
								);
							}
						});
					}
				});
			} else {
				gCallback(
					null,
					util.configureResponse({ status: 'NOT_FOUND' })
				);
			}
		}
	});
};
