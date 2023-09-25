import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CacheInterceptor } from './cache-interceptor';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent,
         FeedbackDialogComponent,
         MaintenanceNotificationDialogComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { AccountsComponent } from './accounts/accounts.component';
import { AdminTasksComponent, UserDialogComponent, SaveUserService } from './admin-tasks/admin-tasks.component';
import { CompleteRegistrationComponent } from './complete-registration/complete-registration.component';
import { TrackTripsComponent,
         MapDialogComponent,
         EventsDialogComponent,
         DetailsDialogComponent } from './track-trips/track-trips.component';
import { ActivateTripsComponent } from './activate-trips/activate-trips.component';
import { InvoiceComponent } from './invoice/invoice.component';
import { MobileAppBookingComponent,
         MobileDialogComponent,
         SaveMobileService } from './mobile-app-booking/mobile-app-booking.component';
import { PhoneBookingComponent,
         NameDialogComponent,
         SavePhoneService } from './phone-booking/phone-booking.component';
import { UserProfileComponent,
         ProfilePhotoDialogComponent,
         SavePhotoService } from './user-profile/user-profile.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { PaginationService } from './shared/pagination.service';
import { SharedService } from './shared/shared.service';
import { MessageDialogComponent } from './shared/message-dialog.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { MatDatepickerModule,
         MatNativeDateModule,
         MatInputModule,
         MAT_DIALOG_DEFAULT_OPTIONS,
         MatDialogModule,
         MatDialogRef,
         MatProgressSpinnerModule,
         MatButtonModule,
         MatSelectModule,
         MatRadioModule,
         MatCheckboxModule,
         MatTreeModule,
         MatSortModule,
         MatIconModule,
         MatToolbarModule,
         MatSidenavModule} from '@angular/material';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatMenuModule} from '@angular/material/menu';
import {MatTabsModule} from '@angular/material/tabs';
import { ImageCropperModule } from 'ngx-image-cropper';
import { ExportService } from './track-trips/export.service';



@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    AccountsComponent,
    AdminTasksComponent,
    CompleteRegistrationComponent,
    TrackTripsComponent,
    ActivateTripsComponent,
    InvoiceComponent,
    MobileAppBookingComponent,
    PhoneBookingComponent,
    UserProfileComponent,
    MessageDialogComponent,
    ConfirmDialogComponent,
    MapDialogComponent,
    EventsDialogComponent,
    DetailsDialogComponent,
    FeedbackDialogComponent,
    MaintenanceNotificationDialogComponent,
    NameDialogComponent,
    MobileDialogComponent,
    UserDialogComponent,
    ResetPasswordComponent,
    ProfilePhotoDialogComponent,
    // AccountProfileDialogComponent,
    // AccountPhotoDialogComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
    MatDatepickerModule,
    MatNativeDateModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatListModule,
    MatCardModule,
    MatTreeModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatMenuModule,
    MatTabsModule,
    ImageCropperModule,
    MatIconModule,
    MatToolbarModule,
    MatSidenavModule
  ],
  entryComponents: [
    MessageDialogComponent,
    ConfirmDialogComponent,
    MapDialogComponent,
    EventsDialogComponent,
    DetailsDialogComponent,
    FeedbackDialogComponent,
    NameDialogComponent,
    MobileDialogComponent,
    UserDialogComponent,
    MaintenanceNotificationDialogComponent,
    ProfilePhotoDialogComponent,
    // AccountProfileDialogComponent,
    // AccountPhotoDialogComponent
  ],
  providers: [
    SharedService,
    SavePhoneService,
    SaveMobileService,
    SaveUserService,
    PaginationService,
    TrackTripsComponent,
    SavePhotoService,
    ExportService,
    // SaveLogoService,
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
