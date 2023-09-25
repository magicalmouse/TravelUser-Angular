import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SharedService } from '../shared/shared.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ApiResponse } from '../shared/api.model';

@Component({
  selector: 'app-complete-registration',
  templateUrl: './complete-registration.component.html',
  styleUrls: ['./complete-registration.component.css']
})
export class CompleteRegistrationComponent implements OnInit, OnDestroy {
  @ViewChild('password') password: ElementRef;
  @ViewChild('confirmPassword') confirmPassword: ElementRef;
  secret: string;
  userId: string;
  webUserId: string;
  zone: string;
  validationError = '';
  showSpinner: boolean;

  constructor(
    private shared: SharedService,
    private http: HttpClient,
    private router: Router) {}

  ngOnInit() {
    this.showSpinner = false;
    this.validateUser();
  }

  ngOnDestroy() {

  }

  validateUser() {
    this.showSpinner = true;
    const params =
      new HttpParams()
      .append('secret', this.shared.secret)
      .append('application', this.shared.appInit.application.toString());
    this.http.get(
      this.shared.appInit.apiPath + 'validateuser',
      {params, withCredentials: false }).subscribe((response: ApiResponse) => {
        this.showSpinner = false;
        if (response.errorMessage) {
          this.shared.openMessageDialog('Data Access Error', response.errorMessage);
          return;
        }
        const data = JSON.parse(response.body);
        if (data.status === 'OK') {
          this.userId = data.userId;
          this.webUserId = data.webUserId;
          this.zone = data.zoneId;
        } else {
          this.validationError = data.status;
        }
      }, error => {
        this.showSpinner = false;
        this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
      });
  }

  confirm() {
    const p = (this.password.nativeElement.value + '').trim();
    const pp = (this.confirmPassword.nativeElement.value + '').trim();
    if (p.length < 8) {
      this.shared.openMessageDialog('Data Entry Error', 'Password must be at least 8 characters long');
      return;
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
      return;
    } else if (p !== pp) {
      this.shared.openMessageDialog('Data Entry Error', 'Password and Confirm Password must match exactly');
      return;
    }
    this.showSpinner = true;
    const params =
      new HttpParams()
      .append('userId', this.userId)
      .append('webUserId', this.webUserId)
      .append('password', this.password.nativeElement.value)
      .append('zone', this.zone)
      .append('application', this.shared.appInit.application.toString());
    this.http.get(
      this.shared.appInit.apiPath + 'activateuser',
      {params, withCredentials: false }).subscribe((response: ApiResponse) => {
        this.showSpinner = false;
        if (response.errorMessage) {
          this.shared.openMessageDialog('Data Access Error', response.errorMessage);
          return;
        }
        const data = JSON.parse(response.body);
        if (data.status === 'OK' && data.activated) {
          this.shared.openMessageDialog('User Activated', 'Please click OK to log in');
          this.shared.setActivationCompleted();
          this.router.navigate(['/']);
        } else {
          this.shared.openMessageDialog('User Not Activated', 'Please contact your supervisor');
        }
      }, error => {
        this.showSpinner = false;
        this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
      });
  }
}
