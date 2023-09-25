import {
	Component,
	OnInit,
	OnDestroy,
	Inject,
	Injectable,
	Output,
	EventEmitter,
	AfterViewInit,
} from '@angular/core';
import { UserData } from '../shared/user.model';
import { Router, NavigationEnd } from '@angular/router';
import { SharedService } from '../shared/shared.service';
import { StatsItem, StatsResponse } from '../shared/stats.model';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs/Subscription';
import { ApiResponse } from '../shared/api.model';
import {
	MatDatepickerModule,
	MatDatepicker,
	MatDatepickerInputEvent,
} from '@angular/material/datepicker';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AccountData } from '../shared/account.model';
import { AuthenticationResponse } from '../shared/authentication.model';

@Injectable()
export class SaveLogoService {
	@Output() save: EventEmitter<any> = new EventEmitter();
}

@Component({
	selector: 'app-accounts',
	templateUrl: './accounts.component.html',
	styleUrls: ['./accounts.component.css'],
})
export class AccountsComponent implements OnInit, OnDestroy, AfterViewInit {
	date: string;
	statsRefresh: any;
	navigationSubscription: Subscription;
	appUser: UserData;
	pickerStartDate: Date;
	pickerEndDate: Date;
	startDate;
	endDate;
	showSpinner: boolean;
	columnsToDisplay = ['custId', 'name', 'chips'];
	showStats = false;
	minDate = new Date(2018, 0, 1);
	account = 'all';
	showStatsSpinner = false;
	showStatsError = false;
	subscription;

	stats = [
		{ desc: 'Total', values: ['total'], total: 0 },
		{ desc: 'Scheduled', values: ['pending'], total: 0 },
		{ desc: 'Offering', values: ['offered', 'unassigned'], total: 0 },
		{ desc: 'Assigned', values: ['assigned'], total: 0 },
		{ desc: 'At Pickup', values: ['onsite'], total: 0 },
		{ desc: 'In Progress', values: ['pickup'], total: 0 },
		{ desc: 'Canceled', values: ['canceled'], total: 0 },
		{ desc: 'Killed', values: ['killed'], total: 0 },
		{ desc: 'Completed', values: ['completed'], total: 0 },
		{ desc: 'No Show', values: ['noshow'], total: 0 },
	];

	constructor(
		private shared: SharedService,
		public dialog: MatDialog,
		private http: HttpClient,
		private router: Router
	) {
		this.navigationSubscription = this.router.events.subscribe((e: any) => {
			// If it is a NavigationEnd event re-initalise the component
			if (e instanceof NavigationEnd) {
				this.pickerStartDate = this.getStartDate();
				this.pickerEndDate = this.getEndDate();
				this.startDate = this.getStartDate();
				this.startDate.setHours(0);
				this.startDate.setMinutes(0);
				this.startDate.setSeconds(0);
				this.endDate = this.getEndDate();
				this.endDate.setHours(23);
				this.endDate.setMinutes(59);
				this.endDate.setSeconds(59);
				this.ngOnInit();
			}
		});

		this.statsRefresh = setInterval(() => {
			this.getStats(true);
		}, 60000);
		this.appUser = shared.appUser;
		this.pickerStartDate = this.getStartDate();
		this.pickerEndDate = this.getEndDate();
		this.startDate = this.getStartDate();
		this.startDate.setHours(0);
		this.startDate.setMinutes(0);
		this.startDate.setSeconds(0);
		this.endDate = this.getEndDate();
		this.endDate.setHours(23);
		this.endDate.setMinutes(59);
		this.endDate.setSeconds(59);
	}

	getStartDate() {
		const date = new Date();
		return new Date(date);
	}

	getEndDate() {
		const date = new Date();
		const lastday = date.getDate() + 6;
		return new Date(date.setDate(lastday));
	}

	ngOnInit() {
		// this.stats = new Array<StatsItem>();
		this.getStats(false);
		this.showSpinner = false;
	}

	ngOnDestroy() {
		this.navigationSubscription.unsubscribe();
		clearInterval(this.statsRefresh);
	}

