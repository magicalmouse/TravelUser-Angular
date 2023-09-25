import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Inject, Injectable, EventEmitter, Output } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SharedService } from '../shared/shared.service';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { ApiResponse } from '../shared/api.model';
import {ImageCropperModule} from 'ngx-image-cropper';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material';


@Injectable()
export class SavePhotoService {
  @Output() save: EventEmitter<any> = new EventEmitter();
  @Output() close: EventEmitter<any> = new EventEmitter();

}

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit, OnDestroy {

  @ViewChild('fileSelector') fileSelector: ElementRef;
  navigationSubscription: Subscription;
  appUser: UserData;
  currentAccount: AccountData;
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
  firstName: string;
  lastName: string;
  userId: string;
  webUserId: string;
  zone: string;
  showSpinner: boolean;
  showPhotoError: boolean;
  selectedImage: any = '';
  imageChangedEvent: any = '';
  photoSubscription: Subscription;
  currentPhoto: string;

  constructor(
    private router: Router,
    private shared: SharedService,
    private savePhotoService: SavePhotoService,
    private http: HttpClient, public dialog: MatDialog) {
    this.navigationSubscription = this.router.events.subscribe((e: any) => {
      // If it is a NavigationEnd event re-initalise the component
      if (e instanceof NavigationEnd) {
        this.ngOnInit();
      }
    });
    this.photoSubscription = this.savePhotoService.save.subscribe({
      next: (photo: string) => {
        this.shared.appUser.profilePhoto = photo;
        this.currentPhoto = photo;
      }
    });
  }

  ngOnInit() {
    this.appUser = this.shared.appUser;
    this.currentAccount = this.shared.currentAccount;
    this.firstName = this.appUser.firstName;
    this.lastName = this.appUser.lastName;
    this.userId = this.appUser.userId;
    this.webUserId = String(this.appUser.webUserId);
    this.zone = this.appUser.zoneId;
    this.showPhotoError = false;
    this.currentPhoto = this.shared.appUser.profilePhoto;
  }

  ngOnDestroy() {
    this.navigationSubscription.unsubscribe();
  }

  onUpdate() {
    let params = new HttpParams()
      .append('webUserId', this.webUserId)
      .append('zone', this.zone)
      .append('updateUserInfo', 'true')
      .append('updateAction', '1')
      .append('token', this.appUser.identity.Token)
      .append('userId', this.appUser.userId)
      .append('application', this.shared.appInit.application.toString());
    let changes = false;

    // check to see if all the necessary information for resettting the password
    // exists and then verify that the new password is valid
    if (this.currentPassword && this.newPassword && this.newPasswordConfirm) {
        const passwordValid = this.checkPassword();
        if (passwordValid) {
          params = params.append('currentPassword', this.currentPassword);
          params = params.append('newPassword', this.newPassword);
          changes = true;
        }
    } else if (this.currentPassword || this.newPassword || this.newPasswordConfirm) {
      let errors = ``;
      if (!this.currentPassword) {
        errors += `<p>Must enter current password.</p>`;
      }
      if (!this.newPassword) {
        errors += `<p>Must enter new password. </p>`;
      }
      if (!this.newPasswordConfirm) {
        errors += `<p>Must confirm new password.</p>`;
      }
      this.shared.openMessageDialog('Data Entry Error', errors);
    }

    // checks to see if the first or last name has been changed
    if ( (this.firstName !== this.appUser.firstName) || (this.lastName !== this.appUser.lastName)) {
      params = params.append('firstName', this.firstName);
      params = params.append('lastName', this.lastName);
      changes = true;
    }

    if (changes) {
      // if either the password or first and/or last names have been changed,
      // send a request to the server
      this.showSpinner = true;
      this.http.get(
        this.shared.appInit.apiPath + 'updateuserprofile',
        {params, withCredentials: false}).subscribe((response: ApiResponse) => {
          this.showSpinner = false;
          if (response.errorMessage) {
            this.shared.openMessageDialog('Data Access Error', response.errorMessage);
            return;
          }
          const data = JSON.parse(response.body);
          if (data.status === 'OK') {
            if (data.firstName && data.lastName) {
              this.shared.appUser.firstName = data.firstName;
              this.shared.appUser.lastName = data.lastName;

            }
            this.newPassword = null;
            this.currentPassword = null;
            this.newPasswordConfirm = null;
            this.shared.openMessageDialog('Update Successful', 'Your changes have been saved and your profile has been updated.');
          } else if (data.status === 'AUTHENTICATION_ERROR') {
            this.shared.setAuthError();
            this.router.navigate(['/']);
          }

        }, error => {
          this.showSpinner = false;
          this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
        });
    }

  }

  checkPassword() {
    const p = this.newPassword.trim();
    const pp = this.newPasswordConfirm.trim();
    if (p.length < 8) {
      this.shared.openMessageDialog('Data Entry Error', 'Password must be at least 8 characters long');
      return false;
    } else if (p.search(/[0-9]/) < 0 ||
               p.search(/[a-z]/) < 0 ||
               p.search(/[A-Z]/) < 0) {
      this.shared.openMessageDialog('Data Entry Error', `
        <p>
          Password must contain at least one each of the following character types
        </p>
        <ul>
          <li>
            Numeric:&nbsp;&nbsp;&nbsp;&nbsp;0-9
          </li>
          <li>
            Lower Case:&nbsp;&nbsp;&nbsp;&nbsp;a-z
          </li>
          <li>
            Upper Case:&nbsp;&nbsp;&nbsp;&nbsp;A-Z
          </li>
        </ul>`);
      return false;
    } else if (p !== pp) {
      this.shared.openMessageDialog('Data Entry Error', 'Password and Confirm Password must match exactly');
      return false;
    }
    return true;
  }

  selectProfilePhoto() {
    const input = document.querySelector('#profilePhotoInput');
    (input as HTMLTextAreaElement).click();
  }


  onFileSelected(event: any) {
    const dialogRef = this.dialog.open(ProfilePhotoDialogComponent, {
      width: '500px',
      data: {
        event,
        webUserId: this.webUserId,
        userId: this.userId,
        appUser: this.appUser,
        zone: this.zone
      },
      panelClass: 'mat-elevation-z5'
    });
  }
}

