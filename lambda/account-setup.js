var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');

function Account() {
	this.webUserId = 0;
	this.custId = '';
	this.fleetId = '';
	this.name = '';
}

function Admin(firstName, lastName, userId, webUserId) {
	this.firstName = firstName;
	this.lastName = lastName;
	this.userId = userId;
	this.webUserId = webUserId;
	this.accounts = [];
}

var gCallback;
var zone;
var account;
var accounts;
var admin;
var admins;
var conn;

exports.accountSetup = (event, dbConfig, callback) => {
	gCallback = callback;

	// if(event.requestresetpassword) {
	//     gCallback(null, util.configureResponse( {status: 'OK'}));
	//     return;
	// }

	switch (event.thisAction) {
		case util.ACTION_CREATE:
			createAdmin(event, dbConfig);
			break;
		case util.ACTION_READ:
			readAdmin(event, dbConfig);
			break;
		case util.ACTION_UPDATE:
			updateAdmin(event, dbConfig);
			break;
		case util.ACTION_DELETE:
			deleteAdmin(event, dbConfig);
			break;
		case util.ACTION_LIST_ADMINS:
			listAdmins(event, dbConfig);
			break;
		case util.ACTION_LIST_ACCOUNTS:
			listAccounts(event, dbConfig);
			break;
	}
};

var createAdmin = (event, dbConfig) => {
	//create a new, unactivated admin by adding the user to the
	//dynamodb table and the sql database
	//send an email to the provided email address
	conn = new Connection(dbConfig);
	zone = event.zone;

	admin = new Admin();
	admin.firstName = event.fn ? event.fn : ' ';
	admin.lastName = event.ln ? event.ln : ' ';
	admin.allowReservations = event.ar ? parseInt(event.ar) : 0;
	admin.allowTracking = event.at ? parseInt(event.at) : 0;
	admin.allowInvoice = event.ai ? parseInt(event.ai) : 0;
	admin.allowTripActivate = event.ata ? parseInt(event.ata) : 0;
	admin.allowPhoneAuth = event.apa ? parseInt(event.apa) : 0;
	admin.allowMobileAppAuth = event.amaa ? parseInt(event.amaa) : 0;
	admin.reservationRestrictions = event.rr ? parseInt(event.rr) : 0;
	admin.rootAdmin = 1;
	admin.admin = 0;
	var secret;
	var userId = event.email;
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
                '${admin.firstName}',
                '${admin.lastName}',
                '',
                ${admin.allowReservations},
                ${admin.allowTracking},
                ${admin.allowInvoice},
                ${admin.allowTripActivate},
                ${admin.reservationRestrictions},
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
						webUserId: admin.webUserId,
						firstName: admin.firstName,
						lastName: admin.lastName,
						allowInvoice: admin.allowInvoice,
						allowReservations: admin.allowReservations,
						allowTracking: admin.allowTracking,
						allowTripActivate: admin.allowTripActivate,
						allowPhoneAuth: admin.allowPhoneAuth,
						allowMobileAppAuth: admin.allowMobileAppAuth,
						reservationRestrictions: admin.reservationRestrictions,
						rootAdmin: admin.rootAdmin,
						admin: admin.admin,
						businessPortalUser: 0,
						secret: secret,
						secretExpires: new Date().getTime() + 259200000,
					},
				};

				var docClient = new AWS.DynamoDB.DocumentClient();
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

						//format the email
						let mailOptions;
						if (zone !== 'bnl') {
							//cssi / asc using this version
							mailOptions = formatEmail(
								userId,
								secret,
								admin.firstName
							);
						} else {
							// bnl using this version
							mailOptions = {
								from: 'support@nts.taxi',
								subject: 'Taxi Account Portal User Activation',
								text:
									'A Primary Contact Account has been created for you at the Taxi Account Portal\n\n' +
									'To activate this account, click the link below. (Link good for 24 hours after this email was sent.)\n\n' +
									`https://portal.nts.taxi/?completeRegistration=true&secret=${secret}`,
								html: `
                                    <p>A Primary Contact Account has been created for you at the Taxi Account Portal</p>
                                    
                                    <p>To activate this account, click the link below. (Link good for 24 hours after this email was sent.)</p>
                                    
                                    <p><a href="https://portal.nts.taxi/?completeRegistration=true&secret=${secret}">https://portal.nts.taxi/?completeRegistration=true&secret=${secret}</a></p>`,
								to: userId,
							};
						}
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
										admin: admin,
									})
								);
							}
						});
					}
				});
			}
		});

		request.on('row', (columns) => {
			admin.webUserId = columns[0].value;
			secret = columns[1].value;
		});

		conn.execSql(request);
	});
};

