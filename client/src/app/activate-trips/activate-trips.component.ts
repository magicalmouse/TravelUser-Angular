import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	OnDestroy,
} from '@angular/core';
import { TripDetail, TripDetailResponse } from '../shared/trip-tracking.model';
import { SharedService } from '../shared/shared.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { ApiResponse } from '../shared/api.model';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';

@Component({
	selector: 'app-activate-trips',
	templateUrl: './activate-trips.component.html',
	styleUrls: ['./activate-trips.component.css'],
})
export class ActivateTripsComponent implements OnInit, OnDestroy {
	@ViewChild('confirmNbr') confirmNbr: ElementRef;
	@ViewChild('comments') comments: ElementRef;
	tripDetail: TripDetail;
	showActivate: boolean;
	COMPLETION_ACTIVATE = 1;
	COMPLETION_CANCEL = 2;
	navigationSubscription: Subscription;
	appUser: UserData;
	currentAccount: AccountData;
	showSpinner: boolean;

	constructor(
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
	}

	ngOnInit() {
		this.showSpinner = false;
		this.tripDetail = new TripDetail();
		this.confirmNbr.nativeElement.value = '';
		this.appUser = this.shared.appUser;
		this.currentAccount = this.shared.currentAccount;
	}

	ngOnDestroy() {
		this.navigationSubscription.unsubscribe();
	}

	nbrDisplay(nbr: number) {
		return this.shared.nbrDisplay(nbr);
	}

	displayDateTime(date: string) {
		return this.shared.displayDateTime(date);
	}

	addressDisplay(strNbr: string, strName: string, city: string) {
		return this.shared.addressDisplay(strNbr, strName, city);
	}

	nameDisplay(lastName: string, firstName: string) {
		return this.shared.nameDisplay(lastName, firstName);
	}

	getTripDetail() {
		this.tripDetail = new TripDetail();
		if (this.confirmNbr.nativeElement.value.toString().trim().length < 1) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'Please enter a Confirmation Number'
			);
			return;
		} else if (isNaN(parseInt(this.confirmNbr.nativeElement.value))) {
			this.shared.openMessageDialog(
				'Date Entry Error',
				'Confirmation Number must be a valid number'
			);
			return;
		}
		this.showSpinner = true;
		this.showActivate = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', this.confirmNbr.nativeElement.value.toString())
			.append('custId', this.shared.currentAccount.custId)
			.append('status', 'PENDING')
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'gettripdetail', { params, withCredentials: false })
			.subscribe((response: ApiResponse) => {
				this.showSpinner = false;
				if (response.errorMessage) {
					this.shared.openMessageDialog(
						'Data Access Error',
						response.errorMessage
					);
					return;
				}
				const data: TripDetailResponse = JSON.parse(response.body);
				if (data.status === 'OK') {
					this.tripDetail = data.tripDetail;
					this.showActivate = this.shared.isWillCallFromIso(
						this.tripDetail.dueDtTm
					);
				} else if (data.status === 'AUTHENTICATION_ERROR') {
					this.shared.setAuthError();
					this.router.navigate(['/']);
				}
				if (this.tripDetail.tripNbr < 1) {
					this.shared.openMessageDialog(
						'Reservation Not Found',
						'Please check your information and try again'
					);
				}
			});
	}

	onActivate() {
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', this.confirmNbr.nativeElement.value.toString())
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'activatetrip', { params, withCredentials: false })
			.subscribe((response: ApiResponse) => {
				this.showSpinner = false;
				if (response.errorMessage) {
					this.shared.openMessageDialog(
						'Data Access Error',
						response.errorMessage
					);
					return;
				}
				const data: { status: string } = JSON.parse(response.body);
				if (data.status === 'OK') {
					this.showActivate = false;
					this.updateComments(this.COMPLETION_ACTIVATE);
				} else if (data.status === 'AUTHENTICATION_ERROR') {
					this.shared.setAuthError();
					this.router.navigate(['/']);
				} else {
					// tslint:disable-next-line:max-line-length
					this.shared.openMessageDialog(
						'Activate Trip',
						`Trip #${this.confirmNbr.nativeElement.value} not activated. Please contact ${this.shared.currentAccount.fleetName}.`
					);
				}
			});
	}

	onCancel(tripNbr: number, cancelPending: boolean) {
		if (cancelPending) {
			return;
		}
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', this.confirmNbr.nativeElement.value.toString())
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'canceltrip', { params, withCredentials: false })
			.subscribe((response: ApiResponse) => {
				this.showSpinner = false;
				if (response.errorMessage) {
					this.shared.openMessageDialog(
						'Data Access Error',
						response.errorMessage
					);
					return;
				}
				const data: { status: string } = JSON.parse(response.body);
				if (data.status === 'OK') {
					this.updateComments(this.COMPLETION_CANCEL);
				} else if (data.status === 'AUTHENTICATION_ERROR') {
					this.shared.setAuthError();
					this.router.navigate(['/']);
				} else {
					// tslint:disable-next-line:max-line-length
					this.shared.openMessageDialog(
						'Cancel Trip',
						`Trip #${tripNbr} not canceled. Please contact ${this.shared.currentAccount.fleetName}.`
					);
				}
			});
	}

	updateComments(completion: number) {
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', this.confirmNbr.nativeElement.value.toString())
			.append(
				'comments',
				this.comments.nativeElement.value.toString().trim()
			)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'updatetripcomments', {
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
				const data: { status: string } = JSON.parse(response.body);
				if (data.status === 'OK') {
					this.complete(completion, false);
				} else if (data.status === 'AUTHENTICATION_ERROR') {
					this.shared.setAuthError();
					this.router.navigate(['/']);
				} else {
					this.complete(completion, true);
				}
			});
	}

	complete(completion: number, commentUpdateError: boolean) {
		let commentError = '';
		if (commentUpdateError) {
			commentError = `
      <br /><br />
      Trip comment not updated.`;
		}
		switch (completion) {
			case this.COMPLETION_ACTIVATE:
				this.shared.openMessageDialog(
					'Activate Trip',
					`Trip activated for:<br /><br />
           Name:&nbsp;&nbsp;${
				this.tripDetail.firstName + ' ' + this.tripDetail.lastName
			}<br />
           Date/Time:&nbsp;&nbsp;${this.shared.displayDateTime(
				this.tripDetail.dueDtTm
			)}${commentError}`
				);
				break;
			case this.COMPLETION_CANCEL:
				this.shared.openMessageDialog(
					'Cancel Trip',
					`Cancel Trip request has been sent for:<br /><br />
          Name:&nbsp;&nbsp;${
				this.tripDetail.firstName + ' ' + this.tripDetail.lastName
			}<br />
          Date/Time:&nbsp;&nbsp;${this.shared.displayDateTime(
				this.tripDetail.dueDtTm
			)}${commentError}`
				);
				break;
		}
	}
}
