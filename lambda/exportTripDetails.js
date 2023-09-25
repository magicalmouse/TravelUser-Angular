var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');
const config = require('./config');

var gCallback;

function Trip() {
	this.tripNbr = 0;
	this.chargeNbr = '';
	this.dueDtTm = '';
	this.firstName = '';
	this.lastName = '';
	this.phone = '';
	this.pkupStrNbr = '';
	this.pkupStrName = '';
	this.pkupCity = '';
	this.destStrNbr = '';
	this.destStrName = '';
	this.destCity = '';
	this.nbrPass = 0;
	this.comments = '';
	this.wu_username = '';
	this.wu_fname = '';
	this.wu_lname = '';
}

var trips = [];
var trip;

// call the dispatch and archive databases with the filter information to get the trip details
// add the trip objects to a list and convert the list to the csv document
exports.exportTripDetails = (event, dbConfig, callback) => {
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
	let filename;
	let trips;

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
				trips = data.trips;
				trips.sort((a, b) => {
					return a.dueDtTm > b.dueDtTm ? 1 : -1;
				});
				trips = formatTripDetails(trips);
				filename = formatFileName(startDate, endDate, chargeNbr);
				gCallback(
					null,
					util.configureResponse({ status: 'OK', trips, filename })
				);
			});
		} else if (
			new Date(startDate).getMonth() > new Date(currentDate).getMonth() &&
			new Date(startDate).getFullYear() >=
				new Date(currentDate).getFullYear()
		) {
			trips = [];
			trips = formatTripDetails(trips);
			filename = formatFileName(startDate, endDate, chargeNbr);
			gCallback(
				null,
				util.configureResponse({ status: 'OK', trips, filename })
			);
			return;
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
					dbConfig,
					(callbackData) => {
						trips = [];
						callbackData.forEach((trip) => {
							let found = false;
							for (let i = 0; i < trips.length; i++) {
								if (trips[i].tripNbr === trip.tripNbr) {
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

						trips = formatTripDetails(trips);
						filename = formatFileName(
							startDate,
							endDate,
							chargeNbr
						);
						gCallback(
							null,
							util.configureResponse({
								status: 'OK',
								trips,
								filename,
							})
						);
					},
					data.trips
				);
			});
		}
	} else {
		// the current date is not in the date range
		// only check archives
		sql = buildArchivesQuery(
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
			dbConfig,
			(res) => {
				trips = res;
				trips.sort((a, b) => {
					return a.dueDtTm > b.dueDtTm ? 1 : -1;
				});

				trips = formatTripDetails(trips);
				filename = formatFileName(startDate, endDate, chargeNbr);
				gCallback(
					null,
					util.configureResponse({ status: 'OK', trips, filename })
				);
			},
			null
		);
	}
};

const formatTripDetails = (trips) => {
	//format the trip details for each trip to be used in the csv file
	var new_trips = [];
	trips.forEach((trip) => {
		var new_trip = {
			'Confirmation Number': trip.tripNbr,
			'Pick-Up Time': formatDateTime(trip.dueDtTm),
			'Account Number': trip.chargeNbr,
			'Pick-Up Address':
				trip.pkupStrNbr + ' ' + trip.pkupStrName + ' ' + trip.pkupCity,
			'Drop-Off Address':
				trip.destStrNbr + ' ' + trip.destStrName + ' ' + trip.destCity,
			Name: trip.firstName + ' ' + trip.lastName,
			'Phone Number': formatPhoneNumber(trip.phone),
			'Number of Passengers': trip.nbrPass,
			Comments: trip.comments,
		};
		if (!trip.wu_username) {
			new_trip['Created By'] = 'Call Center';
		} else {
			new_trip['Created By'] =
				trip.wu_fname + ' ' + trip.wu_lname + ' ' + trip.wu_username;
		}
		new_trips.push(new_trip);
	});
	return new_trips;
};

const formatDateTime = (date) => {
	if (date === '') {
		return '';
	}
	const dt = new Date(date);
	let d =
		(dt.getUTCMonth() + 1).toString().padStart(2, '0') +
		'/' +
		dt.getUTCDate().toString().padStart(2, '0') +
		'/' +
		dt.getUTCFullYear() +
		' ';
	if (isWillCall(dt)) {
		// handle will call trips
		d += '(will call)';
	} else {
		d +=
			getAmPmHour(dt).padStart(2, '0') +
			':' +
			dt.getUTCMinutes().toString().padStart(2, '0') +
			' ' +
			getAmPm(dt);
	}
	return d;
};

