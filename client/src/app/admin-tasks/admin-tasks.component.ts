import {
	Component,
	OnInit,
	OnDestroy,
	ElementRef,
	ViewChild,
	Injectable,
	Output,
	EventEmitter,
	Inject,
} from '@angular/core';
import { UserData } from '../shared/user.model';
import { Router, NavigationEnd } from '@angular/router';
import { SharedService } from '../shared/shared.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ApiResponse } from '../shared/api.model';
import {
	MatSelectionList,
	MatDialog,
	MatDialogRef,
	MAT_DIALOG_DATA,
} from '@angular/material';
import { Subscription } from 'rxjs';
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';

@Injectable()
export class SaveUserService {
	@Output() save: EventEmitter<any> = new EventEmitter();
}

@Component({
	selector: 'app-admin-tasks',
	templateUrl: './admin-tasks.component.html',
	styleUrls: ['./admin-tasks.component.css'],
})
export class AdminTasksComponent implements OnInit, OnDestroy {
	appUser: UserData;
	allUsers: UserData[];
	users: UserData[];
	userId: string;
	webUserId: number;
	crudContext: string;
	email = '';
	firstName = '';
	lastName = '';
	allowReservations = false;
	allowTracking = false;
	allowTripActivate = false;
	admin = false;
	accounts = [];
	showSpinner: boolean;

	sorting = {
		direction: 'asc',
		column: 'lastName',
	};
	columnsToDisplay = [
		'lastName',
		'firstName',
		'pending',
		'editUser',
		'deleteUser',
	];

	permissions = [
		{ label: 'Allow to create web bookings', value: 'allowReservations' },
		{ label: 'Allow to view trip details', value: 'allowTracking' },
		{
			label: 'Allow to activate/cancel trips',
			value: 'allowTripActivate',
		},
		{ label: 'Allow to authorize phone bookings', value: 'allowPhoneAuth' },
		{
			label: 'Allow to authorize mobile app bookings',
			value: 'allowMobileAppAuth',
		},
		{ label: 'Allow to create new users', value: 'admin' },
	];
	selectedAccount = 'All';
	selectedPermissions = [];

	confirmSubscription: Subscription;
	userSubscription: Subscription;

	@ViewChild('filtLastName') filtLastName: ElementRef;
	@ViewChild('filtFirstName') filtFirstName: ElementRef;

	constructor(
		public dialog: MatDialog,
		private shared: SharedService,
		private saveUserService: SaveUserService,
		private http: HttpClient,
		private router: Router
	) {
		this.appUser = shared.appUser;
		// refresh the user list after the new user is saved using the popup dialog
		this.userSubscription = this.saveUserService.save.subscribe({
			next: () => {
				this.getUsers();
			},
		});
	}

	ngOnInit() {
		this.showSpinner = false;
		this.crudContext = this.shared.CRUD_ACTION_CREATE;
		this.getUsers();
	}

	ngOnDestroy() {
		if (this.confirmSubscription) {
			this.confirmSubscription.unsubscribe();
		}

		if (this.userSubscription) {
			this.userSubscription.unsubscribe();
		}
	}

	nameDisplay(lastName: string, firstName: string) {
		return this.shared.nameDisplay(lastName, firstName);
	}