const formatEmail = (userId, secret, firstName) => {
	const html = `
    <p>Dear ${firstName},</p>

    <p>To better serve you, we have created a new business portal for our LA Yellow Cab/RideYellow accounts. It is very similar to the original business portal, but will offer you a new interface and  administration option rights. This means that you can grant employees permission to create web bookings, view trip details, activate trips, and authorize phone bookings!</p>
    
    <p>In order to get started, please follow the link below. (Link expires in 72 hours.)</p>
    
    <p><a href="https://portal.nts.taxi/?completeRegistration=true&secret=${secret}">https://portal.nts.taxi/?completeRegistration=true&secret=${secret}</a></p>
    
    <p>This will open a new screen that will allow you to set your password. Once you have saved your password, you will be prompted to log in.</p>
    
    <h4>1. All Trips</h4>
    <p>The Home Page displays statistics on all trips from the "Start Date" to the "End Date". Try changing the date range using the date picker(s). </p>
    
    <h4>2. Manage Trips</h4>
    <p>a.  The Manage Trips page can be accessed by clicking the "Manager Trips" option next to the account name in the "My Accounts" table. Here you can view trips for your account.<br/>
    b. Click the "Details", "Route" and "Events"buttons for a trip. Each of these will open a pop-up displaying information about the trip.</p>
    
    <h4>3. Manage Users</h4>
    <p>a. Click the name in the  upper right-hand corner of the screen to access the menu.<br/>
    b. Click the "Manage Users" option. <br/> <br/>
    <img alt = "Manage Users option"src = "https://s3.us-east-2.amazonaws.com/accounts.nts.taxi/assets/email/manage-users.png" style = "height: auto; display: block;" border = "0"><br/>
    c. This  page  displays the  list  of  users  and  other  Primary  Contacts  connected to your account. It is also where users can be created and edited.</p>
    
    <h4>4. Change User Information</h4>
    <p>a. Click the name in the upper right-hand corner of the screen to access the menu.<br/>
    b. Click the "Profile" option. Here you can change your first and last name and set a password of your choosing. Click the "Update" button to save your changes. <br/>
    c. You can also upload a Profile Photo by clicking the "Upload Photo" button. This will open a file selector. Once a photo is chosen, you can crop and save the photo. </p>
    <img alt = "Change user information" src = "https://s3.us-east-2.amazonaws.com/accounts.nts.taxi/assets/email/profile-photo.png" style = "width: 400px; height: auto; display: block;" border = "0">
    
    <p>We hope you enjoy the new and easy to use taxi portal! If  you have any questions, please contact your appointed account manager. <a href = "mailto:Josh@rideyellow.com">Josh@rideyellow.com</a>, <a href = "mailto:Lauren@rideyellow.com">Lauren@rideyellow.com</a>, or <a href = "mailto:Sana@rideyellow.com">Sana@rideyellow.com</a></p>
    
    <p>Thank you! </p>
    `;

	const text = `
Dear ${firstName},

To better serve you, we have created a new business portal for our LA Yellow Cab/RideYellow accounts. It is very similar to the original business portal, but will offer you a new interface and  administration option rights. This means that you can grant employees permission to create web bookings, view trip details, activate trips, and authorize phone bookings!

In order to get started, please follow the link below. (Link expires in 72 hours.)

https://portal.nts.taxi/?completeRegistration=true&secret=${secret}

This will open a new screen that will allow you to set your password. Once you have saved your password, you will be prompted to log in.


# 1. All Trips
The Home Page displays statistics on all trips from the "Start Date" to the "End Date". Try changing the date range using the date picker(s).

# 2. Manage Trips
a.  The Manage Trips page can be accessed by clicking the "Manager Trips" option next to the account name in the "My Accounts" table. Here you can view trips for your account.
b. Click the "Details", "Route" and "Events"buttons for a trip. Each of these will open a pop-up displaying information about the trip.

# 3. Manage Users
a. Click the name in the  upper right-hand corner of the screen to access the menu.
b. Click the "Manage Users" option.
c. This  page  displays the  list  of  users  and  other  Primary  Contacts  connected to your account. It is also where users can be created and edited.

# 4. Change User Information
a. Click the name in the upper right-hand corner of the screen to access the menu.
b. Click the "Profile" option. Here you can change your first and last name and set a password of your choosing. Click the "Update" button to save your changes.
c. You can also upload a Profile Photo by clicking the "Upload Photo" button. This will open a file selector. Once a photo is chosen, you can crop and save the photo.


We hope you enjoy the new and easy to use taxi portal! If  you have any questions, please contact your appointed account manager.
* Josh@rideyellow.com
* Lauren@rideyellow.com
* Sana@rideyellow.com

Thank you!

`;

	const mailOptions = {
		from: 'support@nts.taxi',
		subject:
			'Updates to your existing Taxi Portal Account with Yellow Cab/ RideYellow',
		html,
		text,
		to: userId,
	};

	return mailOptions;
};