const isWillCall = (date) => {
	return date.getUTCHours() === 23 && date.getUTCMinutes() === 47;
};

const getAmPmHour = (dt) => {
	const hour = dt.getUTCHours();
	if (hour === 0) {
		return '12';
	} else if (hour < 13) {
		return hour.toString();
	} else {
		return (hour - 12).toString();
	}
};

const getAmPm = (dt) => {
	if (dt.getUTCHours() < 12) {
		return 'AM';
	} else {
		return 'PM';
	}
};

const formatPhoneNumber = (phone) => {
	phone = phone.trim().replace(/-/g, '');

	if (phone.length > 3 && phone.length <= 6) {
		phone = phone.slice(0, 3) + '-' + phone.slice(3);
	} else if (phone.length > 6) {
		phone =
			phone.slice(0, 3) + '-' + phone.slice(3, 6) + '-' + phone.slice(6);
	}
	return phone;
};

const formatFileName = (startDate, endDate, chargeNbr) => {
	startDate = new Date(startDate);
	endDate = new Date(endDate);

	let filename;

	if (
		startDate.getDate() === endDate.getDate() &&
		startDate.getMonth() === endDate.getMonth() &&
		startDate.getFullYear() === endDate.getFullYear()
	) {
		filename = 'Acct#' + chargeNbr + '_' + formatDate(startDate);
	} else {
		filename =
			'Acct#' +
			chargeNbr +
			'_' +
			formatDate(startDate) +
			'_' +
			formatDate(endDate);
	}

	return filename;
};

const formatDate = (date) => {
	let month = date.getMonth();
	let day = date.getDate();
	let year = date.getFullYear();
	let formattedDate = '';

	switch (month) {
		case 0:
			formattedDate += 'Jan';
			break;
		case 1:
			formattedDate += 'Feb';
			break;
		case 2:
			formattedDate += 'Mar';
			break;
		case 3:
			formattedDate += 'Apr';
			break;
		case 4:
			formattedDate += 'May';
			break;
		case 5:
			formattedDate += 'Jun';
			break;
		case 6:
			formattedDate += 'Jul';
			break;
		case 7:
			formattedDate += 'Aug';
			break;
		case 8:
			formattedDate += 'Sep';
			break;
		case 9:
			formattedDate += 'Oct';
			break;
		case 10:
			formattedDate += 'Nov';
			break;
		case 11:
			formattedDate += 'Dec';
			break;
	}

	let dateOrdinal =
		day +
		(day > 0
			? ['th', 'st', 'nd', 'rd'][
					(day > 3 && day < 21) || day % 10 > 3 ? 0 : day % 10
			  ]
			: '');
	formattedDate += dateOrdinal;
	formattedDate += year;

	return formattedDate;
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
	const sql = `
        SELECT trp_nbr, trp_charge_nbr, trp_due_dt_tm, trp_pass_first_name, trp_pass_last_name,
        trp_pkup_ph_nbr, trp_general_cmnt, trp_nbr_escorts + 1 AS trp_nbr_pass,
        trp_pkup_str_nbr, trp_pkup_str_name, ISNULL(cPkup.city_name, '') AS pkup_city,
        trp_dest_str_nbr, trp_dest_str_name, ISNULL(cDest.city_name, '') AS dest_city,
        wu_username, wu_fname, wu_lname
        FROM XDispTrips
        LEFT OUTER JOIN xdispcities cPkup ON trp_pkup_city = cPkup.city_code AND trp_pkup_state = cPkup.city_state
        LEFT OUTER JOIN xdispcities cDest ON trp_dest_city = cDest.city_code AND trp_dest_state = cDest.city_state
        LEFT OUTER JOIN XWebUser ON CAST(trp_ext_charge_nbr AS int) = XWebUser.wu_id
        WHERE trp_charge_nbr = '${chargeNbr}' AND
        ${formatFleetIdSQL(false, fleetId, dbConfig)} AND
        (trp_due_dt_tm BETWEEN '${startDate}' AND '${endDate}') AND
        (
            trp_pass_last_name LIKE '${filtLastName}' AND 
            trp_pass_first_name LIKE '${filtFirstName}'
            ${filtStatus}
        );`;
	return sql;
};

