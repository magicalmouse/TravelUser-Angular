export class TripEvent {
    date: string;
    desc: string;
    statusDesc: string;
    vehNbr: number;
}

export class TripEventResponse {
    status: string;
    tripEvents: TripEvent[];
}
