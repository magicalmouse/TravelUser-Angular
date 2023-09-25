import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	OnDestroy,
	Output,
	EventEmitter,
	Injectable,
} from '@angular/core';
import { SharedService } from '../shared/shared.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
	MobileAuthData,
	MobileAuthResponse,
} from '../shared/mobile-auth.model';
import { Subscription } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { ApiResponse } from '../shared/api.model';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';
import { MatDialog, MatDialogRef } from '@angular/material';
import { TouchSequence } from 'selenium-webdriver';

@Injectable()
export class SaveMobileService {
	@Output() save: EventEmitter<any> = new EventEmitter();
}

@Component({
	selector: 'app-mobile-app-booking',
	templateUrl: './mobile-app-booking.component.html',
	styleUrls: ['./mobile-app-booking.component.css'],
})
export class MobileAppBookingComponent implements OnInit, OnDestroy {
	@ViewChild('phone') phone: ElementRef;
	@ViewChild('pin') pin: ElementRef;
	active: string;
	recId: number;
	auths: MobileAuthData[];
	isEditing: boolean;
	navigationSubscription: Subscription;
	confirmSubscription: Subscription;
	mobileSubscription: Subscription;
	appUser: UserData;
	currentAccount: AccountData;
	accountIndex: number;
	showSpinner: boolean;
	columnsToDisplay = ['firstName', 'lastName', 'phone', 'pin', 'deleteAuth'];

	constructor(
		private saveMobileService: SaveMobileService,
		public dialog: MatDialog,
		private router: Router,
		private shared: SharedService,
		private http: HttpClient
	) {
		this.navigationSubscription = this.router.events.subscribe((e: any) => {
			// If it is a NavigationEnd event re-initalise the component
			if (e instanceof NavigationEnd) {
				this.ngOnInit();
			}
		});
		this.mobileSubscription = this.saveMobileService.save.subscribe({
			next: (data) => {
				this.onSave(data);
			},
		});
	}

	ngOnInit() {
		this.showSpinner = false;
		this.isEditing = false;
		this.active = 'Y';
		this.recId = 0;
		this.getMobileAuths();
		this.appUser = this.shared.appUser;
		this.currentAccount = this.shared.currentAccount;
		this.accountIndex = this.shared.accountIndex;
	}

	setIndex(index: number) {
		this.accountIndex = index;
		this.shared.accountIndex = index;
		localStorage.setItem('accountIndex', String(index));
		this.shared.buildBreadCrumbs(
			window.location.pathname.substring(1),
			this.appUser
		);
		this.ngOnInit();
	}

	ngOnDestroy() {
		if (this.navigationSubscription) {
			this.navigationSubscription.unsubscribe();
		}
		if (this.confirmSubscription) {
			this.confirmSubscription.unsubscribe();
		}
		if (this.mobileSubscription) {
			this.mobileSubscription.unsubscribe();
		}
	}

	formatPhone(input: string) {
		return this.shared.formatPhone(input);
	}