const callDispatchDB = (sql, dbConfig, callback) => {
	const conn = new Connection(dbConfig);
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

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				conn.close();
				callback({ trips: trips });
			}
		});

		request.on('row', (columns) => {
			trip = new Trip();
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'trp_nbr':
						trip.tripNbr = column.value;
						break;
					case 'trp_charge_nbr':
						trip.chargeNbr = column.value;
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
					case 'trp_pkup_ph_nbr':
						trip.phone = column.value;
						break;
					case 'trp_general_cmnt':
						trip.comments = column.value;
						break;
					case 'trp_nbr_pass':
						trip.nbrPass = column.value;
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
					case 'wu_username':
						trip.wu_username = column.value;
						break;
					case 'wu_lname':
						trip.wu_lname = column.value;
						break;
					case 'wu_fname':
						trip.wu_fname = column.value;
						break;
				}
			});
			trips.push(trip);
		});

		conn.execSql(request);
	});
};

const buildArchivesQuery = (
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
	// check to make sure that the dates don't go back further than the archives
	// if they do, set the tableName(s) to be the farthest back table name
	let sql,
		newDate,
		newYear,
		newMonth,
		tableNameMonth,
		tableNameYear,
		newTableName;
	let formattedStartDate = startDate;
	let formattedEndDate = endDate;
	startDate = new Date(startDate);
	endDate = new Date(endDate);

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
            SELECT cl_nbr, cl_charge_nbr, cl_due_dt_tm, cl_passenger_name,
            cl_phone_area, cl_phone_nbr, cl_general_cmnt1, cl_general_cmnt2, cl_nbr_escorts + 1 AS cl_nbr_pass,
            cl_pkup_str, cl_pkup_city, cl_pkup_state,
            cl_dest_str, cl_dest_city, cl_dest_state,
            cl_ext_charge_nbr
            FROM ${tableName}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
            (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
            (
                cl_passenger_name LIKE '${passengerName}' 
                ${filtStatus}
            )`;
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
			if (
				tableNameMonth > new Date().getMonth() + 1 &&
				tableNameYear >= new Date().getFullYear()
			) {
				break;
			}
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
            SELECT cl_nbr, cl_charge_nbr, cl_due_dt_tm, cl_passenger_name,
            cl_phone_area, cl_phone_nbr, cl_general_cmnt1, cl_general_cmnt2, cl_nbr_escorts + 1 AS cl_nbr_pass,
            cl_pkup_str, cl_pkup_city, cl_pkup_state,
            cl_dest_str, cl_dest_city, cl_dest_state,
            cl_ext_charge_nbr
            FROM ${tableNames[0]}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
            (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
            (
                cl_passenger_name LIKE '${passengerName}' 
                ${filtStatus}
            )
            UNION`;
		for (let i = 1; i < tableNames.length - 1; i++) {
			sql += `
                SELECT cl_nbr, cl_charge_nbr, cl_due_dt_tm, cl_passenger_name,
                cl_phone_area, cl_phone_nbr, cl_general_cmnt1, cl_general_cmnt2, cl_nbr_escorts + 1 AS cl_nbr_pass,
                cl_pkup_str, cl_pkup_city, cl_pkup_state,
                cl_dest_str, cl_dest_city, cl_dest_state,
                cl_ext_charge_nbr
                FROM ${tableNames[i]}.dbo.CALLS
                WHERE cl_charge_nbr = '${chargeNbr}' AND
                ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
                (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
                (
                    cl_passenger_name LIKE '${passengerName}' 
                    ${filtStatus}
                )`;
		}
		sql += `
            SELECT cl_nbr, cl_charge_nbr, cl_due_dt_tm, cl_passenger_name,
            cl_phone_area, cl_phone_nbr, cl_general_cmnt1, cl_general_cmnt2, cl_nbr_escorts + 1 AS cl_nbr_pass,
            cl_pkup_str, cl_pkup_city, cl_pkup_state,
            cl_dest_str, cl_dest_city, cl_dest_state,
            cl_ext_charge_nbr
            FROM ${tableNames[tableNames.length - 1]}.dbo.CALLS
            WHERE cl_charge_nbr = '${chargeNbr}' AND
            ${formatFleetIdSQL(true, fleetId, dbConfig)} AND
            (cl_due_dt_tm BETWEEN '${formattedStartDate}' AND '${formattedEndDate}') AND
            (
                cl_passenger_name LIKE '${passengerName}' 
                ${filtStatus}
            )`;
	}

	return sql;
};

