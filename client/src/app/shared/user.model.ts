import { AccountData } from './account.model';

export class UserData {
    userId: string;
    webUserId: number;
    firstName: string;
    lastName: string;
    allowInvoice: number;
    allowReservations: number;
    allowTracking: number;
    allowTripActivate: number;
    allowPhoneAuth: number;
    allowMobileAppAuth: number;
    reservationRestrictions: number;
    accounts: AccountData[];
    identity: {
        IdentityId: string;
        Token: string;
    };
    zoneId: string;
    rootAdmin: number;
    admin: number;
    pending: boolean;
    pendingTime: string;
    expired: boolean;
    sessionId: string;
    profilePhoto: string;
}

export class UsersResponse {
    status: string;
    users: UserData[];
}