	getMobileAuths() {
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('crudAction', this.shared.CRUD_ACTION_READ)
			.append('chargeNbr', this.shared.currentAccount.custId)
			.append('fleetId', this.shared.currentAccount.fleetId)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'crudmobileauths', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					this.showSpinner = false;
					if (response.errorMessage) {
						this.shared.openMessageDialog(
							'Data Access Error',
							response.errorMessage
						);
						return;
					}
					const data: MobileAuthResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.auths = data.mobileAuths;
						(document.querySelector(
							'.table-wrapper'
						) as any).fakeScroll();
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
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

	onPhoneInput() {
		this.phone.nativeElement.value = this.shared.formatPhone(
			this.phone.nativeElement.value
		);
	}

	onYesNoChange(event: any) {
		this.active = event.value;
	}

	onGeneratePin() {
		// Gets more or less a six digit random number
		this.pin.nativeElement.value = (Math.random() * 10000000)
			.toString()
			.substr(0, 6);
	}

	onDelete(recId: number, phone: string) {
		const dialog = this.shared.openConfirmDialog(
			'Delete Authorization',
			`Do you want to delete booking authorization for Phone Number ${this.shared.formatPhone(
				phone
			)}?`
		);
		this.confirmSubscription = dialog.componentInstance.Choice.subscribe(
			(confirm: boolean) => {
				if (confirm) {
					this.showSpinner = true;
					const apiPath = this.shared.appInit.apiPath;
					const params = new HttpParams()
						.append('crudAction', this.shared.CRUD_ACTION_DELETE)
						.append('chargeNbr', this.shared.currentAccount.custId)
						.append('fleetId', this.shared.currentAccount.fleetId)
						.append('recId', recId.toString())
						.append('zone', this.shared.appUser.zoneId)
						.append('token', this.shared.appUser.identity.Token)
						.append('phone', phone)
						.append('userId', this.shared.appUser.userId)
						.append(
							'application',
							this.shared.appInit.application.toString()
						);
					this.http
						.get(apiPath + 'crudmobileauths', {
							params,
							withCredentials: false,
						})
						.subscribe(
							(response: ApiResponse) => {
								this.showSpinner = false;
								if (response.errorMessage) {
									this.shared.openMessageDialog(
										'Data Access Error',
										response.errorMessage
									);
									return;
								}
								const data: MobileAuthResponse = JSON.parse(
									response.body
								);
								if (data.status === 'OK') {
									this.auths = data.mobileAuths;
								} else if (
									data.status === 'AUTHENTICATION_ERROR'
								) {
									this.shared.setAuthError();
									this.router.navigate(['/']);
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
		);
	}

	onSave(data) {
		if (data.status === 'OK') {
			this.auths = data.mobileAuths;
		} else if (data.status === 'AUTHENTICATION_ERROR') {
			this.router.navigate(['/']);
		}
	}

	openAddMobileDialog() {
		const dialogRef = this.dialog.open(MobileDialogComponent, {
			width: '450px',
			height: '500px',
		});
	}
}

@Component({
	selector: 'app-mobile-dialog',
	templateUrl: './mobile-dialog.component.html',
	styleUrls: ['./mobile-app-booking.component.css'],
})
export class MobileDialogComponent implements OnInit {
	firstName = null;
	lastName = null;
	pin = null;
	phoneNumber = null;
	active = 'Y';
	showSpinner = false;

	constructor(
		private saveMobileService: SaveMobileService,
		public dialogRef: MatDialogRef<any>,
		private shared: SharedService,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.pin = this.onGeneratePin();
	}

	closeDialog(): void {
		this.dialogRef.close();
	}

	onSaved() {
		const phone = this.shared.unformatPhone(this.phoneNumber);
		if (phone.length !== 10) {
			this.shared.openMessageDialog(
				'Data Entry Error',
				'Please enter a valid Phone Nbr, with area code'
			);
			return;
		}
		const pin = this.pin;
		if (pin.length < 4 || 6 < pin.length) {
			this.shared.openMessageDialog(
				'Data Entry Error',
				'Please enter a PIN, 4 to 6 characters in length'
			);
			return;
		}
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const action = this.shared.CRUD_ACTION_CREATE;
		const params = new HttpParams()
			.append('crudAction', action)
			.append('chargeNbr', this.shared.currentAccount.custId)
			.append('fleetId', this.shared.currentAccount.fleetId)
			.append('phone', phone)
			.append('pin', pin.toUpperCase())
			.append('active', this.active)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('firstName', this.firstName)
			.append('lastName', this.lastName)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'crudmobileauths', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					this.showSpinner = false;
					if (response.errorMessage) {
						this.shared.openMessageDialog(
							'Data Access Error',
							response.errorMessage
						);
						return;
					}
					const data: MobileAuthResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.saveMobileService.save.emit(data);
						this.closeDialog();
						this.firstName = null;
						this.lastName = null;
						this.pin = null;
						this.phoneNumber = null;
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

	enableSaveButton() {
		return this.firstName && this.lastName && this.pin && this.phoneNumber;
	}

	onGeneratePin() {
		// Gets more or less a six digit random number
		return (Math.random() * 10000000).toString().substr(0, 6);
	}
}
