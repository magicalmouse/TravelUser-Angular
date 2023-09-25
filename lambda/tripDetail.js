var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious');
var util = require('./util');
const config = require('./config');

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
	this.pkupLat = 0;
	this.pkupLng = 0;
	this.vehLat = 0;
	this.vehLng = 0;
}

var trip;
var gCallback;

exports.getTripDetail = (event, dbConfig, callback) => {
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
};

const callDispatch = (dbConfig, event) => {
	var conn = new Connection(dbConfig);
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
		trip = new Trip();
		var tripNbr = event.tripNbr;
		var custIdFilter =
			event.custId != null && event.custId.trim() != ''
				? ` AND trp_charge_nbr = '${event.custId}'`
				: '';
		var statusFilter =
			event.status != null && event.status.trim() != ''
				? ` AND trp_status = '${event.status}'`
				: '';

		var sql = `
            SELECT trp_nbr, trp_charge_nbr, trp_due_dt_tm, trp_pass_first_name, trp_pass_last_name,
            trp_pkup_ph_nbr, trp_general_cmnt, trp_nbr_escorts + 1 AS trp_nbr_pass,
            trp_pkup_str_nbr, trp_pkup_str_name, ISNULL(cPkup.city_name, '') AS pkup_city, 
            trp_dest_str_nbr, trp_dest_str_name, ISNULL(cDest.city_name, '') AS dest_city,
            trp_pkup_lat / 1000000.0 AS pkup_lat, trp_pkup_lon / 1000000.0 AS pkup_lng, 
              ISNULL(vhd_pos_lat, 0) / 1000000.0 AS veh_lat, ISNULL(vhd_pos_lon, 0) / 1000000.0 AS veh_lng,
            wu_username, wu_fname, wu_lname
            FROM XDispTrips
            LEFT OUTER JOIN xdispcities cPkup ON trp_pkup_city = cPkup.city_code AND trp_pkup_state = cPkup.city_state
            LEFT OUTER JOIN xdispcities cDest ON trp_dest_city = cDest.city_code AND trp_dest_state = cDest.city_state
            LEFT OUTER JOIN XWebUser ON CAST(trp_ext_charge_nbr AS int) = XWebUser.wu_id
            LEFT OUTER JOIN XDispVehicle ON trp_fl_id = vhd_fl_id and trp_vh_nbr = vhd_nbr
            WHERE trp_nbr = ${tripNbr}${custIdFilter}${statusFilter}`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				var status = 'OK';
				if (trip.tripNbr < 1) {
					status = 'NOT_FOUND';
					trip = null;
				}
				gCallback(
					null,
					util.configureResponse({ status: status, tripDetail: trip })
				);
				conn.close();
			}
		});

		request.on('row', (columns) => {
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
		});

		conn.execSql(request);
	});
};