const callArchiveDB = (
	sql,
	dbConfigArchive,
	dbConfig,
	callback,
	dispatchData
) => {
	let conn = new Connection(dbConfigArchive);
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

		let data = [];
		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				conn.close();
				callDispatchForArchiveInfo(
					dbConfig,
					data,
					dispatchData,
					callback
				);
			}
		});

		request.on('row', (columns) => {
			trip = {
				cl_nbr: 0,
				cl_charge_nbr: '',
				cl_due_dt_tm: '',
				cl_passenger_name: '',
				cl_phone_area: '',
				cl_phone_nbr: '',
				cl_general_cmnt1: '',
				cl_general_cmnt2: '',
				cl_nbr_pass: 0,
				cl_pkup_str: '',
				cl_pkup_city: '',
				cl_pkup_state: '',
				cl_dest_str: '',
				cl_dest_city: '',
				cl_dest_state: '',
				cl_ext_charge_nbr: '',
			};
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'cl_nbr':
						trip.cl_nbr = column.value;
						break;
					case 'cl_charge_nbr':
						trip.cl_charge_nbr = column.value;
						break;
					case 'cl_due_dt_tm':
						trip.cl_due_dt_tm = column.value;
						break;
					case 'cl_passenger_name':
						trip.cl_passenger_name = column.value;
						break;
					case 'cl_phone_area':
						trip.cl_phone_area = column.value;
						break;
					case 'cl_phone_nbr':
						trip.cl_phone_nbr = column.value;
						break;
					case 'cl_general_cmnt1':
						trip.cl_general_cmnt1 = column.value;
						break;
					case 'cl_general_cmnt2':
						trip.cl_general_cmnt2 = column.value;
						break;
					case 'cl_nbr_pass':
						trip.cl_nbr_pass = column.value;
						break;
					case 'cl_pkup_str':
						trip.cl_pkup_str = column.value;
						break;
					case 'cl_pkup_city':
						trip.cl_pkup_city = column.value;
						break;
					case 'cl_pkup_state':
						trip.cl_pkup_state = column.value;
						break;
					case 'cl_dest_str':
						trip.cl_dest_str = column.value;
						break;
					case 'cl_dest_city':
						trip.cl_dest_city = column.value;
						break;
					case 'cl_dest_state':
						trip.cl_dest_state = column.value;
						break;
					case 'cl_ext_charge_nbr':
						trip.cl_ext_charge_nbr = column.value;
						break;
				}
			});
			data.push(trip);
		});

		conn.execSql(request);
	});
};

