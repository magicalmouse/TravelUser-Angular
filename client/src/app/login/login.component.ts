import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	Output,
	EventEmitter,
	Input,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthenticationResponse } from '../shared/authentication.model';
import { UserData } from '../shared/user.model';
import { SharedService } from '../shared/shared.service';
import { ApiResponse } from '../shared/api.model';
import { AccountResponse } from '../shared/account.model';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
	@Output() onLogin = new EventEmitter();
	@ViewChild('passwordField') passwordField: ElementRef;
	userName = '';
	userNameFocused = false;
	userNamePopulated = false;
	password = '';
	passwordFocused = false;
	passwordPopulated = false;
	showSpinner: boolean;
	showForgotPassword: boolean;
	profilePhoto = 'assets/images/account-circle-large.png';

	constructor(
		private shared: SharedService,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.showSpinner = false;
		this.showForgotPassword = false;
	}

	focusChanged(ctrl: string, isFocused: boolean) {
		switch (ctrl) {
			case 'userName':
				this.userNameFocused = isFocused;
				this.userNamePopulated = this.userName.length > 0;
				break;
			case 'password':
				this.passwordFocused = isFocused;
				this.passwordPopulated = this.password.length > 0;
				break;
		}
	}

	login() {
		const userName = this.userName.trim();
		if (userName.length < 3) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'Please enter a valid User Name'
			);
			return;
		}
		const password = this.password.trim();
		if (password.length < 3) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'Please enter a valid Password'
			);
			return;
		}
		this.showSpinner = true;
		console.log(this.shared.appInit.authPath + 'appAuthentication/login', "login");
		const params = new HttpParams()
			.append('application', this.shared.appInit.application.toString())
			.append('user', userName)
			.append('password', this.password);
		this.http
			.get(this.shared.appInit.authPath + 'appAuthentication/login', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					if (response.errorMessage) {
						this.shared.openMessageDialog(
							'Data Access Error',
							response.errorMessage
						);
						return;
					}
					const data: AuthenticationResponse = JSON.parse(
						response.body
					);
					if (data.status === 'OK') {
						this.shared.appUser = data.permissions;
						this.shared.appUser.identity = data.identity;
						if (data.permissions.profilePhoto) {
							this.shared.appUser.profilePhoto =
								data.permissions.profilePhoto;
						} else {
							this.shared.appUser.profilePhoto = this.profilePhoto;
						}
						localStorage.setItem(
							'identityToken',
							data.identity.Token
						);
						localStorage.setItem(
							'sessionId',
							data.permissions.sessionId
						);
						this.getAccounts();
					} else if (
						data.status === 'NO_AUTH' ||
						data.status === 'NOT_FOUND'
					) {
						this.showSpinner = false;
						this.shared.openMessageDialog(
							'Login Not Successful',
							'Please check your User Name and Password and try again'
						);
					} else if (data.status === 'ERROR') {
						this.showSpinner = false;
						this.shared.openMessageDialog(
							'Login Error',
							'Please contact the taxi company you have your account with'
						);
					}
				},
				(error) => {
					this.showSpinner = false;
					this.shared.openMessageDialog(
						'Data Access Error',
						'Something went wrong. Please try again.'
					);
				}
			);
	}

	getAccounts() {
		const params = new HttpParams()
			.append('webUserId', this.shared.appUser.webUserId.toString())
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'getaccounts', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					if (response.errorMessage) {
						this.shared.openMessageDialog(
							'Data Access Error',
							response.errorMessage
						);
						return;
					}
					const data: AccountResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.shared.appUser['accounts'] = data.accounts;
						this.onLogin.emit();
						this.router.navigate(['accounts']);
					} else if (data.status === 'NO_AUTH') {
						this.shared.openMessageDialog(
							'Login Not Successful',
							'Please check your User Name and Password and try again'
						);
					} else if (data.status === 'ERROR') {
						this.shared.openMessageDialog(
							'Login Error',
							'Please contact the taxi company you have your account with'
						);
					}
				},
				(error) => {
					this.showSpinner = false;
					this.shared.openMessageDialog(
						'Data Access Error',
						'Something went wrong. Please try again.'
					);
				}
			);
	}

	passwordReset() {
		this.showSpinner = true;
		const params = new HttpParams()
			.append('userId', this.userName)
			.append('requestresetpassword', 'true')
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'resetpassword', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					this.showSpinner = false;
					if (response.errorMessage) {
						this.shared.openMessageDialog(
							'Something Went Wrong',
							'Please try again'
						);
						return;
					}
					const data = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.shared.openMessageDialog(
							'Password Reset Request Submitted',
							'Please check your email for your confirmation to reset your password and follow the steps given.'
						);
						this.showForgotPassword = false;
					} else {
						this.shared.openMessageDialog(
							'We could not find your account',
							'Please check your User Name and try again'
						);
					}
				},
				(error) => {
					this.showSpinner = false;
					this.shared.openMessageDialog(
						'Data Access Error',
						'Something went wrong. Please try again.'
					);
				}
			);
	}

	userNameKeyUp(event: any) {
		if (event.which === 13 && !this.showForgotPassword) {
			this.passwordField.nativeElement.focus();
		} else if (event.which === 13 && this.showForgotPassword) {
			this.passwordReset();
		}
	}

	passwordKeyUp(event: any) {
		if (event.which === 13) {
			this.login();
		}
	}
}
