var pg = require('pg');
const config = require('./config');
var util = require('./util');

let Connection = require('tedious').Connection;
let Request = require('tedious').Request;

let gCallback;
let stats;
let stat;

function StatsItem(key, value) {
	this.key = key;
	this.value = value;
}

exports.getStats = (event, dbConfig, callback) => {
	gCallback = callback;
	let sql;
	let dbConfigArchive;
	if (dbConfig.options.database === 'TDS') {
		dbConfigArchive = config.ccsiArchiveConfig;
	} else {
		dbConfigArchive = dbConfig;
	}

	const currentDate = event.currentDate;
	let startDate = event.startDate;
	let endDate = event.endDate;

	let chargeNbrs = event.chargeNumbers;
	let fleets = event.fleets;

	if (startDate >= currentDate || endDate >= currentDate) {
		// the current date is included in the date range
		if (startDate === currentDate && endDate >= currentDate) {
			// only check dispatch
			sql = buildDispatchQuery(startDate, endDate, chargeNbrs, fleets);
			callDispatchDB(sql, dbConfig, (stats) => {
				gCallback(
					null,
					util.configureResponse({ status: 'OK', stats: stats })
				);
			});
		} else {
			// check both dispatch and archives
			let sqlDispatch = buildDispatchQuery(
				startDate,
				endDate,
				chargeNbrs,
				fleets
			);
			let sqlArchives = buildArchivesQuery(
				startDate,
				endDate,
				chargeNbrs,
				fleets
			);
			callDispatchDB(sqlDispatch, dbConfig, (dispatchStats) => {
				callArchiveDB(sqlArchives, dbConfigArchive, (archiveStats) => {
					let stats = {};
					for (let key in dispatchStats) {
						stats[key] = dispatchStats[key] + archiveStats[key];
					}
					gCallback(
						null,
						util.configureResponse({ status: 'OK', stats: stats })
					);
				});
			});
		}
	} else {
		// the current date is not in the date range
		// only check archives
		sql = buildArchivesQuery(startDate, endDate, chargeNbrs, fleets);
		callArchiveDB(sql, dbConfigArchive, (stats) => {
			gCallback(
				null,
				util.configureResponse({ status: 'OK', stats: stats })
			);
		});
	}
};

const callDispatchDB = (sql, dbConfig, callback) => {
	console.log('call dispatch');
	let conn = new Connection(dbConfig);
	conn.on('connect', (err) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'CONNECTION_ERROR',
					error: err,
				})
			);
			return;
		}

		stats = {};

		let request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				callback(stats);
				conn.close();
			}
		});

		request.on('row', (columns) => {
			columns.forEach((column) => {
				stats[column.metadata.colName] = column.value;
			});
		});
		conn.execSql(request);
	});
};

const callArchiveDB = (sql, dbConfig, callback) => {
	console.log('call archives');
	let conn = new Connection(dbConfig);
	conn.on('connect', (err) => {
		if (err) {
			gCallback(
				null,
				util.configureResponse({
					status: 'CONNECTION_ERROR',
					error: err,
				})
			);
			return;
		}

		stats = {};

		let request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				callback(stats);
				conn.close();
			}
		});

		request.on('row', (columns) => {
			stat = new StatsItem();
			columns.forEach((column) => {
				stats[column.metadata.colName] = column.value;
			});
		});
		conn.execSql(request);
	});
};