var readAdmin = (event, dbConfig) => {
	// retrieve information on the provided admin
	//query both the dynamodb and sql databases
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
							var item = data.Items[0];
							var admin = new Admin(
								item.firstName,
								item.lastName,
								item.userId,
								item.webUserId
							);
							accounts.forEach((account) => {
								admin.accounts.push({
									custId: account.custId,
									fleetId: account.fleetId,
									name: account.name,
								});
							});
							admin.accounts = accounts;
							gCallback(
								null,
								util.configureResponse({
									status: 'OK',
									admin: admin,
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

var updateAdmin = (event, dbConfig) => {
	//update the information of the provided admin in the dynamo and sql database
	conn = new Connection(dbConfig);
	zone = event.zone;
	var secret;

	admin = new Admin();
	admin.webUserId = event.webUserId;
	admin.firstName = event.fn ? event.fn : ' ';
	admin.lastName = event.ln ? event.ln : ' ';
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
            SET wu_fname = '${admin.firstName}',
                wu_lname = '${admin.lastName}'
            WHERE wu_id = ${admin.webUserId}
            
            DELETE FROM XWebUserAccount WHERE wua_wu_id = ${admin.webUserId}`;

		acct.forEach((item) => {
			var tokens = item.split(':');
			sql += `
                INSERT INTO XWebUserAccount VALUES (
                    ${admin.webUserId},
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
					UpdateExpression: 'SET #fn = :fn, #ln = :ln',
					ExpressionAttributeNames: {
						'#fn': 'firstName',
						'#ln': 'lastName',
					},
					ExpressionAttributeValues: {
						':fn': admin.firstName,
						':ln': admin.lastName,
					},
				};

				var docClient = new AWS.DynamoDB.DocumentClient();
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
			admin.webUserId = columns[0].value;
			secret = columns[1].value;
		});

		conn.execSql(request);
	});
};