	onDelete(idx: number) {
		this.userId = this.users[idx].userId;
		this.webUserId = this.users[idx].webUserId;
		const dialog = this.shared.openConfirmDialog(
			'Delete User',
			`Delete User ${this.userId}?`
		);
		this.confirmSubscription = dialog.componentInstance.Choice.subscribe(
			(confirm: boolean) => {
				if (confirm) {
					this.showSpinner = true;
					const params = new HttpParams()
						.append('uid', this.userId)
						.append('webUserId', this.webUserId.toString())
						.append('crudAction', this.shared.CRUD_ACTION_DELETE)
						.append('zone', this.shared.appUser.zoneId)
						.append('token', this.shared.appUser.identity.Token)
						.append('userId', this.appUser.userId)
						.append(
							'application',
							this.shared.appInit.application.toString()
						);
					this.http
						.get(this.shared.appInit.apiPath + 'crudusers', {
							params,
							withCredentials: false,
						})
						.subscribe((response: ApiResponse) => {
							this.showSpinner = false;
							if (response.errorMessage) {
								this.shared.openMessageDialog(
									'Data Access Error',
									response.errorMessage
								);
								return;
							}
							const data = JSON.parse(response.body);
							if (data.status === 'OK') {
								this.shared.openMessageDialog(
									'User Deleted',
									`User <strong>${this.userId}</strong> deleted`
								);
								this.getUsers();
							} else if (data.status === 'AUTHENTICATION_ERROR') {
								this.shared.setAuthError();
								this.router.navigate(['/']);
							} else {
								this.shared.openMessageDialog(
									'User Deletion Error',
									JSON.stringify(data.error)
								);
							}
						});
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

	showOptions(i) {
		const user = this.users[i];
		if (user.rootAdmin) {
			return false;
		} else if (this.appUser.admin === 0 && this.appUser.rootAdmin === 0) {
			return false;
		} else {
			return true;
		}
	}

	getUsers() {
		this.showSpinner = true;
		const params = new HttpParams()
			.append('webUserId', this.shared.appUser.webUserId.toString())
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'getuserlist', {
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
					const data = JSON.parse(response.body);
					if (data.status === 'OK') {
						const currentTime = new Date().getTime();
						this.allUsers = [];
						this.users = [];
						data.users.forEach((user) => {
							if (user.pending && user.secretExpires) {
								const newUser = user;
								if (currentTime >= user.secretExpires) {
									newUser.expired = true;
								} else {
									const diff = Math.abs(
										user.secretExpires - currentTime
									);
									newUser.expired = false;
									const date = new Date(diff);
									newUser.pendingTime =
										'(Pending ' +
										date.getUTCHours().toString() +
										':' +
										date.getUTCMinutes().toString() +
										')';
								}
								this.allUsers.push(newUser);
							} else {
								this.allUsers.push(user);
							}
						});
						this.filterUsers();
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

	openAddUserDialog() {
		const dialogRef = this.dialog.open(UserDialogComponent, {
			width: '500px',
			height: '70%',
			data: {
				accounts: this.accounts,
				appUser: this.appUser,
				userId: this.userId,
				webUserId: this.webUserId,
				crudContext: this.shared.CRUD_ACTION_CREATE,
			},
			panelClass: 'mat-elevation-z5',
		});
	}

	openEditUserDialog(idx: number) {
		const dialogRef = this.dialog.open(UserDialogComponent, {
			width: '500px',
			height: '70%',
			data: {
				accounts: this.accounts,
				appUser: this.appUser,
				userId: this.userId,
				webUserId: this.webUserId,
				crudContext: this.shared.CRUD_ACTION_UPDATE,
				idx,
				users: this.users,
			},
			panelClass: 'mat-elevation-z5',
		});
	}

	reinviteUser(userId: string) {
		this.showSpinner = true;
		const params = new HttpParams()
			.append('userId', userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'reinviteuser', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					this.showSpinner = false;
					const data = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.shared.openMessageDialog(
							'Invitation Sent',
							'User has been sent another invitation.'
						);
						this.getUsers();
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

	sortUsersByName(column: string) {
		if (this.sorting.column === column) {
			if (this.sorting.direction === 'asc') {
				this.sorting.direction = 'desc';
			} else {
				this.sorting.direction = 'asc';
			}
		} else {
			this.sorting.column = column;
			this.sorting.direction = 'asc';
		}

		this.filterUsers();
	}

	sortUsers() {
		let newUsers = [];
		const rootAdmins = [];
		const baseUsers = [];
		this.users.forEach((user) => {
			if (user.rootAdmin) {
				rootAdmins.push(user);
			} else {
				baseUsers.push(user);
			}
		});

		if (this.sorting.direction === 'asc') {
			rootAdmins.sort((a, b) =>
				a[this.sorting.column] < b[this.sorting.column]
					? -1
					: a[this.sorting.column] > b[this.sorting.column]
					? 1
					: 0
			);
			baseUsers.sort((a, b) =>
				a[this.sorting.column] < b[this.sorting.column]
					? -1
					: a[this.sorting.column] > b[this.sorting.column]
					? 1
					: 0
			);
		} else {
			rootAdmins.sort((a, b) =>
				a[this.sorting.column] > b[this.sorting.column]
					? -1
					: a[this.sorting.column] < b[this.sorting.column]
					? 1
					: 0
			);
			baseUsers.sort((a, b) =>
				a[this.sorting.column] > b[this.sorting.column]
					? -1
					: a[this.sorting.column] < b[this.sorting.column]
					? 1
					: 0
			);
		}

		newUsers = newUsers.concat(rootAdmins);
		newUsers = newUsers.concat(baseUsers);
		this.users = newUsers;
	}

	filterUsers() {
		this.users = [];
		this.allUsers.forEach((user) => {
			const matchesLastName = this.checkLastName(user.lastName);
			const matchesFirstName = this.checkFirstName(user.firstName);

			const userHasAccount = this.checkUserHasAccount(user);
			const userHasPermissions = this.checkUserHasPermissions(user);

			if (
				matchesLastName &&
				matchesFirstName &&
				userHasAccount &&
				userHasPermissions
			) {
				this.users.push(user);
			}
		});
		this.sortUsers();
	}

	checkFirstName(firstName: string) {
		let searchText = this.filtFirstName.nativeElement.value;
		if (!searchText) {
			return true;
		}
		searchText = searchText.toLowerCase().trim();
		if (firstName.toString().toLowerCase().startsWith(searchText)) {
			return true;
		} else {
			return false;
		}
	}
	checkLastName(lastName: string) {
		let searchText = this.filtLastName.nativeElement.value;
		if (!searchText) {
			return true;
		}
		searchText = searchText.toLowerCase().trim();
		if (lastName.toString().toLowerCase().startsWith(searchText)) {
			return true;
		} else {
			return false;
		}
	}

	checkUserHasAccount(user: UserData) {
		if (this.selectedAccount === 'All') {
			return true;
		}
		const custId = this.selectedAccount;
		let accountFound = false;
		for (let i = 0; i < user.accounts.length; i++) {
			if (user.accounts[i].custId === custId) {
				accountFound = true;
				break;
			}
		}
		if (accountFound) {
			return true;
		}
		return false;
	}

	checkUserHasPermissions(user: UserData) {
		if (this.selectedPermissions.length < 1) {
			return true;
		} else if (user.rootAdmin === 1) {
			return true;
		} else {
			let permissionsFound = 0;
			for (let i = 0; i < this.selectedPermissions.length; i++) {
				const permission = this.selectedPermissions[i];
				if (user[permission] != null && user[permission] === 1) {
					permissionsFound += 1;
				}
			}
			if (permissionsFound === this.selectedPermissions.length) {
				return true;
			}

			return false;
		}
	}
}

@Component({
	selector: 'app-user-dialog',
	templateUrl: './user-dialog.component.html',
	styleUrls: ['./admin-tasks.component.css'],
})
export class UserDialogComponent implements OnInit {
	crudContext: string;
	email = '';
	firstName = '';
	lastName = '';
	allowReservations = false;
	allowTracking = false;
	allowTripActivate = false;
	allowPhoneAuth = false;
	allowMobileAppAuth = false;
	admin = false;
	showSpinner: boolean;
	accounts = [];
	userId: string;
	webUserId: number;
	appUser: UserData;
	users: UserData[];
	showUpdate = false;
	permissionsLabels = [
		'Allow to create web bookings',
		'Allow to view trip details',
		'Allow to activate/cancel trips',
		'Allow to authorize phone bookings',
		'Allow to authorize mobile app bookings',
		'Allow to create new users',
	];
	permissions = [];
	showUserInfo = false;

	constructor(
		private saveMobileService: SaveUserService,
		public dialogRef: MatDialogRef<any>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private shared: SharedService,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.accounts = this.data.accounts;
		this.appUser = this.data.appUser;
		this.crudContext = this.data.crudContext;
		if (this.crudContext === this.shared.CRUD_ACTION_UPDATE) {
			this.showUpdate = true;
			this.onEdit(this.data.idx);
		} else {
			this.showUserInfo = true;
		}
		(document.querySelector('.mat-dialog-container') as any).fakeScroll();
	}

	closeDialog(): void {
		this.showSpinner = false;
		this.dialogRef.close();
	}

	onCreate(): void {
		this.permissions.forEach((permission) => {
			if (permission === 'Allow to create web bookings') {
				this.allowReservations = true;
			} else if (permission === 'Allow to view trip details') {
				this.allowTracking = true;
			} else if (permission === 'Allow to activate/cancel trips') {
				this.allowTripActivate = true;
			} else if (permission === 'Allow to authorize phone bookings') {
				this.allowPhoneAuth = true;
			} else if (
				permission === 'Allow to authorize mobile app bookings'
			) {
				this.allowMobileAppAuth = true;
			} else if (permission === 'Allow to create new users') {
				this.admin = true;
			}
		});
		this.onCrud(this.shared.CRUD_ACTION_CREATE);
	}

	permissionIsSelected(permission) {
		if (
			permission === 'Allow to create web bookings' &&
			this.allowReservations
		) {
			return true;
		}
		if (permission === 'Allow to view trip details' && this.allowTracking) {
			return true;
		}
		if (
			permission === 'Allow to activate/cancel trips' &&
			this.allowTripActivate
		) {
			return true;
		}
		if (
			permission === 'Allow to authorize phone bookings' &&
			this.allowPhoneAuth
		) {
			return true;
		}
		if (
			permission === 'Allow to authorize mobile app bookings' &&
			this.allowMobileAppAuth
		) {
			return true;
		}
		if (permission === 'Allow to create new users' && this.admin) {
			return true;
		}
		return false;
	}

	onEdit(idx: number) {
		this.users = this.data.users;
		this.showSpinner = true;
		this.userId = this.users[idx].userId;
		this.webUserId = this.users[idx].webUserId;
		const params = new HttpParams()
			.append('webUserId', this.webUserId.toString())
			.append('crudAction', this.shared.CRUD_ACTION_READ)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'crudusers', {
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
					const data = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.email = data.user.userId;
						this.firstName = data.user.firstName;
						this.lastName = data.user.lastName;
						this.allowReservations = data.user.allowReservations;
						this.allowTracking = data.user.allowTracking;
						this.allowTripActivate = data.user.allowTripActivate;
						this.allowPhoneAuth = data.user.allowPhoneAuth;
						this.allowMobileAppAuth = data.user.allowMobileAppAuth;
						this.admin = data.user.admin;
						this.accounts = [];
						data.user.accounts.forEach((account) => {
							this.accounts.push(
								account.custId + ':' + account.fleetId
							);
						});
						this.crudContext = this.shared.CRUD_ACTION_UPDATE;
						this.showUserInfo = true;
						(document.querySelector(
							'.mat-dialog-container'
						) as any).fakeScroll();
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
						this.closeDialog();
					} else {
						this.shared.openMessageDialog(
							'Data Access Error',
							JSON.stringify(data.error)
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

	onUpdate(): void {
		this.allowReservations = false;
		this.allowTracking = false;
		this.allowTripActivate = false;
		this.admin = false;
		this.permissions.forEach((permission) => {
			if (permission === 'Allow to create web bookings') {
				this.allowReservations = true;
			}
			if (permission === 'Allow to view trip details') {
				this.allowTracking = true;
			}
			if (permission === 'Allow to activate/cancel trips') {
				this.allowTripActivate = true;
			}
			if (permission === 'Allow to authorize phone bookings') {
				this.allowPhoneAuth = true;
			}
			if (permission === 'Allow to authorize mobile app bookings') {
				this.allowMobileAppAuth = true;
			}
			if (permission === 'Allow to create new users') {
				this.admin = true;
			}
		});
		this.userId = this.data.users[this.data.idx].userId;
		this.webUserId = this.data.users[this.data.idx].webUserId;
		this.onCrud(this.shared.CRUD_ACTION_UPDATE);
	}

	enableSaveButton() {
		if (this.email && this.firstName && this.lastName) {
			return true;
		} else {
			return false;
		}
	}

	onCrud(action: string) {
		/***** validate data entry *****/
		// email
		let email = '';
		if (action === this.shared.CRUD_ACTION_CREATE) {
			email = this.email.trim();
			// tslint:disable-next-line:max-line-length
			const regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
			if (email.search(regex) < 0) {
				this.shared.openMessageDialog(
					'Date Entry Error',
					'Email must be a valid email address'
				);
				return;
			}
		}
		// name; only last name required
		const fn = this.firstName.trim();
		const ln = this.lastName.trim();
		if (ln.length < 2) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'Last Name is required'
			);
			return;
		}
		// permissions
		const ar = this.allowReservations;
		const at = this.allowTracking;
		const ata = this.allowTripActivate;
		const apa = this.allowPhoneAuth;
		const amaa = this.allowMobileAppAuth;
		if (
			ar === false &&
			at === false &&
			ata === false &&
			apa === false &&
			amaa === false
		) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'At least one permission must be selected'
			);
			return;
		}
		// accounts
		const acct = this.accounts;
		if (!acct || acct.length === 0) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'At least one account must be selected'
			);
			return;
		}

		this.showSpinner = true;
		// update params
		let userId = '';
		let webUserId = '';
		if (action === this.shared.CRUD_ACTION_UPDATE) {
			userId = this.userId;
			webUserId = this.webUserId.toString();
		}

		const params = new HttpParams()
			.append('email', email)
			.append('uid', userId)
			.append('webUserId', webUserId)
			.append('crudAction', action)
			.append('fn', fn)
			.append('ln', ln)
			.append('ar', ar === true ? '1' : '0')
			.append('at', at ? '1' : '0')
			.append('ai', '0')
			.append('ata', ata === true ? '1' : '0')
			.append('apa', apa === true ? '1' : '0')
			.append('amaa', amaa === true ? '1' : '0')
			.append('rr', '0')
			.append('acct', acct.join('|'))
			.append('adm', this.admin === true ? '1' : '0')
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'crudusers', {
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
					const data = JSON.parse(response.body);
					let header = '';
					let message = '';
					if (data.status === 'OK') {
						switch (this.crudContext) {
							case this.shared.CRUD_ACTION_CREATE:
								header = 'User Created';
								message = `User <strong>${this.email.trim()}</strong> created`;
								break;
							case this.shared.CRUD_ACTION_UPDATE:
								header = 'User Updated';
								message = `User <strong>${this.email.trim()}</strong> updated`;
								break;
						}
						this.shared.openMessageDialog(header, message);
						this.saveMobileService.save.emit();
						this.closeDialog();
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
						this.closeDialog();
					} else {
						switch (this.crudContext) {
							case this.shared.CRUD_ACTION_CREATE:
								header = 'User Creation Error';
								break;
							case this.shared.CRUD_ACTION_UPDATE:
								header = 'User Update Error';
								break;
						}
						this.shared.openMessageDialog(
							header,
							JSON.stringify(data.error)
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
}