const buildDispatchQuery = (startDate, endDate, chargeNbrs, fleets) => {
	let sql = `
    DECLARE 
        @total_trips int, 
        @trips_pending int, 
        @trips_offered int,
        @trips_assigned int,
        @trips_unassigned int,
        @trips_onsite int,
        @trips_pickup int,
        @trips_completed int,
        @trips_killed  int,
        @trips_canceled int,
        @trips_no_show int
    SELECT trp_status, trp_due_dt_tm INTO #trip_stats
        FROM XDispTrips
        WHERE trp_charge_nbr IN ( ${chargeNbrs} )
        AND trp_fl_id IN ( ${fleets} )
        AND trp_due_dt_tm BETWEEN '${startDate}' AND '${endDate}'
        AND trp_nbr <> 0
    SELECT @total_trips = COUNT(*) from #trip_stats
    SELECT @trips_pending = COUNT(*) FROM #trip_stats WHERE trp_status = 'PENDING'
    SELECT @trips_offered = COUNT(*) FROM #trip_stats WHERE trp_status = 'OFFERED'
    SELECT @trips_assigned = COUNT(*) FROM #trip_stats WHERE trp_status = 'ASSIGNED'
    SELECT @trips_unassigned = COUNT(*) FROM #trip_stats WHERE trp_status = 'UNASSGND'
    SELECT @trips_onsite = COUNT(*) FROM #trip_stats WHERE trp_status = 'ONSITE' 
    SELECT @trips_pickup = COUNT(*) FROM #trip_stats WHERE trp_status = 'PICKUP'
    SELECT @trips_completed = COUNT(*) FROM #trip_stats WHERE trp_status = 'COMPLETE'
    SELECT @trips_killed = COUNT(*) FROM #trip_stats WHERE trp_status = 'KILLED'
    SELECT @trips_canceled = COUNT(*) FROM #trip_stats WHERE trp_status = 'CANCELD'
    SELECT @trips_no_show = COUNT(*) FROM #trip_stats WHERE trp_status = 'NOSHOW'
    SELECT @total_trips AS total, 
        @trips_pending AS pending, 
        @trips_offered AS offered, 
        @trips_assigned as assigned, 
        @trips_unassigned AS unassigned, 
        @trips_onsite AS onsite, 
        @trips_pickup AS pickup, 
        @trips_completed AS completed, 
        @trips_killed AS killed, 
        @trips_canceled AS canceled, 
        @trips_no_show AS noshow   
    DROP TABLE #trip_stats
    `;
	return sql;
};

