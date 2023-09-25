var AWS = require('aws-sdk');
var util = require('./util');
var config = require('./config');

exports.getSystemStatus = (event, callback) => {
    // returns information on the maintenance notification to be displayed when a user first logs in
    // the notification and its details can be changes in the config.js file
    var response;
    if(config.showMaintenanceNotification) {
        response = util.configureResponse( {status: 'OK', showMaintenanceNotification: true, maintenanceNotification: config.maintenanceNotification} );
    } else {
        response = util.configureResponse( {status: 'OK', showMaintenanceNotification: false} );
    }
    callback(null, response);
    return;

};