	ngAfterViewInit() {
		(document.querySelector('.table-wrapper') as any).fakeScroll();
	}

	onDetails(i: number) {
		this.shared.setPageId(6);
		this.shared.setAccountIndex(i);
		this.onNavigate(['track-trips']);
	}

	onInvoices(i: number) {
		this.shared.setPageId(3);
		this.shared.setAccountIndex(i);
		this.onNavigate(['invoice']);
	}

	onReservations(i: number) {
		console.log("custId~~~~~~~~~~~~~~~~~~~~~", btoa(this.shared.appUser.accounts[i].custId), this.shared.appUser.accounts[i].custId);
		const path =
			this.shared.getReservationPath() +
			'Acct/' +
			btoa(this.shared.appUser.accounts[i].fleetId) +
			'/' +
			btoa(this.shared.appUser.accounts[i].custId) +
			'/' +
			this.shared.appUser.identity.Token.substr(
				this.shared.appUser.identity.Token.length - 100
			);
		console.log("custId=", btoa(this.shared.appUser.accounts[i].custId), "token", this.shared.appUser.identity.Token.substr(
			this.shared.appUser.identity.Token.length - 100
		));
		console.log("path:", path);
		window.open(path, '_blank');
	}

	onPhoneBooking(i: number) {
		this.shared.setAccountIndex(i);
		this.onNavigate(['phone-booking']);
	}

	onMobileAppBooking(i: number) {
		this.shared.setAccountIndex(i);
		this.onNavigate(['mobile-app-booking']);
	}

	onNavigate(route: string[]) {
		window.scrollTo(0, 0);
		this.router.navigate(route);
		this.shared.buildBreadCrumbs(route[0], this.appUser);
	}

	formatDate(date) {
		let dd = date.getDate();
		let mm = date.getMonth() + 1;
		const yyyy = date.getFullYear();

		if (dd < 10) {
			dd = '0' + dd;
		}

		if (mm < 10) {
			mm = '0' + mm;
		}

		return yyyy + '-' + mm + '-' + dd;
	}

	onAccount(event) {
		this.account = event.value;
		this.getStats(false);
	}

	getStats(autoRefresh: boolean) {
		let chargeNumbers = '';
		let fleets = '';
		const fleetList = [];
		if (this.account === 'all') {
			this.shared.appUser.accounts.forEach((account) => {
				chargeNumbers += "'" + account.custId + "',";
				if (!fleetList.includes(account.fleetId)) {
					fleets += "'" + account.fleetId + "',";
					fleetList.push(account.fleetId);
				}
			});
			chargeNumbers = chargeNumbers.substring(
				0,
				chargeNumbers.length - 1
			);
			fleets = fleets.substring(0, fleets.length - 1);
			if (this.shared.appUser.zoneId === 'ccsi') {
				if (fleets.includes('G') && !fleets.includes('O')) {
					fleets += ",'O'";
				} else if (fleets.includes('O') && !fleets.includes('G')) {
					fleets += ",'G'";
				}
			}
		} else {
			chargeNumbers += "'" + this.account + "'";
			this.shared.appUser.accounts.forEach((account) => {
				if (account.custId === this.account) {
					fleets += "'" + account.fleetId + "'";
				}
			});

			if (this.shared.appUser.zoneId === 'ccsi') {
				if (fleets.includes('G') && !fleets.includes('O')) {
					fleets += ",'O'";
				} else if (fleets.includes('O') && !fleets.includes('G')) {
					fleets += ",'G'";
				}
			}
		}

		this.showStatsError = false;
		if (!autoRefresh) {
			this.showStats = false;
			this.showStatsSpinner = true;
		}
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
		const params = new HttpParams()
			.append('zone', this.shared.appUser.zoneId)
			.append('chargeNumbers', chargeNumbers)
			.append('fleets', fleets)
			.append('startDate', this.shared.formatGetDateTime(this.startDate))
			.append('endDate', this.shared.formatGetDateTime(this.endDate))
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('application', this.shared.appInit.application.toString());
		this.subscription = this.http
			.get(this.shared.appInit.apiPath + 'getstats', {
				params,
				withCredentials: false,
			})
			.subscribe(
				(response: ApiResponse) => {
					this.showStatsSpinner = false;
					if (response.errorMessage) {
						this.showStatsError = true;
						this.shared.openMessageDialog(
							'Data Access Error',
							response.errorMessage
						);
						return;
					}
					const data = JSON.parse(response.body);
					if (data.status === 'OK') {
						const stats = data.stats;
						this.stats.forEach((s) => {
							s.total = 0;
							s.values.forEach((v) => {
								if (stats[v] != null) {
									s.total += stats[v];
								}
							});
						});

						this.showStats = true;
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
					}
				},
				(error) => {
					this.showStatsSpinner = false;
					this.showStatsError = true;
				}
			);
	}

