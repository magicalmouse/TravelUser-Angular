var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');

var gCallback;
var conn;

exports.updateUserProfile = (event, dbConfig, callback) => {
    gCallback = callback;
    switch (parseInt(event.updateAction)) {
        case util.ACTION_UPDATE_USER_INFO:
            updateUserInfo(event, dbConfig);
            break;
        case util.ACTION_UPDATE_USER_PHOTO:
            updateUserPhoto(event);
            break;
    }
};

function updateUserInfo (event, dbConfig) {

    var docClient = new AWS.DynamoDB.DocumentClient();
    var params = {};
    var sql = ``;
    var hashedCurrentPassword;
    var application = parseInt(event.application, 10);
    
    
    if(event.newPassword && event.currentPassword && event.firstName && event.lastName) {
        //check if current password matches the password in dynamo
        //if matches, create params and sql
        //else return error
        hashedCurrentPassword = require('crypto').createHash('sha1').update(event.currentPassword).digest('hex').toUpperCase();
        params = {
         TableName: 'userPermissions',
         Key: {'userId': event.userId, 'applicationNbr': application}
        };
        docClient.get(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'USER_DATA_ERROR', error: err} ));
        } else {
            if (data.Item) {
                var item = data.Item;
                if(item.password == hashedCurrentPassword) {
                    var hashedNewPassword = require('crypto').createHash('sha1').update(event.newPassword).digest('hex').toUpperCase();
                    var successResponse = util.configureResponse( {status: 'OK', firstName: event.firstName, lastName: event.lastName } );
                    params = {
                        TableName : 'userPermissions',
                        Key: { userId: event.userId, applicationNbr : application },
                        UpdateExpression: 'SET #p = :p, #fn = :fn, #ln = :ln',
                        ExpressionAttributeNames: { 
                            '#p': 'password',
                            '#fn': 'firstName',
                            '#ln': 'lastName'
                        },
                        ExpressionAttributeValues: { 
                            ':p': hashedNewPassword,
                            ':fn': event.firstName,
                            ':ln': event.lastName
                        }
                    };
                    
                    if(application === 1) {
                        sql = ` 
                        UPDATE XWebUser
                            SET wu_password = '${hashedNewPassword}',
                            wu_fname = '${event.firstName}',
                            wu_lname = '${event.lastName}'
                        WHERE wu_id = ${event.webUserId}`;
                        
                        callSQLAndDynamo(dbConfig, params, sql, successResponse);
                    } else {
                        callDynamo(params, successResponse);
                    }
                    
                    
                } else {
                    gCallback(null, util.configureResponse( {status: 'INPUT_ERROR', message: 'passwords do not match'} ));
                    return;
                }
            }
        }
        });
    } else {
        if(event.currentPassword && event.newPassword) {
            //check if current password matches the password in dynamo
            //if matches, create params and sql
            //else return error
            hashedCurrentPassword = require('crypto').createHash('sha1').update(event.currentPassword).digest('hex').toUpperCase();
            params = {
             TableName: 'userPermissions',
             Key: {'userId': event.userId, 'applicationNbr': application}
            };
            docClient.get(params, (err, data) => {
            if (err) {
                gCallback(null, util.configureResponse( {status: 'USER_DATA_ERROR', error: err} ));
            } else {
                if (data.Item) {
                    var item = data.Item;
                    if(item.password == hashedCurrentPassword) {
                        var hashedNewPassword = require('crypto').createHash('sha1').update(event.newPassword).digest('hex').toUpperCase();
                        var successResponse = util.configureResponse( {status: 'OK'} );
                        params = {
                            TableName : 'userPermissions',
                            Key: { userId: event.userId, applicationNbr : application },
                            UpdateExpression: 'SET #p = :p',
                            ExpressionAttributeNames: { 
                                '#p': 'password'
                            },
                            ExpressionAttributeValues: { 
                                ':p': hashedNewPassword
                            }
                        };
                        
                        if(application === 1) {
                            sql = ` 
                            UPDATE XWebUser
                                SET wu_password = '${hashedNewPassword}'
                            WHERE wu_id = ${event.webUserId}`;
                        
                            callSQLAndDynamo(dbConfig, params, sql, successResponse);
                        } else {
                            callDynamo(params, successResponse);
                        }
                        
                    } else {
                        gCallback(null, util.configureResponse( {status: 'INPUT_ERROR', error: 'Current password does not match what we have on record. Please try again.'} ));
                        return;
                    }
                }
            }
            });
        } else if (event.firstName && event.lastName) {
            //call databases to update first and last name
            params = {
             TableName: 'userPermissions',
             Key: {'userId': event.userId, 'applicationNbr': application}
            };
            docClient.get(params, (err, data) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'USER_DATA_ERROR', error: err} ));
                } else {
                    if (data.Item) {
                        var successResponse = util.configureResponse( {status: 'OK', firstName: event.firstName, lastName: event.lastName } );
                        params = {
                            TableName : 'userPermissions',
                            Key: { userId: event.userId, applicationNbr : application },
                            UpdateExpression: 'SET #fn = :fn, #ln = :ln',
                            ExpressionAttributeNames: { 
                                '#fn': 'firstName',
                                '#ln': 'lastName'
                            },
                            ExpressionAttributeValues: { 
                                ':fn': event.firstName,
                                ':ln': event.lastName
                            }
                        };
                        
                        if(application === 1) {
                            sql = ` 
                            UPDATE XWebUser
                                SET wu_fname = '${event.firstName}',
                                wu_lname = '${event.lastName}'
                            WHERE wu_id = ${event.webUserId}`;
                            callSQLAndDynamo(dbConfig, params, sql, successResponse);
                        } else {
                            callDynamo(params, successResponse);
                        }
                        
                        
                    }
                }
            });
            
        } else {
             gCallback(null, util.configureResponse( {status: 'INPUT_ERROR', error: 'not all of the necessary information was recieved'} ));
        }
    }
}

