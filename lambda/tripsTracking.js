let Connection = require('tedious').Connection;
let Request = require('tedious').Request;
let TYPES = require('tedious');
const util = require('./util');
const config = require('./config');

let gCallback;

function Trip() {
	this.tripNbr = 0;
	this.vehNbr = 0;
	this.dueDtTm = '';
	this.firstName = '';
	this.lastName = '';
	this.status = '';
	this.cancelPending = false;
	this.pkupLat = 0;
	this.pkupLng = 0;
	this.vehLat = 0;
	this.vehLng = 0;
}

let trip;
let trips;

exports.getTrips = (event, dbConfig, callback) => {
	gCallback = callback;
	let sql;
	let dbConfigArchive;
	if (dbConfig.options.database === 'TDS') {
		dbConfigArchive = config.ccsiArchiveConfig;
	} else {
		dbConfigArchive = dbConfig;
	}

	const currentDate = event.currentDate;
	let filtLastName =
		event.filtLastName != null && event.filtLastName.toString().trim() != ''
			? event.filtLastName.toString().trim()
			: '';
	let filtFirstName =
		event.filtFirstName != null &&
		event.filtFirstName.toString().trim() != ''
			? event.filtFirstName.toString().trim()
			: '';
	let filtStatus =
		event.filtStatus != null && event.filtStatus.toString().trim() != ''
			? event.filtStatus.toString().trim()
			: '';
	let startDate = event.dateStart;
	let endDate = event.dateEnd;
	let chargeNbr = event.chargeNbr;
	let fleetId = event.fleetId;

	if (startDate >= currentDate || endDate >= currentDate) {
		// the current date is included in the date range
		if (startDate === currentDate && endDate >= currentDate) {
			// only check dispatch
			sql = buildDispatchQuery(
				startDate,
				endDate,
				chargeNbr,
				fleetId,
				filtLastName,
				filtFirstName,
				filtStatus,
				dbConfig
			);
			callDispatchDB(sql, dbConfig, (data) => {
				data.trips.sort((a, b) => {
					return a.dueDtTm > b.dueDtTm ? 1 : -1;
				});
				gCallback(
					null,
					util.configureResponse({ status: 'OK', trips: data.trips })
				);
			});
		} else {
			// check both dispatch and archives
			let sqlDispatch = buildDispatchQuery(
				startDate,
				endDate,
				chargeNbr,
				fleetId,
				filtLastName,
				filtFirstName,
				filtStatus,
				dbConfig
			);
			let sqlArchives = buildArchivesQuery(
				currentDate,
				startDate,
				endDate,
				chargeNbr,
				fleetId,
				filtLastName,
				filtFirstName,
				filtStatus,
				dbConfig
			);
			callDispatchDB(sqlDispatch, dbConfig, (data) => {
				callArchiveDB(
					sqlArchives,
					dbConfigArchive,
					(callbackData) => {
						const trips = [];
						callbackData.trips.forEach((trip) => {
							let found = false;
							for (let i = 0; i < trips.length; i++) {
								if (
									trips[i].tripNbr === trip.tripNbr &&
									trips[i].status === trip.status
								) {
									found = true;
									break;
								}
							}
							if (!found) {
								trips.push(trip);
							}
						});
						trips.sort((a, b) => {
							return a.dueDtTm > b.dueDtTm ? 1 : -1;
						});

						gCallback(
							null,
							util.configureResponse({
								status: 'OK',
								trips: trips,
							})
						);
					},
					data
				);
			});
		}
	} else {
		// the current date is not in the date range
		// only check archives
		sql = buildArchivesQuery(
			currentDate,
			startDate,
			endDate,
			chargeNbr,
			fleetId,
			filtLastName,
			filtFirstName,
			filtStatus,
			dbConfig
		);
		callArchiveDB(
			sql,
			dbConfigArchive,
			(data) => {
				data.trips.sort((a, b) => {
					return a.dueDtTm > b.dueDtTm ? 1 : -1;
				});
				gCallback(
					null,
					util.configureResponse({ status: 'OK', trips: data.trips })
				);
			},
			null
		);
	}
};

