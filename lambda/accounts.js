var AWS = require('aws-sdk');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');

function Account() {
    this.recId = 0;
    this.attn = '';
    this.custId = '';
    this.fleetId = '';
    this.fleetName = '';
    this.name = '';
    this.phone = '';
    this.validFromTime = 0;
    this.validToTime = 0;
    this.vipTag = false;
    this.onHold = '';
}

var zone;
var token;
var webUserId;
var account;
var accounts;
var gCallback;

exports.getAccounts = (event, dbConfig, callback) => { 
    //retrieve a list of accounts that a given user is allowed to access
    var conn = new Connection(dbConfig);
    zone = event.zone;
    token = event.token.substr(event.token.length - 100);
    webUserId = event.webUserId;
    gCallback = callback;
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
        accounts = [];
        var sql = `
            SELECT RTRIM(CustID) AS cust_id, RTRIM(Name) AS name, RTRIM(Attn) as attn, RTRIM(Phone) AS phone,
                cuc_fl_id, cuc_valid_to_tm, cuc_valid_from_tm, cuc_vip_tag, RTRIM(cuc_on_hold) AS cuc_on_hold,
                fl_name
            FROM XWebUserAccount
            INNER JOIN CUSTINFO2 ON wua_cu_charge_nbr = cuc_charge_nbr AND wua_fl_id = cuc_fl_id
            INNER JOIN Customer ON wua_cu_charge_nbr = CustId AND wua_fl_id = FleetId
            INNER JOIN FLEET ON cuc_fl_id = fl_id
            WHERE wua_wu_id = ${webUserId} AND
                ('${zone}' IN ('${util.masterZones.join("','")}') OR cuc_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))`;    

        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'REQUEST_ERROR', error: err} ));
                } else {
                    if (accounts.length < 1) {
                        gCallback(null, util.configureResponse( {status: 'ACCOUNT_ERROR', error: `No accounts were found for user ${webUserId}`} ));
                        conn.close();
                        return;
                    }
                    sql = `
                        DECLARE @username varchar(50), @fname varchar(50), @lname varchar(50), @fl_id varchar(3),
                        @allow_reservations bit, @allow_tracking bit, @allow_invoices bit, @allow_tripactivate bit,
                        @reservation_restrictions bit, @download_folder varchar(200), @date datetime
                
                        SELECT @username = wu_username, @fname = wu_fname, @lname = wu_lname, @fl_id = wu_fl_id,
                            @allow_reservations = wu_allow_reservations, @allow_tracking = wu_allow_tracking, 
                            @allow_invoices = wu_allow_invoice, @allow_tripactivate = wu_allow_tripactivate,
                            @reservation_restrictions = wu_reservation_restrictions, @download_folder = wu_download_folder,
                            @date = DATEADD(mi, 20, GETDATE())
                        FROM XWebUser
                        WHERE wu_id = ${webUserId} AND
                            ('${zone}' IN ('${util.masterZones.join("','")}') OR wu_fl_id IN ( SELECT fld_id FROM XDispFleetSettings WHERE fld_exts_site = '${zone}' ))
                
                        exec dbo.NTS_XWebInterfaceUserInsert
                        '${token}'
                        ,@date
                        ,@username
                        ,${webUserId}
                        ,@fname
                        ,@lname
                        ,@fl_id
                        ,@allow_reservations
                        ,@allow_tracking
                        ,@allow_invoices
                        ,@allow_tripactivate
                        ,@reservation_restrictions
                        ,@download_folder`;
        
                    accounts.forEach((account) => {
                        sql += `
                            exec dbo.NTS_XWebInterfaceAccountInsert
                            '${token}'
                            ,@date
                            ,'${account.attn}'
                            ,'${account.onHold}'
                            ,${account.validFromTime}
                            ,${account.validToTime}
                            ,'${account.vipTag}'
                            ,'${account.custId}'
                            ,'${account.fleetId}'
                            ,'${(account.name + '').replace("'","''")}'
                            ,'${account.phone}'
                            ,${webUserId}`
                    });
        
                    var request = new Request(
                        sql,
                        (err, rowCount, rows) => {
                            if (err) {
                                gCallback(null, util.configureResponse( {status: 'OK', accounts: accounts, error: err} ));
                                conn.close();
                            } else {
                                gCallback(null, util.configureResponse( {status: 'OK', accounts: accounts} ));
                                conn.close();
                            }
                    });
                
                    conn.execSql(request);
                }
        });

        request.on('row', (columns) => {
            account = new Account();
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'cust_id':
                        account.custId = column.value;
                        break;
                    case 'name':
                        account.name = column.value;
                        break;
                    case 'attn':
                        account.attn = column.value;
                        break;
                    case 'phone':
                        account.phone = column.value;
                        break;
                    case 'cuc_fl_id':
                        account.fleetId = column.value;
                        break;
                    case 'fl_name':
                        account.fleetName = column.value;
                        break;
                    case 'cuc_valid_to_tm':
                        account.validToTime = column.value;
                        break;
                    case 'cuc_valid_from_tm':
                        account.validFromTime = column.value;
                        break;
                    case 'cuc_vip_tag':
                        account.vipTag = column.value == util.YES;
                        break;
                    case 'cuc_on_hold':
                        account.onHold = column.value;
                        break;
                }
            });
            accounts.push(account);
        });
        
        conn.execSql(request);
    });
}