const callArchive = (dbConfig, dbConfigArchive, event) => {
	var conn = new Connection(dbConfigArchive);
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
		let data = {};
		var tripNbr = event.tripNbr;
		var custIdFilter =
			event.custId != null && event.custId.trim() != ''
				? ` AND cl_charge_nbr = '${event.custId}'`
				: '';
		var statusFilter =
			event.status != null && event.status.trim() != ''
				? ` AND cl_status = '${event.status}'`
				: '';

		let tableName;
		let minArchiveDate = new Date(2017, 09, 01, 0, 0, 0, 0);
		if (event.tripDate <= minArchiveDate) {
			tableName = 'A2017_09';
		} else {
			const splitTripDate = event.tripDate.split('-');
			tableName = 'A' + splitTripDate[0] + '_' + splitTripDate[1];
		}

		var sql = `
            SELECT cl_nbr, cl_charge_nbr, cl_due_dt_tm, cl_passenger_name,
            cl_phone_area, cl_phone_nbr, cl_general_cmnt1, cl_general_cmnt2, cl_nbr_escorts + 1 AS cl_nbr_pass,
            cl_pkup_str, cl_pkup_city, cl_pkup_state,
            cl_dest_str, cl_dest_city, cl_dest_state,
            cl_ext_charge_nbr
            FROM ${tableName}.dbo.CALLS
            WHERE cl_nbr = ${tripNbr}${custIdFilter}${statusFilter}`;

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
				if (event.tripNbr < 1) {
					let status = 'NOT_FOUND';
					trip = null;
					gCallback(
						null,
						util.configureResponse({
							status: status,
							tripDetail: trip,
						})
					);
					return;
				}
				conn.close();
				callDispatchForArchiveInfo(dbConfig, data);
			}
		});

		request.on('row', (columns) => {
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'cl_nbr':
						data.cl_nbr = column.value;
						break;
					case 'cl_charge_nbr':
						data.cl_charge_nbr = column.value;
						break;
					case 'cl_due_dt_tm':
						data.cl_due_dt_tm = column.value;
						break;
					case 'cl_passenger_name':
						data.cl_passenger_name = column.value;
						break;
					case 'cl_phone_area':
						data.cl_phone_area = column.value;
						break;
					case 'cl_phone_nbr':
						data.cl_phone_nbr = column.value;
						break;
					case 'cl_general_cmnt1':
						data.cl_general_cmnt1 = column.value;
						break;
					case 'cl_general_cmnt2':
						data.cl_general_cmnt2 = column.value;
						break;
					case 'cl_nbr_pass':
						data.cl_nbr_pass = column.value;
						break;
					case 'cl_pkup_str':
						data.cl_pkup_str = column.value;
						break;
					case 'cl_pkup_city':
						data.cl_pkup_city = column.value;
						break;
					case 'cl_pkup_state':
						data.cl_pkup_state = column.value;
						break;
					case 'cl_dest_str':
						data.cl_dest_str = column.value;
						break;
					case 'cl_dest_city':
						data.cl_dest_city = column.value;
						break;
					case 'cl_dest_state':
						data.cl_dest_state = column.value;
						break;
					case 'cl_ext_charge_nbr':
						data.cl_ext_charge_nbr = column.value;
						break;
				}
			});
		});

		conn.execSql(request);
	});
};

const callDispatchForArchiveInfo = (dbConfig, data) => {
	var conn = new Connection(dbConfig);
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
		trip = new Trip();
		let sql;
		if (data.cl_ext_charge_nbr !== '') {
			sql = `
            SELECT city_name AS pkup_city FROM
            XDispCities WHERE city_code = '${data.cl_pkup_city}' AND city_state = '${data.cl_pkup_state}'
            SELECT city_name AS dest_city FROM
            XDispCities WHERE city_code = '${data.cl_dest_city}' AND city_state = '${data.cl_dest_state}'
            SELECT wu_username, wu_fname, wu_lname
            FROM XWebUser where wu_id = '${data.cl_ext_charge_nbr}'
            `;
		} else {
			sql = `
            SELECT city_name AS pkup_city FROM
            XDispCities WHERE city_code = '${data.cl_pkup_city}' AND city_state = '${data.cl_pkup_state}'
            SELECT city_name AS dest_city FROM
            XDispCities WHERE city_code = '${data.cl_dest_city}' AND city_state = '${data.cl_dest_state}'
            `;
		}

		var request = new Request(sql, (err, rowCount, rows) => {
			if (err) {
				gCallback(
					null,
					util.configureResponse({ status: 'ERROR', error: err })
				);
				conn.close();
			} else {
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
				trip.comments = data.cl_general_cmnt1 + data.cl_general_cmnt2;
				trip.nbrPass = data.cl_nbr_pass;
				let pkup = data.cl_pkup_str.split(' ');
				trip.pkupStrNbr = pkup[0];
				pkup = pkup.slice(1, pkup.length + 1);
				trip.pkupStrName = pkup.join(' ');

				let dest = data.cl_dest_str.split(' ');
				trip.destStrNbr = dest[0];
				dest = dest.slice(1, dest.length + 1);
				trip.destStrName = dest.join(' ');

				var status = 'OK';
				if (trip.tripNbr < 1) {
					status = 'NOT_FOUND';
					trip = null;
				}
				gCallback(
					null,
					util.configureResponse({ status: status, tripDetail: trip })
				);
				conn.close();
			}
		});

		request.on('row', (columns) => {
			columns.forEach((column) => {
				switch (column.metadata.colName) {
					case 'pkup_city':
						trip.pkupCity = column.value;
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
		});

		conn.execSql(request);
	});
};