	onStartDate(event: MatDatepickerInputEvent<Date>) {
		this.pickerStartDate = new Date(event.value);
		this.startDate = event.value;
		this.startDate.setHours(0);
		this.startDate.setMinutes(0);
		this.startDate.setSeconds(0);
		this.getStats(false);
	}

	onEndDate(event: MatDatepickerInputEvent<Date>) {
		this.pickerEndDate = new Date(event.value);
		this.endDate = event.value;
		this.endDate.setHours(23);
		this.endDate.setMinutes(59);
		this.endDate.setSeconds(59);
		this.getStats(false);
	}

	// openAccountProfile(i: number) {
	//   const dialogRef = this.dialog.open(AccountProfileDialogComponent, {
	//     width: '40%',
	//     height: '80%',
	//     // width: '450px',
	//     // height: '500px',
	//     data: {
	//       account: this.appUser.accounts[i],
	//       webUserId: this.appUser.webUserId,
	//       userId: this.appUser.userId,
	//       appUser: this.appUser,
	//       zone: this.appUser.zoneId
	//     },
	//     panelClass: 'mat-elevation-z5'
	//   })
	// }
}

// @Component({
//   selector: 'app-account-profile-dialog',
//   templateUrl: './account-profile-dialog.html',
//   styleUrls: ['./account-profile-dialog.css']
// })

// export class AccountProfileDialogComponent implements OnInit, OnDestroy {
//   account: AccountData;
//   webUserId: string;
//   userId: string;
//   appUser: UserData;
//   zone: string;
//   showSpinner = false;
//   accountLogo: string;
//   attn: string;
//   phone: string;
//   address1: string;
//   address2: string;
//   fax: string;
//   billAttn: string;
//   billPhone: string;
//   billAddress1: string;
//   billAddress2: string;
//   billFax: string;
//   logoSubscription: Subscription;
//   showProfile = false;
//   showEditProfile = false;
//   profile;
//   showDeletePhoto = false;
//   confirmSubscription: Subscription;

//   constructor(
//     public shared: SharedService,
//     public dialogRef: MatDialogRef<any>,
//     @Inject(MAT_DIALOG_DATA) public data: any,
//     public dialog: MatDialog,
//     private http: HttpClient,
//     private saveLogoService: SaveLogoService,
//     private router: Router
//   ) {
//       this.logoSubscription = this.saveLogoService.save.subscribe({
//         next: () => {
//           this.getAccountPhoto();
//         }
//       });
//     }

//   ngOnInit() {
//     this.account = this.data.account;
//     this.webUserId = this.data.webUserId;
//     this.userId = this.data.userId;
//     this.appUser = this.data.appUser;
//     this.zone = this.data.zone;
//     this.getAccountPhoto();
//   }

//   ngOnDestroy() {
//     if (this.confirmSubscription) {
//       this.confirmSubscription.unsubscribe();
//     }

//     if (this.logoSubscription) {
//       this.logoSubscription.unsubscribe();
//     }
//   }

//   closeDialog() {
//     this.dialogRef.close();
//   }

//   selectAccountPhoto() {
//     const input = document.querySelector('#accountPhotoInput');
//     (input as HTMLTextAreaElement).click();
//   }

