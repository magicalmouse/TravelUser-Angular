export class AccountData {
    recId: number;
    attn: string;
    custId: string;
    fleetId: string;
    fleetName: string;
    name: string;
    phone: string;
    validFromTime: number;
    validToTime: number;
    vipTag: boolean;
    onHold: string;
}

export class AccountResponse {
    status: string;
    accounts: AccountData[];
}
