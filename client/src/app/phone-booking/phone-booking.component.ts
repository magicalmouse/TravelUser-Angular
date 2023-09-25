import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	EventEmitter,
	Output,
	Injectable,
	OnDestroy,
} from '@angular/core';
import { SharedService } from '../shared/shared.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PhoneAuthData, PhoneAuthResponse } from '../shared/phone-auth.model';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { ApiResponse } from '../shared/api.model';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';
import { MatDialog, MatDialogRef } from '@angular/material';

@Injectable()
export class SavePhoneService {
	@Output() save: EventEmitter<any> = new EventEmitter();
}

@Component({
	selector: 'app-phone-booking',
	templateUrl: './phone-booking.component.html',
	styleUrls: ['./phone-booking.component.css'],
})
export class PhoneBookingComponent implements OnInit, OnDestroy {
	@ViewChild('name') name: ElementRef;
	auths: PhoneAuthData[];
	navigationSubscription: Subscription;
	confirmSubscription: Subscription;
	nameSubscription: Subscription;
	appUser: UserData;
	currentAccount: AccountData;
	accountIndex: number;
	showSpinner: boolean;
	columnsToDisplay = ['authCol', 'deleteAuth'];

	constructor(
		private saveService: SavePhoneService,
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
		this.nameSubscription = this.saveService.save.subscribe({
			next: (data) => {
				this.onSave(data);
			},
		});
	}

	ngOnInit() {
		this.showSpinner = false;
		this.getPhoneAuths();
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
		if (this.nameSubscription) {
			this.nameSubscription.unsubscribe();
		}
	}

	getPhoneAuths() {
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
			.get(apiPath + 'crudphoneauths', { params, withCredentials: false })
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
					const data: PhoneAuthResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.auths = data.phoneAuths;
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

	onDelete(recId: number, name: string) {
		const dialog = this.shared.openConfirmDialog(
			'Delete Authorization',
			`Do you want to delete phone booking authorization for ${name}?`
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
						.append('userId', this.shared.appUser.userId)
						.append(
							'application',
							this.shared.appInit.application.toString()
						);
					this.http
						.get(apiPath + 'crudphoneauths', {
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
								const data: PhoneAuthResponse = JSON.parse(
									response.body
								);
								if (data.status === 'OK') {
									this.auths = data.phoneAuths;
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
			this.auths = data.phoneAuths;
		} else if (data.status === 'AUTHENTICATION_ERROR') {
			this.router.navigate(['/']);
		}
	}

	openAddNameDialog() {
		const dialogRef = this.dialog.open(NameDialogComponent, {
			width: '350px',
			height: '300px',
		});
	}
}

@Component({
	selector: 'app-add-name-dialog',
	templateUrl: './add-name-dialog.html',
	styleUrls: ['./phone-booking.component.css'],
})
export class NameDialogComponent {
	firstName = null;
	lastName = null;
	name = null;
	showSpinner = false;
	constructor(
		private saveService: SavePhoneService,
		public dialogRef: MatDialogRef<any>,
		private shared: SharedService,
		private http: HttpClient,
		private router: Router
	) {}

	closeDialog(): void {
		this.dialogRef.close();
	}

	onSaved() {
		if (this.firstName && this.lastName) {
			this.name = this.firstName + ' ' + this.lastName;
			this.showSpinner = true;
			const apiPath = this.shared.appInit.apiPath;
			const params = new HttpParams()
				.append('crudAction', this.shared.CRUD_ACTION_CREATE)
				.append('chargeNbr', this.shared.currentAccount.custId)
				.append('fleetId', this.shared.currentAccount.fleetId)
				.append('name', this.name)
				.append('zone', this.shared.appUser.zoneId)
				.append('token', this.shared.appUser.identity.Token)
				.append('userId', this.shared.appUser.userId)
				.append(
					'application',
					this.shared.appInit.application.toString()
				);
			this.http
				.get(apiPath + 'crudphoneauths', {
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
						const data: PhoneAuthResponse = JSON.parse(
							response.body
						);
						if (data.status === 'OK') {
							this.saveService.save.emit(data);
							this.closeDialog();
							this.firstName = null;
							this.lastName = null;
							this.name = null;
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

	enableSaveButton() {
		return this.firstName && this.lastName;
	}
}