//   onFileSelected(event: any) {
//     const dialogRef = this.dialog.open(AccountPhotoDialogComponent, {
//       width: '500px',
//       data: {
//         event,
//         webUserId: this.webUserId,
//         userId: this.userId,
//         appUser: this.appUser,
//         zone: this.zone,
//         account: this.account
//       },
//       panelClass: 'mat-elevation-z5'
//     });
//   }

//   getAccountPhoto() {
//     const params = new HttpParams()
//       .append('webUserId', this.webUserId)
//       .append('userId', this.userId)
//       .append('zone', this.zone)
//       .append('updateAction', '2')
//       .append('token', this.appUser.identity.Token)
//       .append('accountNbr', this.account.custId)
//       .append('fleetId', this.account.fleetId)
//       .append('application', this.shared.appInit.application.toString());

//     this.showSpinner = true;
//     this.http.get(this.shared.appInit.apiPath + 'accountprofile',
//        {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//         this.showSpinner = false;
//         if (response.errorMessage) {
//           this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//           return;
//         }

//         const data = JSON.parse(response.body);
//         if (data.status === 'OK') {
//           // adding the time stamp bypasses the cache to make sure
//           // the image displayed is the new image
//           if (data.accountLogo !== 'https://account-logos.s3.us-east-2.amazonaws.com/default.png') {
//             this.showDeletePhoto = true;
//           }
//           this.accountLogo = data.accountLogo + '?t=' + new Date().getTime();
//           if (!this.profile) {
//             this.getAccountInfo();
//           }
//         } else if (data.status === 'AUTHENTICATION_ERROR') {
//           this.shared.setAuthError();
//           this.router.navigate(['/']);
//           this.closeDialog();
//         }
//       }, error => {
//         this.showSpinner = false;
//         this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
//       });

//   }

//   deleteAccountPhoto() {
//     const dialog = this.shared.openConfirmDialog(
//       'Delete Account Logo',
//       `Delete the account logo for ${this.account.name}?`);
//     this.confirmSubscription = dialog.componentInstance.Choice.subscribe((confirm: boolean) => {
//       if (confirm) {
//         const params = new HttpParams()
//         .append('webUserId', this.webUserId)
//         .append('userId', this.userId)
//         .append('zone', this.zone)
//         .append('updateAction', '6')
//         .append('token', this.appUser.identity.Token)
//         .append('accountNbr', this.account.custId)
//         .append('fleetId', this.account.fleetId)
//         .append('application', this.shared.appInit.application.toString());

//         this.showSpinner = true;
//         this.http.get(this.shared.appInit.apiPath + 'accountprofile',
//            {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//             this.showSpinner = false;
//             if (response.errorMessage) {
//               this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//               return;
//             }

//             const data = JSON.parse(response.body);
//             if (data.status === 'OK') {
//               // adding the time stamp bypasses the cache to make sure
//               // the image displayed is the new image
//               this.showDeletePhoto = false;
//               this.accountLogo = data.accountLogo + '?t=' + new Date().getTime();
//             } else if (data.status === 'AUTHENTICATION_ERROR') {
//               this.shared.setAuthError();
//               this.router.navigate(['/']);
//               this.closeDialog();
//             }
//           }, error => {
//               this.showSpinner = false;
//               this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
//           });
//       }
//     });
//   }

//   getAccountInfo() {
//     const params = new HttpParams()
//       .append('webUserId', this.webUserId)
//       .append('userId', this.userId)
//       .append('zone', this.zone)
//       .append('updateAction', '4')
//       .append('token', this.appUser.identity.Token)
//       .append('accountNbr', this.account.custId)
//       .append('fleetId', this.account.fleetId)
//       .append('application', this.shared.appInit.application.toString());

//     this.showSpinner = true;
//     // tslint:disable-next-line: max-line-length
//     this.http.get(this.shared.appInit.apiPath + 'accountprofile', {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//         this.showSpinner = false;
//         if (response.errorMessage) {
//           this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//           return;
//         }

