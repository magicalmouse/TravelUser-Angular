export class TripMap {
    pkupLat: number;
    pkupLng: number;
    destLat: number;
    destLng: number;
    vehLat: number;
    vehLng: number;
    status: string;
}

export class TripMapResponse {
    status: string;
    tripMap: TripMap;
}
