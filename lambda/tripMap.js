var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious')
var util = require('./util');
const config = require('./config');

function TripMap() {
    this.pkupLat = 0;
    this.pkupLng = 0;
    this.destLat = 0;
    this.destLng = 0;
    this.vehLat = 0;
    this.vehLng = 0;
    this.status = "";
}

var tripMap;
var gCallback;

exports.getTripMap = (event, dbConfig, callback) => {  
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
        tripMap = new TripMap();
        var tripNbr = event.tripNbr;
    
        var sql = `
            SELECT trp_pkup_lat / 1000000.0 AS pkup_lat, trp_pkup_lon / 1000000.0 AS pkup_lng,
              trp_dest_lat / 1000000.0 AS dest_lat, trp_dest_lon / 1000000.0 AS dest_lng, 
              ISNULL(vhd_pos_lat, 0) / 1000000.0 AS veh_lat, ISNULL(vhd_pos_lon, 0) / 1000000.0 AS veh_lng,
              trp_status
            FROM XDispTrips
            LEFT OUTER JOIN XDispVehicle ON trp_fl_id = vhd_fl_id and trp_vh_nbr = vhd_nbr
            WHERE trp_nbr = ${tripNbr}`;
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    if (tripMap.status !== 'ASSIGNED' && tripMap.status !== 'ONSITE' && tripMap.status !== 'PICKUP' && tripMap.status !== 'UNASSGND' && tripMap.status !== 'OFFERED') {
                        tripMap.vehLat = 0;
                        tripMap.vehLng = 0;
                    }
                    gCallback(null, util.configureResponse( {status: 'OK', tripMap: tripMap} ));
                    conn.close();
                }
        });
    
        request.on('row', (columns) => {
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'pkup_lat':
                        tripMap.pkupLat = column.value;
                        break;
                    case 'pkup_lng':
                        tripMap.pkupLng = column.value;
                        break;
                    case 'dest_lat':
                        tripMap.destLat = column.value;
                        break;
                    case 'dest_lng':
                        tripMap.destLng = column.value;
                        break;
                    case 'veh_lat':
                        tripMap.vehLat = column.value;
                        break
                    case 'veh_lng':
                        tripMap.vehLng = column.value;
                        break;
                    case 'trp_status':
                        tripMap.status = column.value;
                        break;
                }
            });
        });
    
        conn.execSql(request);
    });
}

const callArchive = (dbConfig, dbConfigArchive, event) => {
    const conn = new Connection(dbConfigArchive);
    conn.on('connect', err => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        }
        tripMap = new TripMap();
        var tripNbr = event.tripNbr;
        let data = {
            tripNbr: tripNbr
        };

        let tableName;
        let minArchiveDate = new Date(2017, 09, 01, 0, 0, 0, 0);
        if (event.tripDate <= minArchiveDate) {
            tableName = 'A2017_09';
        } else {
            const splitTripDate = event.tripDate.split('-');
            tableName = 'A'+ splitTripDate[0] + '_' + splitTripDate[1];
        }

        const sql = `
            SELECT cl_pkup_lat / 1000000.0 AS pkup_lat, cl_pkup_lon / 1000000.0 AS pkup_lng,
            cl_dest_lat / 1000000.0 AS dest_lat, cl_dest_lon / 1000000.0 AS dest_lng,
            cl_status, cl_vh_nbr, cl_fl_id
            FROM ${tableName}.dbo.CALLS
            WHERE cl_nbr = ${tripNbr}`;
        const request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    // gCallback(null, util.configureResponse( {status: 'OK', tripMap: tripMap} ));
                    callDispatchForArchiveInfo(dbConfig, data);
                    conn.close();
                }
        })

        request.on('row', (columns) => {
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'pkup_lat':
                        tripMap.pkupLat = column.value;
                        break;
                    case 'pkup_lng':
                        tripMap.pkupLng = column.value;
                        break;
                    case 'dest_lat':
                        tripMap.destLat = column.value;
                        break;
                    case 'dest_lng':
                        tripMap.destLng = column.value;
                        break;
                    case 'cl_status':
                        tripMap.status = column.value;
                        break;
                    case 'cl_vh_nbr':
                        data.cl_vh_nbr = column.value;
                        break;
                    case 'cl_fl_id':
                        data.cl_fl_id = column.value;
                        break;
                }
            });
        });
    
        conn.execSql(request);

    })
}

const callDispatchForArchiveInfo = (dbConfig, data) => {
    let fleetId = data.cl_fl_id;
    let vehicleNbr = data.cl_vh_nbr;
    const conn = new Connection(dbConfig);
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
        let sql = `
            SELECT ISNULL(vhd_pos_lat, 0) / 1000000.0 AS veh_lat, 
            ISNULL(vhd_pos_lon, 0) / 1000000.0 AS veh_lng 
            FROM XDispVehicle WHERE vhd_fl_id = '${fleetId}' AND vhd_nbr = ${vehicleNbr}
        `;

        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    if (tripMap.status !== 'ASSIGNED' && tripMap.status !== 'ONSITE' && tripMap.status !== 'PICKUP') {
                        tripMap.vehLat = 0;
                        tripMap.vehLng = 0;
                    }
                    gCallback(null, util.configureResponse( {status: 'OK', tripMap: tripMap} ));
                    conn.close();
                }
        });
    
        request.on('row', (columns) => {
            columns.forEach((column) => {
                switch (column.metadata.colName) {
                    case 'veh_lat':
                        tripMap.vehLat = column.value;
                        break;
                    case 'veh_lng':
                        tripMap.vehLng = column.value;
                        break;
                }
            });
        });
        
        conn.execSql(request);
       
    });
}