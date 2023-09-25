var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');
const uuid = require('uuid/v1');
var conn;
var config = require('./config');

var gCallback;

exports.requestResetPassword = (event, callback) => {
	//create a new secret and secret expires and update the user in the dynamodb table
	//send an email with a link for the user to reset their password
	gCallback = callback;
	var userId = event.userId;
	var secret = uuid();
	var secretExpires = new Date().getTime() + 86400000;
	var application = parseInt(event.application, 10);

	var docClient = new AWS.DynamoDB.DocumentClient();
	var params = {
		TableName: 'userPermissions',
		Key: { userId: userId, applicationNbr: application },
	};

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
				var params = {
					TableName: 'userPermissions',
					Key: { userId: userId, applicationNbr: application },
					UpdateExpression: 'SET #s = :s, #se = :se',
					ExpressionAttributeNames: {
						'#s': 'secret',
						'#se': 'secretExpires',
					},
					ExpressionAttributeValues: {
						':s': secret,
						':se': secretExpires,
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

						var mailOptions = formatMailOptions(
							application,
							userId,
							secret
						);

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
						gCallback(
							null,
							util.configureResponse({ status: 'OK' })
						);
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

exports.resetPassword = (event, callback) => {
	//update a given user's password in both the sql and dynamodb tables
	//hash the password and convert to uppercase first
	//remove the secret and the secret expires from the dynamodb table
	gCallback = callback;
	var dbConfig;
	var application = parseInt(event.application, 10);

	var hashed_password = require('crypto')
		.createHash('sha1')
		.update(event.password)
		.digest('hex')
		.toUpperCase();
	var docClient = new AWS.DynamoDB.DocumentClient();
	var params = {
		TableName: 'userPermissions',
		Key: { userId: event.userId, applicationNbr: application },
		UpdateExpression: 'SET #a = :x REMOVE secret, secretExpires',
		ExpressionAttributeNames: {
			'#a': 'password',
		},
		ExpressionAttributeValues: {
			':x': hashed_password,
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
			if (application === 1) {
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
									reset_password: true,
								})
							);
							return;
						}
					});
					conn.execSql(request);
				});
			} else {
				gCallback(
					null,
					util.configureResponse({
						status: 'OK',
						reset_password: true,
					})
				);
				return;
			}
		}
	});
};

var formatMailOptions = (application, userId, secret) => {
	var mailOptions;
	switch (application) {
		case 1:
			mailOptions = {
				from: 'support@nts.taxi',
				subject: 'Reset Taxi Account Portal Password',
				text:
					'We recieved a request to change your password.\n\n' +
					'To set a new password, click the link below. (Link good for 24 hours after this email was sent.)\n\n' +
					`https://portal.nts.taxi/?resetPassword=true&secret=${secret}\n\n` +
					`Didn't request this change? If you did not make this request, or do not want to change your password, you can ignore this email.`,
				html: `
                <p>We recieved a request to change your password. </p>
                
                <p>To set a new password, click the link below. (Link good for 24 hours after this email was sent.)</p>
                
                <p><a href="https://portal.nts.taxi/?resetPassword=true&secret=${secret}">https://portal.nts.taxi/?resetPassword=true&secret=${secret}</a></p>
                
                <p><b>Didn't request this change?</b> If you did not make this request, or do not want to change your password, you can ignore this email.</p>`,
				to: userId,
			};
			break;
		case 2:
			mailOptions = {
				from: 'support@nts.taxi',
				subject: 'Reset Accounts Password',
				text:
					'We recieved a request to change your password.\n\n' +
					'To set a new password, click the link below. (Link good for 24 hours after this email was sent.)\n\n' +
					`https://accounts.nts.taxi/?resetPassword=true&secret=${secret}\n\n` +
					`Didn't request this change? If you did not make this request, or do not want to change your password, you can ignore this email.`,
				html: `
                <p>We recieved a request to change your password. </p>
                
                <p>To set a new password, click the link below. (Link good for 24 hours after this email was sent.)</p>
                
                <p><a href="https://accounts.nts.taxi/?resetPassword=true&secret=${secret}">https://accounts.nts.taxi/?resetPassword=true&secret=${secret}</a></p>
                
                <p><b>Didn't request this change?</b> If you did not make this request, or do not want to change your password, you can ignore this email.</p>`,
				to: userId,
			};
			break;
	}
	return mailOptions;
};
