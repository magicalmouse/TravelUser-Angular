var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious')
var util = require('./util');

function PhoneAuth() {
    this.recId = 0;
    this.name = '';
}

var auth;
var auths;
var gCallback;

exports.crudAuths = (event, dbConfig, callback) => {     
    var conn = new Connection(dbConfig);
    gCallback = callback;
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
        var action = event.crudAction
        if (!action) {        
            gCallback(null, util.configureResponse( {status: 'ERROR', error: "'action' parameter missing"} ));
            return;
        }    
        action = action.toString().trim().toUpperCase();
    
        auths = [];
        var chargeNbr = event.chargeNbr;
        var fleetId = event.fleetId;
        var name = event.name;
        var recId = event.recId;
    
        var sql = `
            SELECT crb_rec_id, crb_charge_nbr, crb_req_by
            FROM XDispClientReqBy
            WHERE crb_charge_nbr = '${chargeNbr}' AND crb_fl_id = '${fleetId}'
            ORDER BY crb_rec_id`;
        
        switch (action) {
            case util.ACTION_CREATE:
                sql =`
                    INSERT INTO XDispClientReqBy VALUES ('${chargeNbr}', '${fleetId}', '${name}')` + 
                    sql;
                break;
            case util.ACTION_DELETE:
                sql =`
                    DELETE FROM XDispClientReqBy WHERE crb_rec_id = ${recId}` + 
                    sql;
                break;
        }
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {                    
                    gCallback(null, util.configureResponse( {status: 'OK', phoneAuths: auths} ));
                    conn.close();
                }
        });
    
        request.on('row', (columns) => {
            auth = new PhoneAuth
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'crb_rec_id':
                        auth.recId = column.value;
                        break;
                    case 'crb_req_by':
                        auth.name = column.value;
                        break;
                }
            });
            auths.push(auth);
        });
    
        // request.on('doneProc', (rowCount, more, rows) => {
        //     gCallback(null, util.configureResponse( {status: 'OK', phoneAuths: auths} ));
        //         conn.close();
        // });
        
        // request.on('done', (rowCount, more, rows) => {
        //     gCallback(null, util.configureResponse( {status: 'OK', phoneAuths: auths} ));
        //         conn.close();           
        // });
    
        conn.execSql(request);
    });
}