var deleteAdmin = (event, dbConfig) => {
	conn = new Connection(dbConfig);

	var params = {
		TableName: 'userPermissions',
		Key: {
			userId: event.uid,
			applicationNbr: 1,
		},
	};

	var docClient = new AWS.DynamoDB.DocumentClient();
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

var listAdmins = (event, dbConfig) => {
	//retrieve a list of all admins for a given zone
	zone = event.zone;

	var params = {
		TableName: 'userPermissions',
		ExpressionAttributeValues: {
			':z': event.zone,
			':a': 1,
		},
		IndexName: 'zoneId-rootAdmin-index',
		FilterExpression: 'zoneId = :z and rootAdmin = :a',
	};

	var docClient = new AWS.DynamoDB.DocumentClient();
	docClient.scan(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'ADMIN_DATA_ERROR',
					error: err,
				})
			);
		} else {
			if (data.Count > 0) {
				conn = new Connection(dbConfig);
				admins = [];
				data.Items.forEach((item) => {
					admins.push(
						new Admin(
							item.firstName,
							item.lastName,
							item.userId,
							item.webUserId
						)
					);
				});

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
					admins.forEach((admin) => {
						webuserIds.push(admin.webUserId);
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
							for (i = 0; i < admins.length; i++) {
								for (j = 0; j < accounts.length; j++) {
									if (
										accounts[j].webUserId ==
										admins[i].webUserId
									) {
										admins[i].accounts.push({
											custId: accounts[j].custId,
											fleetId: accounts[j].fleetId,
											name: accounts[j].name,
										});
									}
								}
							}
							admins.sort(function (a, b) {
								const nameA = a.lastName.toLowerCase(),
									nameB = b.lastName.toLowerCase();
								if (nameA < nameB) {
									return -1;
								}
								if (nameA > nameB) {
									return 1;
								}
								return 0;
							});
							gCallback(
								null,
								util.configureResponse({
									status: 'OK',
									admins: admins,
								})
							);
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
			} else {
				gCallback(
					null,
					util.configureResponse({ status: 'OK', admins: [] })
				);
				return;
			}
		}
	});
};

var listAccounts = (event, dbConfig) => {
	//retrieve a list of all accounts for a given zone
	var conn = new Connection(dbConfig);
	zone = event.zone;
	var userId = event.userId;

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
            SELECT cuc_charge_nbr, cuc_fl_id, RTRIM(Name) as name
            FROM CUSTINFO2
            INNER JOIN Customer ON cuc_charge_nbr = CustId AND cuc_fl_id = FleetId
            WHERE ('${zone}' IN ('${util.masterZones.join(
			"','"
		)}') OR cuc_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))
            ORDER BY cuc_fl_id, cuc_charge_nbr`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({
						status: 'REQUEST_ERROR',
						error: err,
					})
				);
				conn.close();
			} else {
				var results = [];
				accounts.forEach((account) => {
					results.push({
						custId: account.custId,
						fleetId: account.fleetId,
						name: account.name,
					});
				});

				results = filterAccounts(results, userId);
				// gCallback(null, util.configureResponse( {status: 'OK', accounts: results} ));
				conn.close();
			}
		});

		request.on('row', (columns) => {
			account = new Account();
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'cuc_charge_nbr':
						account.custId = column.value;
						break;
					case 'cuc_fl_id':
						account.fleetId = column.value;
						break;
					case 'name':
						account.name = column.value;
						break;
				}
			});
			accounts.push(account);
		});

		conn.execSql(request);
	});
};

var filterAccounts = (accounts, userId) => {
	var params = {
		TableName: 'userPermissions',
		ExpressionAttributeValues: {
			':uid': userId,
			':a': 2,
		},
		FilterExpression: 'applicationNbr = :a and userId = :uid',
	};

	var docClient = new AWS.DynamoDB.DocumentClient();
	docClient.scan(params, (err, data) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({ status: 'ERROR', err: err })
			);
			return;
		}
		if (data.Count == 1) {
			var item = data.Items[0];
			var fleets = item.fleets.values;
			if (fleets[0] === '*') {
				gCallback(
					null,
					util.configureResponse({ status: 'OK', accounts: accounts })
				);
				return;
			} else {
				var new_accounts = [];
				accounts.forEach((account) => {
					fleets.forEach((fleet) => {
						if (account.fleetId == fleet) {
							new_accounts.push(account);
						}
					});
				});
				new_accounts.sort((a, b) => {
					if (a.custId < b.custId) {
						return -1;
					}
					if (a.custId > b.custId) {
						return 1;
					}
					return 0;
				});
				gCallback(
					null,
					util.configureResponse({
						status: 'OK',
						accounts: new_accounts,
					})
				);
				return;
			}
		} else {
			gCallback(null, util.configureResponse({ status: 'NOT_FOUND' }));
			return;
		}
	});
};
