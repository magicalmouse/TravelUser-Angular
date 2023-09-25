var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
var config = require('./config');
var util = require('./util');

exports.handler = function (event, context, callback) {
	var dbConfig;

	// actions that do not require authentication
	if (event.validateuser) {
		require('./crudUsers').validateUser(event, callback);
		return;
	} else if (event.activateuser) {
		require('./crudUsers').activateUser(event, callback);
		return;
	} else if (event.reinviteuser) {
		require('./crudUsers').reinviteUser(event, callback);
		return;
	} else if (event.activateadmin) {
		require('./account-setup').activateAdmin(event, callback);
		return;
	} else if (event.requestresetpassword) {
		require('./resetPassword').requestResetPassword(event, callback);
		return;
	} else if (event.resetpassword) {
		require('./resetPassword').resetPassword(event, callback);
		return;
	} else if (event.getsystemstatus) {
		require('./getSystemStatus').getSystemStatus(event, callback);
		return;
	} else if (event.sendfeedback) {
		require('./sendFeedback').sendFeedback(event, callback);
		return;
	}

	var params = {
		TableName: 'authTokens',
		ExpressionAttributeValues: {
			':t': event.token,
		},
		IndexName: 'identityToken-index',
		FilterExpression: 'identityToken = :t',
	};

	var docClient = new AWS.DynamoDB.DocumentClient();
	// make sure that the authToken has not expired and is valid before performing the following actions
	docClient.scan(params, (err, data) => {
		if (err) {
			callback(
				null,
				util.configureResponse({
					status: 'AUTHENTICATION_ERROR',
					error: err,
				})
			);
		} else {
			if (data.Items.length < 1) {
				callback(
					null,
					util.configureResponse({
						status: 'AUTHENTICATION_ERROR',
						error: 'caller not authorized to use this resource',
					})
				);
			} else {
				var now = new Date().getTime();
				if (data.Items[0].expires < now) {
					callback(
						null,
						util.configureResponse({
							status: 'AUTHENTICATION_ERROR',
							error: 'login expired',
						})
					);
				} else {
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

					// update the session expire each time an authenticated api call is made
					//the appAuthentication lambda function handles this

					updateSession(event).then(() => {
						// actions that do require authentication
						switch (parseInt(event.action)) {
							case util.ACTION_GET_ACCOUNTS:
								require('./accounts').getAccounts(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_TRIPS:
								require('./trips').getTrips(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_TRIPS_TRACKING:
								require('./tripsTracking').getTrips(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_TRIP_DETAIL:
								require('./tripDetail').getTripDetail(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_STATS:
								require('./stats').getStats(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_TRIP_MAP:
								require('./tripMap').getTripMap(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_TRIP_EVENTS:
								require('./tripEvents').getTripEvents(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_CRUD_MOBILE_AUTHS:
								require('./crudMobileAuths').crudAuths(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_CRUD_PHONE_AUTHS:
								require('./crudPhoneAuths').crudAuths(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_ACTIVATE_TRIP:
								require('./tripActions').activateTrip(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_CANCEL_TRIP:
								require('./tripActions').cancelTrip(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_UPDATE_TRIP_COMMENTS:
								require('./tripActions').updateComments(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_GET_USER_LIST:
								require('./crudUsers').getUserList(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_CRUD_USER:
								require('./crudUsers').crudUser(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_ACCOUNT_SETUP:
								require('./account-setup').accountSetup(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_EXPORT_TRIP_DETAILS:
								require('./exportTripDetails').exportTripDetails(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_USER_PROFILE:
								require('./userProfile').updateUserProfile(
									event,
									dbConfig,
									callback
								);
								break;
							case util.ACTION_ACCOUNT_PROFILE:
								require('./accountProfile').accountProfile(
									event,
									dbConfig,
									callback
								);
								break;
						}
					});
				}
			}
		}
	});
};

const updateSession = (event) => {
	const params = {
		FunctionName: 'appAuthentication',
		Payload: JSON.stringify({
			action: 5,
			application: event.application,
			userId: event.userId,
			token: event.token,
		}),
	};

	return new Promise((resolve, reject) => {
		const lambda = new AWS.Lambda({
			region: 'us-east-2',
		});
		lambda.invoke(params, (err, data) => {
			if (err) {
			}
			resolve();
		});
	});
};