const callDispatchDB = (sql, dbConfig, callback) => {
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

		trips = [];

		let request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				callback({ trips: trips });
				conn.close();
			}
		});

		request.on('row', (columns) => {
			trip = new Trip();
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'row_nbr':
						trip.rowNbr = column.value;
						break;
					case 'trp_nbr':
						trip.tripNbr = column.value;
						break;
					case 'trp_vh_nbr':
						trip.vehNbr = column.value;
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
					case 'trp_status':
						trip.status = column.value;
						break;
					case 'tran_tds_call_nbr':
						trip.cancelPending = column.value > 0 ? true : false;
						break;
					case 'pkup_lat':
						trip.pkupLat = column.value;
						break;
					case 'pkup_lng':
						trip.pkupLng = column.value;
						break;
					case 'veh_lat':
						trip.vehLat = column.value;
						break;
					case 'veh_lng':
						trip.vehLng = column.value;
						break;
				}
			});
			trips.push(trip);
		});
		conn.execSql(request);
	});
};

const callArchiveDB = (sql, dbConfig, callback, data) => {
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

		trips = [];

		let request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				if (data) {
					trips = trips.concat(data.trips);
				}
				callback({ trips: trips });
				conn.close();
			}
		});

		request.on('row', (columns) => {
			trip = new Trip();
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'row_nbr':
						trip.rowNbr = column.value;
						break;
					case 'cl_nbr':
						trip.tripNbr = column.value;
						break;
					case 'cl_vh_nbr':
						trip.vehNbr = column.value;
						return;
					case 'cl_due_dt_tm':
						trip.dueDtTm = column.value;
						break;
					case 'cl_passenger_name':
						let name = column.value;
						name = name.split(' ');
						trip.lastName = name[0];
						if (name.length > 1) {
							name = name.slice(1, name.length + 1);
							trip.firstName = name.join(' ');
						}
						break;
					case 'cl_status':
						trip.status = column.value;
						break;
				}
			});
			trips.push(trip);
		});
		conn.execSql(request);
	});
};

const buildArchivesQuery = (
	currentDate,
	startDate,
	endDate,
	chargeNbr,
	fleetId,
	filtLastName,
	filtFirstName,
	filtStatus,
	dbConfig
) => {
	const passengerName = filtLastName + '%' + filtFirstName;
	if (filtStatus != null && filtStatus.toString().trim() != '') {
		filtStatus = filtStatus.toString().trim().split('|');
		filtStatus = `AND cl_status IN ('${filtStatus.join("','")}')`;
	}

	let sql,
		newDate,
		newYear,
		newMonth,
		tableNameMonth,
		tableNameYear,
		newTableName,
		tempDate;
	let formattedStartDate = startDate;
	let formattedEndDate = endDate;
	startDate = new Date(startDate);
	endDate = new Date(endDate);
	currentDate = new Date(currentDate);

	if (startDate > currentDate) {
		tempDate = currentDate;
		if (currentDate.getDate() === 1) {
			tempDate.setMonth(tempDate.getMonth() - 1);
		}
		startDate = tempDate;
		endDate = tempDate;
	} else if (endDate > currentDate) {
		tempDate = currentDate;
		if (currentDate.getDate() === 1) {
			tempDate.setMonth(tempDate.getMonth() - 1);
		}
		endDate = tempDate;
	}

	if (
		startDate.getFullYear() === endDate.getFullYear() &&
		startDate.getMonth() === endDate.getMonth()
	) {
		// year and month of dates are the same so we only need to call one table
		let tableNameMonth = startDate.getMonth() + 1;
		let tableNameYear = startDate.getFullYear();
		if (tableNameMonth < 10) {
			tableNameMonth = '0' + tableNameMonth;
		}
		let tableName = 'A' + tableNameYear + '_' + tableNameMonth;

		sql = `
            SELECT cl_nbr, cl_vh_nbr, cl_passenger_name, cl_status, cl_due_dt_tm
            FROM ${tableName}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
                ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
                (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
                (
                    cl_passenger_name LIKE '${passengerName}' 
                    ${filtStatus}
                )
                AND cl_nbr <> 0`;
	} else {
		let tableNames = [];
		newYear = startDate.getFullYear();
		newMonth = startDate.getMonth() + 1;
		newDate = startDate;
		newDate.setDate(1);
		while (
			newYear < endDate.getFullYear() ||
			newMonth <= endDate.getMonth()
		) {
			tableNameMonth = newDate.getMonth() + 1;
			tableNameYear = newDate.getFullYear();
			if (tableNameMonth < 10) {
				tableNameMonth = '0' + tableNameMonth;
			}
			newTableName = 'A' + tableNameYear + '_' + tableNameMonth;
			tableNames.push(newTableName);
			newDate.setMonth(newDate.getMonth() + 1);
			newYear = newDate.getFullYear();
			newMonth = newDate.getMonth();
		}
		sql = `
            SELECT cl_nbr, cl_vh_nbr, cl_passenger_name, cl_status, cl_due_dt_tm
            FROM ${tableNames[0]}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
                (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
                (
                    cl_passenger_name LIKE '${passengerName}' 
                    ${filtStatus}
                )
                AND cl_nbr <> 0
            UNION`;
		for (let i = 1; i < tableNames.length - 1; i++) {
			sql += `
            SELECT cl_nbr, cl_vh_nbr, cl_passenger_name, cl_status, cl_due_dt_tm
            FROM ${tableNames[i]}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
                (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
                (
                    cl_passenger_name LIKE '${passengerName}' 
                    ${filtStatus}
                )
                AND cl_nbr <> 0
            UNION`;
		}
		sql += `
            SELECT cl_nbr, cl_vh_nbr, cl_passenger_name, cl_status, cl_due_dt_tm
            FROM ${tableNames[tableNames.length - 1]}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
                (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
                (
                    cl_passenger_name LIKE '${passengerName}' 
                    ${filtStatus}
                )
                AND cl_nbr <> 0`;
	}

	return sql;
};