function updateUserPhoto (event) {
    //add the base64 string to the correct user entry in the dyanmodb table
    var base64String = event.body.base64String;
    var params = {
        TableName : 'userPermissions',
        Key: { userId: event.userId, applicationNbr : 1 },
        UpdateExpression: 'SET #p = :p',
        ExpressionAttributeNames: { 
            '#p': 'profilePhoto'
        },
        ExpressionAttributeValues: { 
            ':p': base64String
        }
    };
    var docClient = new AWS.DynamoDB.DocumentClient();
    docClient.update(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'UPDATE_PROFILE_PHOTO_ERROR', error: err} ));
        } else {
            gCallback(null, util.configureResponse({status: 'OK', test1: 'test1'}));
        }
    });
}


function callSQLAndDynamo(dbConfig, params, sql, successResponse) {
    //call the dynamo database first and on success, call the sql database
    conn = new Connection(dbConfig);
    var docClient = new AWS.DynamoDB.DocumentClient();
    docClient.update(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'UPDATE_USER_INFO_ERROR', error: err} ));
        } else {
            conn.on('connect', (err) => {
                if (err) {
                    conn.close();
                    gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
                    return;
                }
                var request = new Request(
                    sql,
                    (err, rowCount, rows) => {
                        if(err) {
                            conn.close();
                            gCallback(null, util.configureResponse( {status: 'SQL_REQUEST_ERROR', error: err} ));
                            return;
                        } else {
                            conn.close();
                            gCallback(null, successResponse);
                            return;
                        }
                });
                conn.execSql(request);
            });
        }
    });
}

function callDynamo(params, successResponse) {
    
    var docClient = new AWS.DynamoDB.DocumentClient();
    docClient.update(params, (err, data) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'UPDATE_USER_INFO_ERROR', error: err} ));
            return;
        } else {
            gCallback(null, successResponse);
            return;
        }
    });
    
}