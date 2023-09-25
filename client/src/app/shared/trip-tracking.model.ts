export class TripTrackingData {
	rowNbr: number;
	tripNbr: number;
	dueDtTm: string;
	firstName: string;
	lastName: string;
	passId: string;
	status: string;
	cancelPending: boolean;
	vehNbr: number;
	pkupLat: number;
	pkupLng: number;
	vehLat: number;
	vehLng: number;
	etaPending: boolean;
	eta: number;
}

export class TripTrackingResponse {
	status: string;
	trips: TripTrackingData[];
	tripCount: number;
}

export class TripDetail {
	tripNbr: number;
	chargeNbr: string;
	dueDtTm: string;
	firstName: string;
	lastName: string;
	phone: string;
	pkupStrNbr: string;
	pkupStrName: string;
	pkupCity: string;
	destStrNbr: string;
	destStrName: string;
	destCity: string;
	nbrPass: number;
	comments: string;
	wu_username: string;
	wu_fname: string;
	wu_lname: string;

	constructor() {
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
}

export class TripDetailResponse {
	status: string;
	tripDetail: TripDetail;
}
