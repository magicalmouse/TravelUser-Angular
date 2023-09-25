var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious')
var util = require('./util');

function Trip() {
    this.rowNbr = 0;
    this.tripNbr = 0;
    this.chargNbr = '';
    this.fleetId = '';
    this.dueDtTm = '';
    this.firstName = '';
    this.lastName = '';
    this.pkupStrNbr = '';
    this.pkupStrName = '';
    this.pkupCity = '';
    this.destStrNbr = '';
    this.destStrName = '';
    this.destCity = '';
}

var tripCount;
var trip;
var trips;
var gCallback;

exports.getTrips = (event, dbConfig, callback) => {     
    var conn = new Connection(dbConfig);
    gCallback = callback;
    conn.on('connect', (err) => {
        if (err) {
            gCallback(null, util.configureResponse( {status: 'CONNECTION_ERROR', error: err} ));
            return;
        } 
    
        tripCount = 0;
        trips = [];
        var sortString = "";
        var sortDirString = parseInt(event.sortDir) == util.SORT_DIR_ASC ? "" : " DESC";
        var chargeNbr = event.chargeNbr;
        var fleetId = event.fleetId;
        var pageStart = ((event.page - 1) * event.pageLength) + 1;
        var pageEnd = event.page * event.pageLength;

        switch (parseInt(event.sort)) {
            case util.TRIP_SORT_DATE:
                sortString = "trp_due_dt_tm" + sortDirString + ", trp_pass_last_name, trp_pass_first_name";
                break;
            case util.TRIP_SORT_LAST_NAME:
                sortString = "trp_pass_last_name" + sortDirString + ", trp_pass_first_name, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_FIRST_NAME:
                sortString = "trp_pass_first_name" + sortDirString + ", trp_pass_last_name, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_PKUP_STR_NBR:
                sortString = "trp_pkup_str_nbr" + sortDirString + ", trp_pkup_str_name, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_PKUP_STR_NAME:
                sortString = "trp_pkup_str_name" + sortDirString + ", trp_pkup_str_nbr, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_PKUP_CITY:
                sortString = "cPkup.city_name" + sortDirString + ", trp_due_dt_tm";
                break;
            case util.TRIP_SORT_DEST_STR_NBR:
                sortString = "trp_dest_str_nbr" + sortDirString + ", trp_dest_str_name, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_DEST_STR_NAME:
                sortString = "trp_dest_str_name" + sortDirString + ", trp_dest_str_nbr, trp_due_dt_tm";
                break;
            case util.TRIP_SORT_DEST_CITY:
                sortString = "cDest.city_name" + sortDirString + ", trp_due_dt_tm";
                break;
            default:
                sortString = "trp_due_dt_tm";
                break;
        }

        var sql = `
            DECLARE @fleets as table ( fl_id varchar(3) )
            INSERT INTO @fleets 
            SELECT fld_id 
            FROM XDispFleetSettings 
            WHERE fld_exts_site IN ( SELECT fld_exts_site FROM XDispFleetSettings WHERE fld_id = '${fleetId}' )

            SELECT COUNT(*) AS trip_count
            FROM XDispTrips
            INNER JOIN CUSTINFO ON trp_charge_nbr = cu_charge_nbr
            INNER JOIN xdispcities cPkup ON trp_pkup_city = cPkup.city_code AND trp_pkup_state = cPkup.city_state
            INNER JOIN xdispcities cDest ON trp_dest_city = cDest.city_code AND trp_dest_state = cDest.city_state
            WHERE trp_charge_nbr = '${chargeNbr}' AND trp_fl_id IN ( SELECT fl_id FROM @fleets )
            SELECT * FROM (
                SELECT ROW_NUMBER() OVER(ORDER BY ${sortString}) AS row_nbr,
                    trp_nbr, trp_charge_nbr, cu_fl_id, trp_due_dt_tm, trp_pass_first_name, trp_pass_last_name, 
                    trp_pkup_str_nbr, trp_pkup_str_name, cPkup.city_name AS pkup_city, 
                    trp_dest_str_nbr, trp_dest_str_name, cDest.city_name AS dest_city 
                FROM XDispTrips
                INNER JOIN CUSTINFO ON trp_charge_nbr = cu_charge_nbr
                INNER JOIN xdispcities cPkup ON trp_pkup_city = cPkup.city_code AND trp_pkup_state = cPkup.city_state
                INNER JOIN xdispcities cDest ON trp_dest_city = cDest.city_code AND trp_dest_state = cDest.city_state
                WHERE trp_charge_nbr = '${chargeNbr}' AND trp_fl_id IN ( SELECT fl_id FROM @fleets )) x
            WHERE row_nbr BETWEEN ${pageStart} AND ${pageEnd}`;
        var request = new Request(
            sql,
            (err, rowCount, rows) => {
                if (err) {
                    gCallback(null, util.configureResponse( {status: 'ERROR', error: err} ));
                    conn.close();
                } else {
                    gCallback(null, util.configureResponse( {status: 'OK', trips: trips, tripCount: tripCount} ));
                    conn.close();
                }
        });

        request.on('row', (columns) => {
            if (columns[0].metadata.colName == 'trip_count') {
                tripCount = columns[0].value;
            } else {
                trip = new Trip();
                columns.forEach((column) => {
                    switch (column.metadata.colName) {
                        case 'row_nbr':
                            trip.rowNbr = column.value;
                            break;
                        case 'trp_nbr':
                            trip.tripNbr = column.value;
                            break;
                        case 'trp_charge_nbr':
                            trip.chargNbr = column.value;
                            break;
                        case 'cu_fl_id':
                            trip.fleetId = column.value;
                            break;
                        case 'trp_due_dt_tm':
                            trip.dueDtTm = column.value;
                            break;
                        case 'trp_pass_first_name':
                            trip.firstName = column.value;
                            break;
                        case 'trp_pass_last_name':
                            trip.lastName = column.value;
                            break;
                        case 'trp_pkup_str_nbr':
                            trip.pkupStrNbr = column.value;
                            break;
                        case 'trp_pkup_str_name':
                            trip.pkupStrName = column.value;
                            break;
                        case 'pkup_city':
                            trip.pkupCity = column.value;
                            break;
                        case 'trp_dest_str_nbr':
                            trip.destStrNbr = column.value;
                            break;
                        case 'trp_dest_str_name':
                            trip.destStrName = column.value;
                            break;
                        case 'dest_city':
                            trip.destCity = column.value;
                            break;
                    }
                });
                trips.push(trip);
            }
        });

        // request.on('doneProc', (rowCount, more, rows) => {
        //     gCallback(null, util.configureResponse( {status: 'OK', trips: trips, tripCount: tripCount} ));
        //     conn.close();
        // });
        
        // request.on('done', (rowCount, more, rows) => {
        //     gCallback(null, util.configureResponse( {status: 'OK', trips: trips, tripCount: tripCount} ));
        //     conn.close();
        // });

        conn.execSql(request);
    });
}