const callDispatchForArchiveInfo = (
	dbConfig,
	trips,
	dispatchData,
	callback
) => {
	let locations = [];
	let users = [];
	trips.forEach((trip) => {
		let destCity = trip.cl_dest_city;
		let destState = trip.cl_dest_state;
		let pkupCity = trip.cl_pkup_city;
		let pkupState = trip.cl_pkup_state;
		let extChargeNbr = trip.cl_ext_charge_nbr;

		let found = false;
		locations.forEach((location) => {
			if (
				location.cityCode === destCity &&
				location.state === destState
			) {
				found = true;
			}
		});
		if (!found) {
			locations.push({
				state: destState,
				cityCode: destCity,
			});
		}
		found = false;
		locations.forEach((location) => {
			if (
				location.cityCode === pkupCity &&
				location.state === pkupState
			) {
				found = true;
			}
		});
		if (!found) {
			locations.push({
				state: pkupState,
				cityCode: pkupCity,
			});
		}

		found = false;
		users.forEach((user) => {
			if (user === extChargeNbr) {
				found = true;
			}
		});
		if (!found && extChargeNbr !== '') {
			users.push(extChargeNbr);
		}
	});

	let sql = ``;

	if (users.length === 1) {
		sql += `
        SELECT wu_username, wu_fname, wu_lname, wu_id 
        FROM XWebUser WHERE wu_id = CAST('${users[0]}' AS int)
        `;
	} else if (users.length > 1) {
		sql += `
        SELECT wu_username, wu_fname, wu_lname, wu_id 
        FROM XWebUser WHERE wu_id = CAST('${users[0]}' AS int)
        UNION
        `;
		for (let i = 1; i < locations.length - 1; i++) {
			sql += `
            SELECT wu_username, wu_fname, wu_lname, wu_id 
            FROM XWebUser WHERE wu_id = CAST('${users[i]}' AS int)
            UNION`;
		}
		sql += `
        SELECT wu_username, wu_fname, wu_lname, wu_id 
        FROM XWebUser WHERE wu_id = CAST('${users[users.length - 1]}' AS int)
        `;
	}

	if (locations.length === 1) {
		sql += `
            SELECT ISNULL(city_name, '') AS city_name, city_code, city_state 
            FROM XDispCities 
            WHERE city_code = '${locations[0].cityCode}' AND city_state = '${locations[0].state}'
            `;
	} else if (locations.length > 1) {
		sql += `
            SELECT ISNULL(city_name, '') AS city_name, city_code, city_state 
            FROM XDispCities 
            WHERE city_code = '${locations[0].cityCode}' AND city_state = '${locations[0].state}'
            UNION
            `;
		for (let i = 1; i < locations.length - 1; i++) {
			sql += `
                SELECT ISNULL(city_name, '') AS city_name, city_code, city_state 
                FROM XDispCities 
                WHERE city_code = '${locations[i].cityCode}' AND city_state = '${locations[i].state}'
                UNION`;
		}
		sql += `
            SELECT ISNULL(city_name, '') AS city_name, city_code, city_state 
            FROM XDispCities 
            WHERE city_code = '${
				locations[locations.length - 1].cityCode
			}' AND city_state = '${locations[locations.length - 1].state}'
            `;
	}

	const conn = new Connection(dbConfig);
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
		let locationResults = [];
		let userResults = [];
		let request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				let archiveTrips = [];
				trips.forEach((data) => {
					let trip = new Trip();
					trip.tripNbr = data.cl_nbr;
					trip.chargeNbr = data.cl_charge_nbr;
					trip.dueDtTm = data.cl_due_dt_tm;
					let name = data.cl_passenger_name;
					name = name.split(' ');
					trip.lastName = name[0];
					if (name.length > 1) {
						name = name.slice(1, name.length + 1);
						trip.firstName = name.join(' ');
					}
					trip.phone = '' + data.cl_phone_area + data.cl_phone_nbr;
					trip.comments =
						data.cl_general_cmnt1 + data.cl_general_cmnt2;
					trip.nbrPass = data.cl_nbr_pass;
					let pkup = data.cl_pkup_str.split(' ');
					trip.pkupStrNbr = pkup[0];
					pkup = pkup.slice(1, pkup.length + 1);
					trip.pkupStrName = pkup.join(' ');

					let dest = data.cl_dest_str.split(' ');
					trip.destStrNbr = dest[0];
					dest = dest.slice(1, dest.length + 1);
					trip.destStrName = dest.join(' ');

					trip.pkupCity = '';
					trip.destCity = '';
					trip.wu_username = '';
					trip.wu_lname = '';
					trip.wu_fname = '';
					locationResults.forEach((location) => {
						if (
							data.cl_dest_city === location.city_code &&
							data.cl_dest_state === location.city_state
						) {
							trip.destCity = location.city_name;
						}
						if (
							data.cl_pkup_city === location.city_code &&
							data.cl_pkup_state === location.city_state
						) {
							trip.pkupCity = location.city_name;
						}
					});

					userResults.forEach((user) => {
						if (
							parseInt(data.cl_ext_charge_nbr, 10) === user.wu_id
						) {
							trip.wu_username = user.wu_username;
							trip.wu_fname = user.wu_fname;
							trip.wu_lname = user.wu_lname;
						}
					});
					archiveTrips.push(trip);
				});
				if (dispatchData) {
					let allTrips = archiveTrips.concat(dispatchData);
					callback(allTrips);
				} else {
					callback(archiveTrips);
				}

				conn.close();
			}
		});

		request.on('row', (columns) => {
			let location = {
				city_name: '',
				city_code: '',
				city_state: '',
			};
			let user = {
				wu_username: '',
				wu_fname: '',
				wu_lname: '',
				wu_id: '',
			};
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'city_name':
						location.city_name = column.value;
						break;
					case 'city_code':
						location.city_code = column.value;
						break;
					case 'city_state':
						location.city_state = column.value;
						break;
					case 'wu_username':
						user.wu_username = column.value;
						break;
					case 'wu_fname':
						user.wu_fname = column.value;
						break;
					case 'wu_lname':
						user.wu_lname = column.value;
						break;
					case 'wu_id':
						user.wu_id = column.value;
						break;
				}
			});
			if (
				location.city_name !== '' &&
				location.city_code !== '' &&
				location.city_state !== ''
			) {
				locationResults.push(location);
			}
			if (
				user.wu_username !== '' &&
				user.wu_fname !== '' &&
				user.wu_lname !== '' &&
				user.wu_id
			) {
				userResults.push(user);
			}
		});

		conn.execSql(request);
	});
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
