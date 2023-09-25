import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AccountsComponent } from './accounts/accounts.component';
import { AdminTasksComponent } from './admin-tasks/admin-tasks.component';
import { TrackTripsComponent } from './track-trips/track-trips.component';
import { ActivateTripsComponent } from './activate-trips/activate-trips.component';
import { InvoiceComponent } from './invoice/invoice.component';
import { MobileAppBookingComponent } from './mobile-app-booking/mobile-app-booking.component';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { PhoneBookingComponent } from './phone-booking/phone-booking.component';
import { CompleteRegistrationComponent } from './complete-registration/complete-registration.component';
import {ResetPasswordComponent} from './reset-password/reset-password.component';

const appRoutes: Routes = [
    { path: 'accounts', component: AccountsComponent },
    { path: 'admin-tasks', component: AdminTasksComponent },
    { path: 'activate-trips', component: ActivateTripsComponent },
    { path: 'invoice', component: InvoiceComponent },
    { path: 'mobile-app-booking', component: MobileAppBookingComponent },
    { path: 'phone-booking', component: PhoneBookingComponent },
    { path: 'track-trips', component: TrackTripsComponent },
    { path: 'user-profile', component: UserProfileComponent },
    { path: 'complete-registration', component: CompleteRegistrationComponent },
    { path: 'reset-password', component: ResetPasswordComponent}
];

@NgModule({
    imports: [RouterModule.forRoot(appRoutes, {onSameUrlNavigation: 'reload'})],
    exports: [RouterModule]
})
export class AppRoutingModule {}