const buildArchivesQuery = (startDate, endDate, chargeNbrs, fleets) => {
	let tableName1, tableName2, sql;
	let minArchiveDate = new Date(2017, 9, 1, 0, 0, 0, 0);
	if (startDate <= minArchiveDate) {
		tableName1 = 'A2017_09';
	} else {
		const splitStartDate = startDate.split('-');
		tableName1 = 'A' + splitStartDate[0] + '_' + splitStartDate[1];
	}
	if (endDate <= minArchiveDate) {
		tableName1 = 'A2017_09';
	} else {
		const splitEndDate = endDate.split('-');
		tableName2 = 'A' + splitEndDate[0] + '_' + splitEndDate[1];
	}

	if (tableName1 === tableName2) {
		// start and end dates are included in the same archives table
		// return sql that only calls one table
		sql = `
        DECLARE 
            @total_trips int, 
            @trips_pending int, 
            @trips_offered int,
            @trips_assigned int,
            @trips_unassigned int,
            @trips_onsite int,
            @trips_pickup int,
            @trips_completed int,
            @trips_killed  int,
            @trips_canceled int,
            @trips_no_show int
        SELECT cl_nbr, cl_status, cl_due_dt_tm INTO #trip_stats
            FROM ${tableName1}.dbo.CALLS
            WHERE cl_charge_nbr IN ( ${chargeNbrs} )
            AND cl_fl_id IN ( ${fleets} )
            AND cl_due_dt_tm BETWEEN '${startDate}' AND '${endDate}'
            AND cl_nbr <> 0
            SELECT @total_trips = COUNT(*) from #trip_stats
            SELECT @trips_pending = COUNT(*) FROM #trip_stats WHERE cl_status = 'PENDING'
            SELECT @trips_offered = COUNT(*) FROM #trip_stats WHERE cl_status = 'OFFERED'
            SELECT @trips_assigned = COUNT(*) FROM #trip_stats WHERE cl_status = 'ASSIGNED'
            SELECT @trips_unassigned = COUNT(*) FROM #trip_stats WHERE cl_status = 'UNASSGND'
            SELECT @trips_onsite = COUNT(*) FROM #trip_stats WHERE cl_status = 'ONSITE' 
            SELECT @trips_pickup = COUNT(*) FROM #trip_stats WHERE cl_status = 'PICKUP'
            SELECT @trips_completed = COUNT(*) FROM #trip_stats WHERE cl_status = 'COMPLETE'
            SELECT @trips_killed = COUNT(*) FROM #trip_stats WHERE cl_status = 'KILLED'
            SELECT @trips_canceled = COUNT(*) FROM #trip_stats WHERE cl_status = 'CANCELD'
            SELECT @trips_no_show = COUNT(*) FROM #trip_stats WHERE cl_status = 'NOSHOW'
            SELECT @total_trips AS total, 
                @trips_pending AS pending, 
                @trips_offered AS offered, 
                @trips_assigned as assigned, 
                @trips_unassigned AS unassigned, 
                @trips_onsite AS onsite, 
                @trips_pickup AS pickup, 
                @trips_completed AS completed, 
                @trips_killed AS killed, 
                @trips_canceled AS canceled, 
                @trips_no_show AS noshow 
        DROP TABLE #trip_stats
        `;
	} else {
		// start and end dates are included in different archives tables
		// return sql that calls both tables;
		sql = `
        DECLARE 
            @total_trips int, 
            @trips_pending int, 
            @trips_offered int,
            @trips_assigned int,
            @trips_unassigned int,
            @trips_onsite int,
            @trips_pickup int,
            @trips_completed int,
            @trips_killed  int,
            @trips_canceled int,
            @trips_no_show int
        SELECT cl_status, cl_due_dt_tm INTO #trip_stats FROM (
            SELECT * 
                FROM ${tableName1}.dbo.CALLS
                WHERE cl_charge_nbr IN ( ${chargeNbrs} )
                AND cl_fl_id IN ( ${fleets} )
                AND cl_due_dt_tm BETWEEN '${startDate}' AND '${endDate}'
                AND cl_nbr <> 0
            UNION
            SELECT *  
                FROM ${tableName2}.dbo.CALLS
                WHERE cl_charge_nbr IN ( ${chargeNbrs} )
                AND cl_fl_id IN ( ${fleets} )
                AND cl_due_dt_tm BETWEEN '${startDate}' AND '${endDate}'
                AND cl_nbr <> 0
        ) x

        SELECT @total_trips = COUNT(*) from #trip_stats
            SELECT @trips_pending = COUNT(*) FROM #trip_stats WHERE cl_status = 'PENDING'
            SELECT @trips_offered = COUNT(*) FROM #trip_stats WHERE cl_status = 'OFFERED'
            SELECT @trips_assigned = COUNT(*) FROM #trip_stats WHERE cl_status = 'ASSIGNED'
            SELECT @trips_unassigned = COUNT(*) FROM #trip_stats WHERE cl_status = 'UNASSGND'
            SELECT @trips_onsite = COUNT(*) FROM #trip_stats WHERE cl_status = 'ONSITE' 
            SELECT @trips_pickup = COUNT(*) FROM #trip_stats WHERE cl_status = 'PICKUP'
            SELECT @trips_completed = COUNT(*) FROM #trip_stats WHERE cl_status = 'COMPLETE'
            SELECT @trips_killed = COUNT(*) FROM #trip_stats WHERE cl_status = 'KILLED'
            SELECT @trips_canceled = COUNT(*) FROM #trip_stats WHERE cl_status = 'CANCELD'
            SELECT @trips_no_show = COUNT(*) FROM #trip_stats WHERE cl_status = 'NOSHOW'
            SELECT @total_trips AS total, 
                @trips_pending AS pending, 
                @trips_offered AS offered, 
                @trips_assigned as assigned, 
                @trips_unassigned AS unassigned, 
                @trips_onsite AS onsite, 
                @trips_pickup AS pickup, 
                @trips_completed AS completed, 
                @trips_killed AS killed, 
                @trips_canceled AS canceled, 
                @trips_no_show AS noshow 
        DROP TABLE #trip_stats
        `;
	}
	return sql;
};
