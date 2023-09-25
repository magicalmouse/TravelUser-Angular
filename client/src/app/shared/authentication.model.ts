import { UserData } from './user.model';

export class AuthenticationResponse {
    status: string;
    permissions: UserData;
    identity: {
        IdentityId: string;
        Token: string;
    };
}
