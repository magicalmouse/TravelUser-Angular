import {
	Component,
	OnInit,
	OnDestroy,
	Inject,
	PlatformRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthenticationResponse } from './shared/authentication.model';
import { UserData } from './shared/user.model';
import { Subscription } from 'rxjs/Subscription';
import { AppInitData } from './shared/app-init.model';
import { PageData } from './shared/page.model';
import { SharedService } from './shared/shared.service';
import { AccountData } from './shared/account.model';
import { ApiResponse } from './shared/api.model';
import {
	MatDialog,
	MatDialogRef,
	MAT_DIALOG_DATA,
	ErrorStateMatcher,
} from '@angular/material';
import { AccountResponse } from './shared/account.model';
import { PlatformLocation } from '@angular/common';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
	isLoggedIn = false;
	appInit: AppInitData;
	appUser: UserData;
	pageId = 1;
	accountIndex = 0;
	userActive = false;
	pages: PageData[] = [
		{ id: 1, name: 'Accounts', path: ['accounts'] },
		{ id: 2, name: 'Activate Trips', path: ['activate-trips'] },
		{ id: 3, name: 'Invoice', path: ['invoice'] },
		{ id: 4, name: 'Mobile App Booking', path: ['mobile-app-booking'] },
		{ id: 5, name: 'Phone Booking', path: ['phone-booking'] },
		{ id: 6, name: 'Track Trips', path: ['track-trips'] },
		{ id: 7, name: 'Trip Events', path: ['trip-events'] },
		{ id: 8, name: 'Trip Map', path: ['trip-map'] },
		{ id: 9, name: 'Trip List', path: ['trip-list'] },
		{ id: 10, name: 'User Profile', path: ['user-profile'] },
		{ id: 11, name: 'Administrative Tasks', path: ['admin-tasks'] },
	];
	accountIndexSetSubscription: Subscription;
	pageIdSetSubscription: Subscription;
	authErrorSetSubscription: Subscription;
	activationCompletedSetSubscription: Subscription;
	isAdmin: boolean;
	completingRegistration = false;
	resetPassword = false;
	gettingSession = true;
	profilePhoto = 'assets/images/account-circle-large.png';

	constructor(
		public dialog: MatDialog,
		private shared: SharedService,
		private router: Router,
		private http: HttpClient,
		private route: ActivatedRoute,
		private location: PlatformLocation
	) {
		location.onPopState(() => {
			this.shared.buildBreadCrumbs(
				window.location.pathname.substring(1),
				this.appUser
			);
		});
	}

	ngOnInit() {
		this.appUser = this.shared.appUser;
		this.activationCompletedSetSubscription = this.shared.activationCompletedSet.subscribe(
			() => {
				this.completingRegistration = false;
			}
		);
		this.shared.resetPasswordSet.subscribe(() => {
			this.resetPassword = false;
		});
		this.http
			.get('assets/files/app-init-prod.json')
			.subscribe((data: AppInitData) => {
				this.appInit = data;
				this.initializeShared();

				const identityToken = localStorage.getItem('identityToken');
				const sessionId = localStorage.getItem('sessionId');
				if (identityToken && sessionId) {
					const params = new HttpParams()
						.append('application', '1')
						.append('identityToken', identityToken)
						.append('sessionId', sessionId)
						.append(
							'application',
							this.shared.appInit.application.toString()
						);
						console.log("params: ", params);

					this.http
						.get(
							this.shared.appInit.authPath +
								'appAuthentication/getsession',
							{ params, withCredentials: false }
						)
						.subscribe(
							(response: ApiResponse) => {
								if (response.errorMessage) {
									this.gettingSession = false;
								} else {
									const sessionData: AuthenticationResponse = JSON.parse(
										response.body
									);
									console.log("SessionData:", sessionData, "params: ", params, "path: ", this.shared.appInit.authPath +
									'appAuthentication/getsession');
									if (sessionData.status === 'OK') {
										this.shared.appUser =
											sessionData.permissions;
										this.shared.appUser.identity =
											sessionData.identity;
										if (
											sessionData.permissions.profilePhoto
										) {
											this.shared.appUser.profilePhoto =
												sessionData.permissions.profilePhoto;
										} else {
											this.shared.appUser.profilePhoto = this.profilePhoto;
										}
										this.onGetSession();
									} else {
										this.gettingSession = false;
									}
								}
							},
							(error) => {
								this.gettingSession = false;
							}
						);
				} else {
					this.gettingSession = false;
				}
			});
		this.accountIndexSetSubscription = this.shared.accountIndexSet.subscribe(
			(data: number) => {
				this.accountIndex = data;
				this.initializeShared();
				this.onNavigate(this.pageId);
			}
		);
		this.pageIdSetSubscription = this.shared.pageIdSet.subscribe(
			(data: number) => {
				this.pageId = data;
				this.onNavigate(this.pageId);
			}
		);
		this.authErrorSetSubscription = this.shared.authErrorSet.subscribe(
			() => {
				localStorage.removeItem('identityToken');
				localStorage.removeItem('sessionId');
				this.isLoggedIn = false;
				this.router.navigate(['/']);
			}
		);
	}

	ngOnDestroy() {
		if (this.accountIndexSetSubscription) {
			this.accountIndexSetSubscription.unsubscribe();
		}
		if (this.pageIdSetSubscription) {
			this.pageIdSetSubscription.unsubscribe();
		}
		if (this.authErrorSetSubscription) {
			this.authErrorSetSubscription.unsubscribe();
		}
		if (this.activationCompletedSetSubscription) {
			this.activationCompletedSetSubscription.unsubscribe();
		}
	}

	onNavigate(pageId: number) {
		this.userActive = false;
		this.pageId = pageId;
		window.scrollTo(0, 0);
		const page = this.getPage(pageId, true);
		this.initializeShared();
		this.router.navigate(page.path);
		this.shared.buildBreadCrumbs(page.path[0], this.appUser);
	}

	onAccount(event: any) {
		const text: string = event.target.innerText;
		this.appUser.accounts.forEach((value: AccountData, index: number) => {
			if (text.indexOf(value.name) > -1) {
				this.accountIndex = index;
			}
		});
		this.initializeShared();
		this.onNavigate(this.pageId);
	}

	onLogin() {
		this.appUser = this.shared.appUser;
		let i = 0;
		// we have to make sure extra spaces in account names are removed
		for (i = 0; i < this.appUser.accounts.length; i++) {
			this.appUser.accounts[i].name = this.appUser.accounts[
				i
			].name.replace(/\s+/g, ' ');
		}
		this.isAdmin = this.appUser.rootAdmin === 1 || this.appUser.admin === 1;
		this.pageId = 1;
		this.accountIndex = 0;
		this.initializeShared();
		const params = new HttpParams().append(
			'application',
			this.shared.appInit.application.toString()
		);
		// call getsystemstatus to find out whether or not to display the maintenance dialog
		this.http
			.get(this.appInit.apiPath + 'getsystemstatus', {
				params,
				withCredentials: false,
			})
			.subscribe((response: ApiResponse) => {
				this.isLoggedIn = true;
				const data = JSON.parse(response.body);
				if (data.showMaintenanceNotification === true) {
					this.openMaintenanceDialog(data.maintenanceNotification);
				}
			});
	}

	onLogout() {
		this.userActive = false;
		const params = new HttpParams()
			.append('application', this.shared.appInit.application.toString())
			.append('identityId', this.appUser.identity.IdentityId)
			.append('user', this.appUser.userId);
		this.http
			.get(this.appInit.authPath + 'appAuthentication/logout', {
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

					if (data.status === 'IDENTITY_DELETED') {
						this.shared.setAuthError();
						localStorage.removeItem('identityToken');
						localStorage.removeItem('sessionId');
						localStorage.removeItem('accountIndex');
					}
				},
				(error) => {
					this.shared.openMessageDialog(
						'Data Access Error',
						'Something went wrong. Please try again.'
					);
				}
			);
	}

	getPage(pageId: number, selectPage: boolean = false) {
		const page = this.pages.find((pg) => pg.id === pageId);
		if (selectPage) {
			this.pageId = pageId;
		}
		return page;
	}

	initializeShared() {
		this.shared.appInit = this.appInit;
		this.shared.appUser = this.appUser;
		this.shared.accountIndex = this.accountIndex;

		// check for account registration completion or password reset
		this.route.queryParams.subscribe((params) => {
			if (params.completeRegistration) {
				localStorage.removeItem('identityToken');
				localStorage.removeItem('sessionId');
				localStorage.removeItem('accountIndex');
				this.completingRegistration = true;
				this.shared.secret = params.secret;
				this.router.navigate(['complete-registration']);
				return;
			}
			if (params.resetPassword) {
				localStorage.removeItem('identityToken');
				localStorage.removeItem('sessionId');
				localStorage.removeItem('accountIndex');
				this.resetPassword = true;
				this.shared.secret = params.secret;
				this.router.navigate(['reset-password']);
				return;
			}
		});
	}

	toggleUser() {
		this.userActive = !this.userActive;
	}

	openFeedbackDialog() {
		const dialogRef = this.dialog.open(FeedbackDialogComponent, {
			width: '500px',
			height: '700px',
		});
	}

	openMaintenanceDialog(maintenanceNotification) {
		const dialogRef = this.dialog.open(
			MaintenanceNotificationDialogComponent,
			{
				width: '300px',
				hasBackdrop: false,
				position: {
					top: '100px',
					right: '100px',
				},
				autoFocus: false,
				panelClass: ['my-class', 'mat-elevation-z10'],
				data: {
					maintenanceNotification,
				},
			}
		);
	}

	onGetSession() {
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
						this.gettingSession = false;
					}
					const data: AccountResponse = JSON.parse(response.body);

					if (data.status === 'OK') {
						this.shared.appUser.accounts = data.accounts;
						this.appUser = this.shared.appUser;
						let i = 0;
						// we have to make sure extra spaces in account names are removed
						for (i = 0; i < this.appUser.accounts.length; i++) {
							this.appUser.accounts[
								i
							].name = this.appUser.accounts[i].name.replace(
								/\s+/g,
								' '
							);
						}
						this.isAdmin =
							this.appUser.rootAdmin === 1 ||
							this.appUser.admin === 1;
						this.pageId = 1;
						const accountIndex = localStorage.getItem(
							'accountIndex'
						);
						if (accountIndex) {
							this.accountIndex = Number(accountIndex);
						} else {
							this.accountIndex = 0;
						}

						this.initializeShared();
						this.gettingSession = false;
						this.isLoggedIn = true;
						this.shared.buildBreadCrumbs(
							window.location.pathname.substring(1),
							this.appUser
						);
						if (window.location.pathname === '/') {
							this.router.navigate(['accounts']);
							this.shared.breadCrumbs = null;
						}
					} else {
						this.gettingSession = false;
					}
				},
				(error) => {
					this.gettingSession = false;
				}
			);
	}
}

