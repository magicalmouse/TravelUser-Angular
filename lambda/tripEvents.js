var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious')
var util = require('./util');
var eventDescs = require('./eventDescriptions.js');
const config = require('./config');

function TripEvent() {
    this.date = '';
    this.desc = '';
    this.statusDesc = '';
    this.vehNbr = 0;
}

var tripEvent;
var tripEvents;
var gCallback;

exports.getTripEvents = (event, dbConfig, callback) => {  
    gCallback = callback;
    let dbConfigArchive;
    if (dbConfig.options.database === 'TDS') {
        dbConfigArchive = config.ccsiArchiveConfig;
    } else {
        dbConfigArchive = dbConfig;
    }
    const currentDate = event.currentDate;
    const tripDate = event.tripDate;
    if (tripDate >= currentDate) {
        callDispatch(dbConfig, event);
    } else {
        callArchive(dbConfig, dbConfigArchive, event);
    }  
}

const callDispatch = (dbConfig, event) => {
    var conn = new Connection(dbConfig);
    
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
        tripEvents = [];
        var eventTypes = '';
        eventDescs.getDescriptions().forEach((item) => {
            if(eventTypes != '') {
                eventTypes += ',';
            }
            eventTypes += item.type;
        });
    
        var sql = `
            SELECT eve_dt_tm, eve_type, ISNULL(eves_desc, '') AS eves_desc, eve_vh_nbr
            FROM XDispEvents
            LEFT OUTER JOIN XDispEventStatus ON eve_status = eves_status
            WHERE eve_trp_nbr = ${event.tripNbr}
              AND eve_type IN (${eventTypes})
            ORDER BY eve_dt_tm`;
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    gCallback(null, util.configureResponse( {status: 'OK', tripEvents: tripEvents} ));
                    conn.close();
                }
        });
    
        request.on('row', (columns) => {
            tripEvent = new TripEvent();
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'eve_dt_tm':
                        tripEvent.date = column.value;
                        break;
                    case 'eve_type':
                        tripEvent.desc = eventDescs.getDescription(column.value);
                        break;
                    case 'eves_desc':
                        tripEvent.statusDesc = column.value;
                        break;
                    case 'eve_vh_nbr':
                        tripEvent.vehNbr = column.value;
                        break;
                }
            });
            tripEvents.push(tripEvent);
        });
    
        conn.execSql(request);
       
    });
}

const callArchive = (dbConfig, dbConfigArchive, event) => {
    var conn = new Connection(dbConfigArchive);
    conn.on('connect', err => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        }
        tripEvents = [];
        var eventTypes = '';
        eventDescs.getDescriptions().forEach((item) => {
            if(eventTypes != '') {
                eventTypes += ',';
            }
            eventTypes += item.type;
        });
        let data = {};

        let tableName;
        let minArchiveDate = new Date(2017, 09, 01, 0, 0, 0, 0);
        if (event.tripDate <= minArchiveDate) {
            tableName = 'A2017_09';
        } else {
            const splitTripDate = event.tripDate.split('-');
            tableName = 'A'+ splitTripDate[0] + '_' + splitTripDate[1];
        }

        const sql = `
            SELECT ev_dt_tm, ev_type, ev_vh_nbr, ev_status, ev_vh_nbr
            FROM ${tableName}.dbo.EVENTS
            WHERE ev_call_nbr = ${event.tripNbr}
              AND ev_type IN (${eventTypes})
            ORDER BY ev_dt_tm
        `;
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    callDispatchForArchiveInfo(dbConfig, data, tripEvents, 0);
                    conn.close();
                }
        });


        request.on('row', (columns) => {
            tripEvent = new TripEvent();
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'ev_dt_tm':
                        tripEvent.date = column.value;
                        break;
                    case 'ev_type':
                        tripEvent.desc = eventDescs.getDescription(column.value);
                        break;
                    case 'ev_vh_nbr':
                        tripEvent.vehNbr = column.value;
                        break;
                    case 'ev_status':
                        data.ev_status = column.value;
                        break;
                }
            });
            tripEvents.push(tripEvent);
        });
    
        conn.execSql(request);

    })
}


const callDispatchForArchiveInfo = (dbConfig, data, events, index) => {
    let max = events.length;
    if (index < events.length) {
        let status = data.ev_status;
        const conn = new Connection(dbConfig);
        conn.on('connect', (err) => {
            if (err) {
                gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
                return;
            } 
        
            let sql = `
            SELECT ISNULL(eves_desc, '') AS eves_desc
            FROM XDispEventStatus
            WHERE eves_status = ${status}`;
            var request = new Request(
                sql,
                (err, rowCount, rows) => {
                    if (err) {
                        gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                        conn.close();
                    } else {
                        callDispatchForArchiveInfo(dbConfig, data, events, index + 1);
                        // gCallback(null, util.configureResponse( {status: 'OK', tripEvents: tripEvents} ));
                        conn.close();
                    }
            });
        
            request.on('row', (columns) => {
                tripEvent = new TripEvent();
                columns.forEach((column) => {
                    switch (column.metadata.colName) {
                        case 'eves_desc':
                            events[index].statusDesc = column.value;
                            break;
                    }
                });
            });
        
            conn.execSql(request);
           
        });
        
    } else {
        gCallback(null, util.configureResponse( {status: 'OK', tripEvents: tripEvents} ));
    }
}