//         const data = JSON.parse(response.body);
//         if (data.status === 'OK') {
//           this.profile = data.account;
//           this.formatAccountInfo();
//         } else if (data.status === 'AUTHENTICATION_ERROR') {
//           this.shared.setAuthError();
//           this.router.navigate(['/']);
//           this.closeDialog();
//         }
//       }, error => {
//         this.showSpinner = false;
//         this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
//       });
//   }

//   updateAccountInfo() {
//     const params = new HttpParams()
//       .append('webUserId', this.webUserId)
//       .append('userId', this.userId)
//       .append('zone', this.zone)
//       .append('updateAction', '5')
//       .append('token', this.appUser.identity.Token)
//       .append('accountNbr', this.account.custId)
//       .append('fleetId', this.account.fleetId)
//       .append('attn', this.profile.attn)
//       .append('phone', this.profile.phone)
//       .append('addr1', this.profile.addr1)
//       .append('addr2', this.profile.addr2)
//       .append('city', this.profile.city)
//       .append('state', this.profile.state)
//       .append('zip', this.profile.zip)
//       .append('fax', this.profile.fax)
//       .append('billAttn', this.profile.billAttn)
//       .append('billPhone', this.profile.billPhone)
//       .append('billAddr1', this.profile.billAddr1)
//       .append('billAddr2', this.profile.billAddr2)
//       .append('billState', this.profile.billState)
//       .append('billCity', this.profile.billCity)
//       .append('billZip', this.profile.billZip)
//       .append('billFax', this.profile.billFax)
//       .append('application', this.shared.appInit.application.toString());

//     this.showSpinner = true;
//     this.http.get(this.shared.appInit.apiPath + 'accountprofile',
//     {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//         this.showSpinner = false;
//         if (response.errorMessage) {
//           this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//           return;
//         }

//         const data = JSON.parse(response.body);
//         if (data.status === 'OK') {
//           this.profile = data.account;
//           this.formatAccountInfo();
//         } else if (data.status === 'AUTHENTICATION_ERROR') {
//           this.shared.setAuthError();
//           this.router.navigate(['/']);
//           this.closeDialog();
//         }
//       }, error => {
//         this.showSpinner = false;
//         this.shared.openMessageDialog('Update Error', error.message);
//       })
//   }

//   formatAccountInfo() {
//     this.attn = this.profile.attn !== '' ? this.profile.attn : '';
//     this.phone = this.profile.phone !== '' ? this.shared.formatPhone(this.profile.phone) : '';
//     this.address1 = this.profile.addr1 !== '' ? this.profile.addr1 : '';
//     this.address1 += this.profile.addr2 !== '' ? (', ' + this.profile.addr2) : '';
//     this.address2 = this.profile.city + ', ' + this.profile.state + ' ' + this.profile.zip;
//     this.fax = this.profile.fax !== '' ? this.shared.formatPhone(this.profile.fax) : '';

//     this.billAttn = this.profile.billAttn !== '' ? this.profile.billAttn : '';
//     this.billPhone = this.profile.billPhone !== '' ? this.shared.formatPhone(this.profile.billPhone) : '';
//     this.billAddress1 = this.profile.billAddr1 !== '' ? this.profile.billAddr1 : '';
//     this.billAddress1 += this.profile.billAddr2 !== '' ? (', ' + this.profile.billAddr2) : '';
//     this.billAddress2 = this.profile.billCity + ', ' + this.profile.billState + ' ' + this.profile.billZip;
//     this.billFax = this.profile.billFax !== '' ? this.shared.formatPhone(this.profile.billFax) : '';

//     this.showProfile = true;
//     this.showEditProfile = false;
//     (document.querySelector('.mat-dialog-container') as any).fakeScroll();
//   }
// }

// @Component({
//   selector: 'app-account-photo-dialog',
//   templateUrl: './account-photo-dialog.html',
//   styleUrls: ['./account-profile-dialog.css']
// })

// export class AccountPhotoDialogComponent implements OnInit, OnDestroy {
//   event: any;
//   croppedImage: any = '';
//   imageChangedEvent: any = '';
//   showSpinner = false;
//   webUserId: string;
//   userId: string;
//   zone: string;
//   appUser: UserData;
//   account: AccountData;