@Component({
	selector: 'app-feedback-dialog',
	templateUrl: './feedback-dialog.html',
	styleUrls: ['./app.component.css'],
})
export class FeedbackDialogComponent {
	showSpinner = false;
	firstName = null;
	lastName = null;
	email = null;
	subject = null;
	text = null;

	constructor(
		private shared: SharedService,
		public dialogRef: MatDialogRef<any>,
		private http: HttpClient,
		private router: Router
	) {}

	closeDialog(): void {
		this.dialogRef.close();
	}

	sendFeedback(): void {
		if (
			this.firstName &&
			this.lastName &&
			this.email &&
			this.subject &&
			this.text
		) {
			this.showSpinner = true;
			const params = new HttpParams()
				.append('name', this.firstName + ' ' + this.lastName)
				.append('email', this.email)
				.append('subject', this.subject)
				.append('text', this.text)
				.append('userId', this.shared.appUser.userId)
				.append(
					'application',
					this.shared.appInit.application.toString()
				);
			this.http
				.get(this.shared.appInit.apiPath + 'sendfeedback', {
					params,
					withCredentials: false,
				})
				.subscribe(
					(response: ApiResponse) => {
						this.showSpinner = false;
						if (response.errorMessage) {
							this.shared.openMessageDialog(
								'Error Sending Message',
								response.errorMessage
							);
							return;
						}
						const data = JSON.parse(response.body);
						if (data.status === 'OK') {
							this.closeDialog();
							this.shared.openMessageDialog(
								'Message Sent Successfully',
								'Thank you for your feedback'
							);
						} else if (data.status === 'AUTHENTICATION_ERROR') {
							this.shared.setAuthError();
							this.router.navigate(['/']);
							this.closeDialog();
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
	}

	enableSubmitButton() {
		return (
			this.firstName &&
			this.lastName &&
			this.email &&
			this.subject &&
			this.text
		);
	}
}

@Component({
	selector: 'app-maintenance-dialog',
	templateUrl: './maintenance-dialog.html',
	styleUrls: ['./app.component.css'],
})
export class MaintenanceNotificationDialogComponent implements OnInit {
	maintenanceNotification: string;

	constructor(
		public dialogRef: MatDialogRef<any>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {}

	ngOnInit() {
		this.maintenanceNotification = this.data.maintenanceNotification;
	}

	closeDialog(): void {
		this.dialogRef.close();
	}
}
