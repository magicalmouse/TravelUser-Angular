export class MobileAuthData {
    recId: number;
    phone: string;
    pin: string;
    active: string;
    firstName: string;
    lastName: string;
}

export class MobileAuthResponse {
    status: string;
    mobileAuths: MobileAuthData[];
}