//   constructor(
//     public dialogRef: MatDialogRef<any>,
//     @Inject(MAT_DIALOG_DATA) public data: any,
//     private shared: SharedService,
//     private http: HttpClient,
//     private saveLogoService: SaveLogoService,
//     private router: Router
//   ) {}

//   ngOnInit() {
//     this.imageChangedEvent = this.data.event;
//     this.webUserId = this.data.webUserId;
//     this.userId = this.data.userId;
//     this.zone = this.data.zone;
//     this.appUser = this.data.appUser;
//     this.account = this.data.account;
//   }

//   ngOnDestroy() {

//   }

//   fileChangeEvent(event: any): void {
//     this.imageChangedEvent = event;
//   }

//   imageCropped(event: any) {
//     this.croppedImage = event.file;
//   }

//   imageLoaded() {
//     // show cropper
//   }

//   loadImageFailed() {
//     this.shared.openMessageDialog('Loading Image Failed', 'Please try again.');
//     this.dialogRef.close();
//   }

//   closeDialog(): void {
//     this.showSpinner = false;
//     this.dialogRef.close();
//     this.imageChangedEvent = '';
//     this.croppedImage = '';
//   }

//   selectAccountPhoto() {
//     const input = document.querySelector('#accountPhotoInputDialog');
//     (input as HTMLTextAreaElement).click();
//   }

//   uploadPhoto() {
//     const self = this;
//     const params = new HttpParams()
//       .append('webUserId', this.webUserId)
//       .append('userId', this.userId)
//       .append('zone', this.zone)
//       .append('updateAction', '1')
//       .append('token', this.appUser.identity.Token)
//       .append('accountNbr', this.account.custId)
//       .append('fleetId', this.account.fleetId)
//       .append('accountName', this.account.name)
//       .append('application', this.shared.appInit.application.toString());
//     this.showSpinner = true;
//     this.http.get(this.shared.appInit.apiPath + 'accountprofile',
//      {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//       if (response.errorMessage) {
//         this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//         return;
//       }

//       const data = JSON.parse(response.body);
//       if (data.status === 'OK') {
//         const url = data.url;
//         self.http.put(url, self.croppedImage, {headers: new HttpHeaders({
//           'Content-Type': 'image/png'
//         }), observe: 'response'}).subscribe((res: any) => {
//           if (res.status === 200) {
//             this.updateAccountLogo();
//           }
//         },
//         error => {
//           this.showSpinner = false;
//           this.shared.openMessageDialog('Update Error', error.message);
//         });
//       } else if (data.status === 'AUTHENTICATION_ERROR') {
//         this.shared.setAuthError();
//         this.router.navigate(['/']);
//         this.closeDialog();
//       }
//     }, error => {
//       this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
//     });
//   }

//   updateAccountLogo() {
//     const params = new HttpParams()
//       .append('webUserId', this.webUserId)
//       .append('userId', this.userId)
//       .append('zone', this.zone)
//       .append('updateAction', '3')
//       .append('token', this.appUser.identity.Token)
//       .append('accountNbr', this.account.custId)
//       .append('fleetId', this.account.fleetId)
//       .append('accountName', this.account.name)
//       .append('application', this.shared.appInit.application.toString());

//     this.http.get(this.shared.appInit.apiPath + 'accountprofile',
//     {params, withCredentials: false}).subscribe((response: ApiResponse) => {
//       this.showSpinner = false;
//       if (response.errorMessage) {
//         this.shared.openMessageDialog('Data Access Error', response.errorMessage);
//         return;
//       }

//       const data = JSON.parse(response.body);
//       if (data.status === 'OK') {
//         this.saveLogoService.save.emit();
//         this.closeDialog();
//       } else if (data.status === 'AUTHENTICATION_ERROR') {
//         this.shared.setAuthError();
//         this.router.navigate(['/']);
//         this.closeDialog();
//       }
//     }, error => {
//       this.showSpinner = false;
//       this.shared.openMessageDialog('Data Access Error', 'Something went wrong. Please try again.');
//     });
//   }
// }
