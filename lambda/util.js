// sort field
exports.TRIP_SORT_DATE = 1;
exports.TRIP_SORT_LAST_NAME = 2;
exports.TRIP_SORT_FIRST_NAME = 3;
exports.TRIP_SORT_PKUP_STR_NBR = 4;
exports.TRIP_SORT_PKUP_STR_NAME = 5;
exports.TRIP_SORT_PKUP_CITY = 6;
exports.TRIP_SORT_DEST_STR_NBR = 7;
exports.TRIP_SORT_DEST_STR_NAME = 8;
exports.TRIP_SORT_DEST_CITY = 9;
exports.TRIP_SORT_PASSENGER_ID = 10;
exports.TRIP_SORT_STATUS = 11;

// sort direction
exports.SORT_DIR_ASC = 1;
exports.SORT_DIR_DESC = 2;

// system values
exports.YES = 'Y'

// database actions
exports.ACTION_CREATE = 'C';
exports.ACTION_READ = 'R';
exports.ACTION_UPDATE = 'U';
exports.ACTION_DELETE = 'D';
exports.ACTION_LIST_ADMINS = 'LADM';
exports.ACTION_LIST_ACCOUNTS = 'LACCT';

// exception codes
exports.EXCEPTION_CODE_ACTIVATE = 20;

// transaction codes
exports.TRAN_ACTION_UPDATE = 4;
exports.TRAN_ACTION_CANCEL = 7;

// status codes
exports.STATUS_UNASSIGNED = 'UNASSGND';

// system user ids
exports.WEB_USER = 9997;

// update user profile actions
exports.ACTION_UPDATE_USER_INFO = 1;
exports.ACTION_UPDATE_USER_PHOTO = 2;

//update account actions
exports.ACTION_GET_SIGNED_URL = 1;
exports.ACTION_GET_ACCOUNT_LOGO = 2;
exports.ACTION_UPDATE_ACCOUNT_LOGO = 3;
exports.ACTION_GET_ACCOUNT_INFO = 4;
exports.ACTION_UPDATE_ACCOUNT_INFO = 5;
exports.ACTION_DELETE_ACCOUNT_LOGO = 6;

// api method codes
exports.ACTION_GET_ACCOUNTS = 1;
exports.ACTION_GET_TRIPS = 2;
exports.ACTION_GET_TRIPS_TRACKING = 3;
exports.ACTION_GET_TRIP_DETAIL = 4;
exports.ACTION_GET_STATS = 5;
exports.ACTION_GET_TRIP_MAP = 6;
exports.ACTION_GET_TRIP_EVENTS = 7;
exports.ACTION_CRUD_MOBILE_AUTHS = 8;
exports.ACTION_CRUD_PHONE_AUTHS = 9;
exports.ACTION_ACTIVATE_TRIP = 10;
exports.ACTION_CANCEL_TRIP = 11;
exports.ACTION_UPDATE_TRIP_COMMENTS = 12;
exports.ACTION_GET_USER_LIST = 13;
exports.ACTION_CRUD_USER = 14;
exports.ACTION_ACCOUNT_SETUP = 15;
exports.ACTION_EXPORT_TRIP_DETAILS = 16;
exports.ACTION_ACCOUNT_PROFILE = 17;
exports.ACTION_USER_PROFILE = 18;
exports.ACTION_GET_SYSTEM_STATUS = 19;

exports.configureResponse = (body) => {
    return {
        "statusCode": 200,
        "body": JSON.stringify(body),
        "isBase64Encoded": false
    };
}

exports.masterZones = [
    'ccsi',
    'bnl',
    'asc'
]