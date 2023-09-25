var userName = 'nts';
var password = 'b96cx2g84';

exports.BASE_TIME_OFFSET = 480;

// CCSi zone
exports.ccsiZones = ['ccsi', 'asc'];
exports.ccsiExceptionsWsdl = 'http://209.33.217.137/codispatch_websvcs/Exception.asmx?wsdl';
var ccsiServer = '209.33.217.137';
var ccsiDatabase = 'TDS';

exports.ccsiConfig = {
    userName: userName,
    password: password,
    server: ccsiServer,
    options: {
        database: ccsiDatabase
    }
};

exports.ccsiArchiveConfig = {
    userName: 'nts',
    password: 'b96cx2g84',
    server: '209.33.206.37'
}

// B&L zone
exports.bnlZones = ['bnl'];
exports.bnlExceptionsWsdl = 'http://12.161.48.249/codispatch_websvcs/Exception.asmx?wsdl';
var bnlServer = '12.161.48.249';
var bnlDatabase = 'BLTDS';

exports.bnlConfig = {
    userName: userName,
    password: password,
    server: bnlServer,
    options: {
        database: bnlDatabase
    }
};


// used for toggling maintenance notification that is shown on login
// and customizing the message that is displayed
exports.showMaintenanceNotification = false;
exports.maintenanceNotification = "Taxi Portal Documentation is now available. The PDF can be found by opening the side menu.";