const buildDispatchQuery = (
	startDate,
	endDate,
	chargeNbr,
	fleetId,
	filtLastName,
	filtFirstName,
	filtStatus,
	dbConfig
) => {
	filtFirstName += '%';
	filtLastName += '%';
	if (filtStatus != null && filtStatus.toString().trim() != '') {
		filtStatus = filtStatus.toString().trim().split('|');
		filtStatus = `AND trp_status IN ('${filtStatus.join("','")}')`;
	}
	let sql = `
        SELECT trp_nbr, trp_vh_nbr, trp_pass_last_name, trp_pass_first_name, trp_status, trp_due_dt_tm,
        trp_pkup_lat / 1000000.0 AS pkup_lat, trp_pkup_lon / 1000000.0 AS pkup_lng, 
              ISNULL(vhd_pos_lat, 0) / 1000000.0 AS veh_lat, ISNULL(vhd_pos_lon, 0) / 1000000.0 AS veh_lng
        FROM XDispTrips
        LEFT OUTER JOIN XDispVehicle ON trp_fl_id = vhd_fl_id and trp_vh_nbr = vhd_nbr
        WHERE trp_charge_nbr = '${chargeNbr}' AND
        ${formatFleetIdSQL(false, fleetId, dbConfig)} AND
            (trp_due_dt_tm BETWEEN '${startDate}' AND '${endDate}') AND
            (
                trp_pass_last_name LIKE '${filtLastName}' AND 
                trp_pass_first_name LIKE '${filtFirstName}'
                ${filtStatus}
            )
            AND trp_nbr <> 0
            
        `;
	return sql;
};

const formatFleetIdSQL = (isArchiveQuery, fleetId, dbConfig) => {
	// if database is not TDS, assume the request is for BNL
	if (
		dbConfig.options.database === 'TDS' &&
		(fleetId === 'G' || fleetId === 'O')
	) {
		if (isArchiveQuery) {
			return `(cl_fl_id = 'G' OR cl_fl_id = 'O')`;
		} else {
			return `(trp_fl_id = 'G' OR trp_fl_id = 'O')`;
		}
	} else {
		if (isArchiveQuery) {
			return `cl_fl_id = '${fleetId}'`;
		} else {
			return `trp_fl_id = '${fleetId}'`;
		}
	}
};