@Component({
  selector: 'app-profile-photo-dialog',
  templateUrl: './profile-photo-dialog.component.html',
  styleUrls: ['./user-profile.component.css']

})

export class ProfilePhotoDialogComponent implements OnInit, OnDestroy {
  event: any;
  croppedImage: any = '';
  imageChangedEvent: any = '';
  webUserId: string;
  userId: string;
  zone: string;
  appUser: UserData;
  showSpinner = false;

  constructor(
    private savePhotoService: SavePhotoService,
    public dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private shared: SharedService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.imageChangedEvent = this.data.event;
    this.webUserId = this.data.webUserId;
    this.userId = this.data.userId;
    this.zone = this.data.zone;
    this.appUser = this.data.appUser;
  }


  ngOnDestroy() {
    this.savePhotoService.close.emit();
  }

  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
  }
  imageCropped(event: any) {
      this.croppedImage = event.base64;
  }
  imageLoaded() {
      // show cropper
  }
  loadImageFailed() {
    this.shared.openMessageDialog('Loading Image Failed', 'Please try again.');
    this.dialogRef.close();
  }

  closeDialog(): void {
    this.showSpinner = false;
    this.dialogRef.close();
    this.imageChangedEvent = '';
    this.croppedImage = '';
  }

  uploadPhoto() {
    const params = new HttpParams()
      .append('webUserId', this.webUserId)
      .append('userId', this.userId)
      .append('zone', this.zone)
      .append('updateUserInfo', 'true')
      .append('updateAction', '2')
      .append('token', this.appUser.identity.Token)
      .append('application', this.shared.appInit.application.toString());
    this.showSpinner = true;
    this.http.post(
      this.shared.appInit.apiPath + 'updateuserprofile', {base64String: this.croppedImage},
      {params, withCredentials: false}).subscribe((response: ApiResponse) => {
        this.showSpinner = false;
        if (response.errorMessage) {
          this.shared.openMessageDialog('Data Access Error', response.errorMessage);
          return;
        }
        const data = JSON.parse(response.body);
        if (data.status === 'OK') {
          this.savePhotoService.save.emit(this.croppedImage);
          this.closeDialog();

        } else if (data.status === 'AUTHENTICATION_ERROR') {
          this.shared.setAuthError();
          this.router.navigate(['/']);
          this.closeDialog();
        }
    }, error => {
      this.showSpinner = false;
      this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
    });
  }

  selectProfilePhoto() {
    const input = document.querySelector('#profilePhotoInputDialog');
    (input as HTMLTextAreaElement).click();
  }
}

