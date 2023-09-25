export class TripData {
	rowNbr: number;
	tripNbr: number;
	chargNbr: string;
	fleetId: string;
	dueDtTm: string;
	firstName: string;
	lastName: string;
	pkupStrNbr: string;
	pkupStrName: string;
	pkupCity: string;
	destStrNbr: string;
	destStrName: string;
	destCity: string;
}

export class TripResponse {
	status: string;
	trips: TripData[];
	tripCount: number;
}
