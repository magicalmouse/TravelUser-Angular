export class PhoneAuthData {
    recId: number;
    name: string;
}

export class PhoneAuthResponse {
    status: string;
    phoneAuths: PhoneAuthData[];
}
