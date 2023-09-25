import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	ElementRef,
	ViewChild,
	Inject,
	ChangeDetectorRef,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SharedService } from '../shared/shared.service';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';
import {
	TripTrackingData,
	TripTrackingResponse,
	TripDetail,
	TripDetailResponse,
} from '../shared/trip-tracking.model';
import {
	MatDatepickerModule,
	MatDatepicker,
	MatDatepickerInputEvent,
} from '@angular/material/datepicker';
import {
	MatDialog,
	MatDialogRef,
	MAT_DIALOG_DATA,
	MatPaginator,
	MatTableDataSource,
	MatSort,
	MatSortable,
} from '@angular/material';
import { MatSelectChange } from '@angular/material/select';
import { TripMap, TripMapResponse } from '../shared/trip-map.model';
import { TripEvent, TripEventResponse } from '../shared/trip-event.model';
import { ApiResponse } from '../shared/api.model';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';
import { promise } from 'protractor';
import { TripData } from '../shared/trip.model';
import { ExportService } from './export.service';

declare var H: any;

let self;

@Component({
	selector: 'app-track-trips',
	templateUrl: './track-trips.component.html',
	styleUrls: ['./track-trips.component.css'],
})
export class TrackTripsComponent implements OnInit, OnDestroy {
	trips: TripTrackingData[];
	tripsDataSource: MatTableDataSource<any> = new MatTableDataSource();
	tripDetail: TripDetail;
	altTripDetail: TripDetail;
	ALT_COMPLETION_NONE = 0;
	ALT_COMPLETION_ACTIVATE = 1;
	ALT_COMPLETION_CANCEL = 2;
	altCompletion: number = this.ALT_COMPLETION_NONE;
	@ViewChild('listBody') listBody: ElementRef;
	@ViewChild(MatPaginator) paginator: MatPaginator;
	@ViewChild('filtLastName') filtLastName: ElementRef;
	@ViewChild('filtFirstName') filtFirstName: ElementRef;
	@ViewChild(MatSort) sort: MatSort;
	status: string;
	index: number;
	pickerStartDate: Date;
	pickerEndDate: Date;
	startDate: Date;
	endDate: Date;
	navigationSubscription: Subscription;
	appUser: UserData;
	currentAccount: AccountData;
	accountIndex: number;
	showSpinner: boolean;
	confirmSubscription: Subscription;
	columnsToDisplay = [
		'status',
		'vehicleNbr',
		'eta',
		'details',
		'lastName',
		'firstName',
		'due',
		'map',
		'events',
		'activate',
		'cancel',
	];
	sorting = {
		direction: 'asc',
		column: 'dueDtTm',
	};
	minDate = new Date(2017, 9, 1);
	subscription: Subscription;

	statuses = [
		{ desc: 'Scheduled', values: ['PENDING'] },
		{ desc: 'Offering', values: ['OFFERED', 'UNASSGND'] },
		{ desc: 'Assigned', values: ['ASSIGNED'] },
		{ desc: 'At Pickup', values: ['ONSITE'] },
		{ desc: 'In Progress', values: ['PICKUP'] },
		{ desc: 'Canceled', values: ['CANCELD'] },
		{ desc: 'Killed', values: ['KILLED'] },
		{ desc: 'Completed', values: ['COMPLETE'] },
		{ desc: 'No Show', values: ['NOSHOW'] },
	];

	constructor(
		private shared: SharedService,
		private http: HttpClient,
		private router: Router,
		public dialog: MatDialog,
		private exportService: ExportService,
		private ref: ChangeDetectorRef
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
		this.setPageDefaults();
		if (this.filtLastName) {
			this.filtLastName.nativeElement.value = '';
		}
		if (this.filtFirstName) {
			this.filtFirstName.nativeElement.value = '';
		}
		this.status = '';
		this.getTripList();

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

	formatPhone(input: string) {
		return this.shared.formatPhone(input);
	}

	isWillCallFromIso(date: string) {
		return this.shared.isWillCallFromIso(date);
	}

	getTripDetail(tripNbr: number, tripDate: string) {
		this.showSpinner = true;
		this.tripDetail = new TripDetail();
		const apiPath = this.shared.appInit.apiPath;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);

		const params = new HttpParams()
			.append('tripNbr', tripNbr.toString())
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('tripDate', tripDate)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'gettripdetail', {
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
					const data: TripDetailResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						if (this.altCompletion === this.ALT_COMPLETION_NONE) {
							this.tripDetail = data.tripDetail;
						} else {
							this.altTripDetail = data.tripDetail;
							switch (this.altCompletion) {
								case this.ALT_COMPLETION_ACTIVATE:
									this.activateComplete();
									break;
								case this.ALT_COMPLETION_CANCEL:
									this.cancelComplete();
									break;
							}
						}
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
					}
					this.altCompletion = this.ALT_COMPLETION_NONE;
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

	getTripList() {
		this.showSpinner = true;
		if (this.listBody) {
			this.listBody.nativeElement.scrollTop = 0;
		}
		this.tripDetail = new TripDetail();
		const account = this.shared.currentAccount;
		const apiPath = this.shared.appInit.apiPath;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);

		if (this.subscription) {
			this.subscription.unsubscribe();
		}

		let status = '';
		if (this.status.length > 1) {
			for (let i = 0; i < this.status.length; i++) {
				status += this.status[i];
				if (i !== this.status.length - 1) {
					status += '|';
				}
			}
		} else if (this.status !== '') {
			status = this.status[0];
		}
		const params = new HttpParams()

			.append('chargeNbr', account.custId)
			.append('fleetId', account.fleetId)
			.append('zone', this.shared.appUser.zoneId)
			.append('dateStart', this.shared.formatGetDateTime(this.startDate))
			.append('dateEnd', this.shared.formatGetDateTime(this.endDate))
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('filtLastName', this.filtLastName.nativeElement.value)
			.append('filtFirstName', this.filtFirstName.nativeElement.value)
			.append('filtStatus', status)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.subscription = this.http
			.get(this.shared.appInit.apiPath + 'gettripstracking', {
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
					const data: TripTrackingResponse = JSON.parse(
						response.body
					);
					if (data.status === 'OK') {
						this.sorting = {
							direction: 'asc',
							column: 'dueDtTm',
						};
						this.trips = data.trips;
						this.trips.forEach((trip) => {
							trip.etaPending = false;
							trip.eta = null;
						});
						this.tripsDataSource.data = this.trips;
						this.tripsDataSource.paginator = this.paginator;
						this.tripsDataSource.sort = this.sort;
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

	showVehNbr(status: string, vehNbr: number) {
		if (vehNbr === 0) {
			return false;
		} else if (
			status === 'ASSIGNED' ||
			status === 'ONSITE' ||
			status === 'PICKUP' ||
			status === 'COMPLETE' ||
			status === 'NOSHOW' ||
			status === 'KILLED' ||
			status === 'CANCELD'
		) {
			return true;
		} else {
			return false;
		}
	}

	showETAButton(status: string) {
		return status === 'ASSIGNED' ? true : false;
	}

	getETA(trip: TripTrackingData) {
		// show spinner in chip
		trip.etaPending = true;
		trip.eta = null;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);
		const params = new HttpParams()
			.append('zone', this.shared.appUser.zoneId)
			.append('tripNbr', trip.tripNbr.toString())
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('tripDate', trip.dueDtTm)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'gettripdetail', {
				params,
				withCredentials: false,
			})
			.subscribe((response: ApiResponse) => {
				if (response.errorMessage) {
					trip.etaPending = false;
					this.shared.openMessageDialog(
						'Data Access Error',
						response.errorMessage
					);
					return;
				}
				const newTripData = JSON.parse(response.body).tripDetail;
				trip.vehLat = newTripData.vehLat;
				trip.vehLng = newTripData.vehLng;

				this.callHereAPI(trip);
			});
	}

	callHereAPI(trip: TripTrackingData) {
		const platform = new H.service.Platform({
			app_id: 'l99VnaWJE2j4zyziRt8k',
			app_code: 'AZjJfTMZ-Or0ytHvLxTIfg',
		});

		platform.setUseHTTPS(true);

		const routingParameters = {
			mode: 'fastest;car;traffic:enabled',
			waypoint0: `geo!${trip.vehLat},${trip.vehLng}`,
			waypoint1: `geo!${trip.pkupLat},${trip.pkupLng}`,
		};

		const routing = platform.getRoutingService();
		routing.calculateRoute(
			routingParameters,
			(result: any) => {
				if (result.response != null) {
					const route = result.response.route[0];
					const eta = route.summary.travelTime / 60;
					trip.eta = Math.floor(eta);
				}
				trip.etaPending = false;
				// This is called so the table refreshes with the updated data
				this.ref.detectChanges();
			},
			(error: any) => {
				trip.etaPending = false;
			}
		);
	}

	sortData(column: string) {
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

		if (column === 'status') {
			this.sortStatus();
		} else if (column === 'dueDtTm') {
			this.sortDate();
		} else {
			if (this.sorting.direction === 'asc') {
				this.tripsDataSource.data = this.tripsDataSource.data.sort(
					(a, b) => {
						if (a[column] < b[column]) {
							return -1;
						}
						if (a[column] > b[column]) {
							return 1;
						}
						return 0;
					}
				);
			} else {
				this.tripsDataSource.data = this.tripsDataSource.data.sort(
					(a, b) => {
						if (a[column] < b[column]) {
							return 1;
						}
						if (a[column] > b[column]) {
							return -1;
						}
						return 0;
					}
				);
			}
		}
	}

	sortStatus() {
		if (this.sorting.direction === 'asc') {
			this.tripsDataSource.data = this.tripsDataSource.data.sort(
				(a, b) => {
					if (
						this.getStatusDisplay(a.status) <
						this.getStatusDisplay(b.status)
					) {
						return -1;
					}
					if (
						this.getStatusDisplay(a.status) >
						this.getStatusDisplay(b.status)
					) {
						return 1;
					}
					return 0;
				}
			);
		} else {
			this.tripsDataSource.data = this.tripsDataSource.data.sort(
				(a, b) => {
					if (
						this.getStatusDisplay(a.status) <
						this.getStatusDisplay(b.status)
					) {
						return 1;
					}
					if (
						this.getStatusDisplay(a.status) >
						this.getStatusDisplay(b.status)
					) {
						return -1;
					}
					return 0;
				}
			);
		}
	}

	sortDate() {
		if (this.sorting.direction === 'asc') {
			this.tripsDataSource.data = this.tripsDataSource.data.sort(
				(a, b) => {
					if (new Date(a.dueDtTm) < new Date(b.dueDtTm)) {
						return -1;
					}
					if (new Date(a.dueDtTm) > new Date(b.dueDtTm)) {
						return 1;
					}
					return 0;
				}
			);
		} else {
			this.tripsDataSource.data = this.tripsDataSource.data.sort(
				(a, b) => {
					if (new Date(a.dueDtTm) < new Date(b.dueDtTm)) {
						return 1;
					}
					if (new Date(a.dueDtTm) > new Date(b.dueDtTm)) {
						return -1;
					}
					return 0;
				}
			);
		}
	}

	getStatusDisplay(status: string) {
		let display = '';
		this.statuses.forEach((item) => {
			if (item.values.includes(status)) {
				display = item.desc;
			}
		});

		return display;
	}

	onStartDate(event: MatDatepickerInputEvent<Date>) {
		this.pickerStartDate = new Date(event.value);
		this.startDate = event.value;
		this.startDate.setHours(0);
		this.startDate.setMinutes(0);
		this.startDate.setSeconds(0);
		this.setPageDefaults();
		this.getTripList();
	}

	onEndDate(event: MatDatepickerInputEvent<Date>) {
		this.pickerEndDate = new Date(event.value);
		this.endDate = event.value;
		this.endDate.setHours(23);
		this.endDate.setMinutes(59);
		this.endDate.setSeconds(59);
		this.setPageDefaults();
		this.getTripList();
	}

	onFilter() {
		this.getTripList();
	}

	onStatus(event: MatSelectChange) {
		this.setPageDefaults();
		this.status = event.value;
		this.getTripList();
	}

	setPageDefaults() {
		this.showSpinner = false;
		this.tripDetail = new TripDetail();
	}

	openMapDialog(tripNbr: number, tripDate: string): void {
		const dialogRef = this.dialog.open(MapDialogComponent, {
			width: '650px',
			height: '750px',
			data: {
				tripNbr,
				tripDate,
			},
			panelClass: 'mat-elevation-z5',
		});
	}

	openEventsDialog(tripNbr: number, tripDate: string): void {
		const dialogRef = this.dialog.open(EventsDialogComponent, {
			width: '900px',
			height: '650px',
			data: {
				tripNbr,
				tripDate,
			},
			panelClass: 'mat-elevation-z5',
		});
	}

	openDetailsDialog(tripNbr: number, tripDate: string): void {
		const dialogRef = this.dialog.open(DetailsDialogComponent, {
			width: '1000px',
			height: '700px',
			data: {
				tripNbr,
				tripDate,
				currentAccount: this.currentAccount,
			},
			panelClass: 'mat-elevation-z5',
		});
	}

	onActivate(tripNbr: number, tripDate: string) {
		this.showSpinner = true;
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', tripNbr.toString())
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(apiPath + 'activatetrip', { params, withCredentials: false })
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
					const data: { status: string } = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.altCompletion = this.ALT_COMPLETION_ACTIVATE;
						this.getTripDetail(tripNbr, tripDate);
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
					} else {
						this.shared.openMessageDialog(
							'Activate Trip',
							`Trip #${tripNbr} not activated. Please contact ${this.shared.currentAccount.fleetName}.`
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

	activateComplete() {
		this.shared.openMessageDialog(
			'Activate Trip',
			`Trip activated for:<br /><br />
        Name:&nbsp;&nbsp;${
			this.altTripDetail.firstName + ' ' + this.altTripDetail.lastName
		}<br />
        Date/Time:&nbsp;&nbsp;${this.shared.displayDateTime(
			this.altTripDetail.dueDtTm
		)}`
		);
		this.getTripList();
	}

	onCancel(tripNbr: number, cancelPending: boolean, tripDate: string) {
		if (cancelPending) {
			return;
		}

		const dialog = this.shared.openConfirmDialog(
			'Cancel Confirmation',
			`Do you want to cancel Trip Nbr ${tripNbr}?`
		);
		this.confirmSubscription = dialog.componentInstance.Choice.subscribe(
			(confirm: boolean) => {
				if (confirm) {
					this.showSpinner = true;
					const apiPath = this.shared.appInit.apiPath;
					const params = new HttpParams()
						.append('tripNbr', tripNbr.toString())
						.append('zone', this.shared.appUser.zoneId)
						.append('token', this.shared.appUser.identity.Token)
						.append('userId', this.shared.appUser.userId)
						.append(
							'webUserId',
							this.shared.appUser.webUserId.toString()
						)
						.append(
							'application',
							this.shared.appInit.application.toString()
						);
					this.http
						.get(this.shared.appInit.apiPath + 'canceltrip', {
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
								const data: { status: string } = JSON.parse(
									response.body
								);
								if (data.status === 'OK') {
									this.altCompletion = this.ALT_COMPLETION_CANCEL;
									this.getTripDetail(tripNbr, tripDate);
								} else if (
									data.status === 'AUTHENTICATION_ERROR'
								) {
									this.shared.setAuthError();
									this.router.navigate(['/']);
								} else {
									this.shared.openMessageDialog(
										'Cancel Trip',
										`Trip #${tripNbr} not canceled. Please contact ${this.shared.currentAccount.fleetName}.`
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
		);
	}

	cancelComplete() {
		this.shared.openMessageDialog(
			'Cancel Trip',
			`Cancel Trip request has been sent for:<br /><br />
       Name:&nbsp;&nbsp;${
			this.altTripDetail.firstName + ' ' + this.altTripDetail.lastName
		}<br />
       Date/Time:&nbsp;&nbsp;${this.shared.displayDateTime(
			this.altTripDetail.dueDtTm
		)}`
		);
		this.getTripList();
	}

	exportTripDetails() {
		this.showSpinner = true;
		const account = this.shared.currentAccount;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);

		const params = new HttpParams()
			.append('chargeNbr', account.custId)
			.append('fleetId', account.fleetId)
			.append('zone', this.shared.appUser.zoneId)
			.append('dateStart', this.shared.formatGetDateTime(this.startDate))
			.append('dateEnd', this.shared.formatGetDateTime(this.endDate))
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('filtLastName', this.filtLastName.nativeElement.value)
			.append('filtFirstName', this.filtFirstName.nativeElement.value)
			.append('filtStatus', this.status)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http

			.get(this.shared.appInit.apiPath + 'exporttripdetails', {
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
						const trips = data.trips;
						const filename = data.filename;
						const headers = [
							'Confirmation Number',
							'Pick-Up Time',
							'Account Number',
							'Pick-Up Address',
							'Drop-Off Address',
							'Name',
							'Phone Number',
							'Number of Passengers',
							'Comments',
							'Created By',
						];
						this.exportService.exportExcel(
							trips,
							filename,
							headers
						);
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
}

@Component({
	selector: 'app-map-dialog',
	templateUrl: './map-dialog.html',
	styleUrls: ['./track-trips.component.css'],
})
export class MapDialogComponent implements OnInit {
	@ViewChild('gMap') gmapElement: any;
	tripNbr: number;
	tripDate: string;
	tripMap;
	gMap;
	gRouteShape: string[];
	showSpinner = false;
	gPlatform;

	constructor(
		private shared: SharedService,
		public dialogRef: MatDialogRef<MapDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.tripNbr = this.data.tripNbr;
		this.tripDate = this.data.tripDate;
		this.getTripMap(this.tripNbr, this.tripDate);
	}

	closeDialog(): void {
		this.dialogRef.close();
	}

	getTripMap(tripNbr: number, tripDate: string) {
		this.gmapElement.nativeElement.innerHTML = '';
		this.showSpinner = true;
		if (this.gMap != null) {
			this.gMap = null;
		}
		if (this.gPlatform != null) {
			this.gPlatform = null;
		}
		this.tripMap = new TripMap();
		const apiPath = this.shared.appInit.apiPath;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);

		const params = new HttpParams()
			.append('zone', this.shared.appUser.zoneId)
			.append('tripNbr', tripNbr.toString())
			.append('tripDate', this.tripDate)
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'gettripmap', {
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
					const data: TripMapResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.tripMap = data.tripMap;
						this.initializeMap();
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

	initializeMap() {
		if (this.tripMap.destLat !== 0 && this.tripMap.destLng !== 0) {
			this.tripMap.centerLat =
				(this.tripMap.pkupLat + this.tripMap.destLat) / 2;
			this.tripMap.centerLng =
				(this.tripMap.pkupLng + this.tripMap.destLng) / 2;
		} else {
			this.tripMap.centerLat = this.tripMap.pkupLat;
			this.tripMap.centerLng = this.tripMap.pkupLng;
		}

		this.gPlatform = new H.service.Platform({
			app_id: 'l99VnaWJE2j4zyziRt8k',
			app_code: 'AZjJfTMZ-Or0ytHvLxTIfg',
		});

		this.gPlatform.setUseHTTPS(true);

		const defaultLayers = this.gPlatform.createDefaultLayers();

		this.gMap = new H.Map(
			this.gmapElement.nativeElement,
			defaultLayers.terrain.map,
			{
				zoom: 12,
				center: {
					lat: this.tripMap.centerLat,
					lng: this.tripMap.centerLng,
				},
			}
		);

		const routingParameters = {
			mode: 'fastest;car',
			waypoint0: `geo!${this.tripMap.pkupLat},${this.tripMap.pkupLng}`,
			waypoint1: `geo!${this.tripMap.destLat},${this.tripMap.destLng}`,
			representation: 'display',
		};

		const router = this.gPlatform.getRoutingService();

		self = this;

		router.calculateRoute(routingParameters, this.onRoute, (error) => {
			alert(error.message);
		});
	}

	onRoute(result) {
		if (result.response.route) {
			self.gRouteShape = result.response.route[0].shape;
		}

		const lineString = new H.geo.LineString();

		self.gRouteShape.forEach((point) => {
			const parts = point.split(',');
			lineString.pushLatLngAlt(parts[0], parts[1]);
		});

		const routeLine = new H.map.Polyline(lineString, {
			style: { strokeColor: 'rgb(66, 100, 180)', lineWidth: 4 },
		});

		const startMarker = new H.map.Marker(
			{
				lat: self.tripMap.pkupLat,
				lng: self.tripMap.pkupLng,
			},
			{ icon: new H.map.Icon('../../assets/images/pkup.png'), zIndex: 10 }
		);

		const endMarker = new H.map.Marker(
			{
				lat: self.tripMap.destLat,
				lng: self.tripMap.destLng,
			},
			{ icon: new H.map.Icon('../../assets/images/dest.png'), zIndex: 10 }
		);

		self.gMap.addObjects([routeLine, startMarker, endMarker]);

		if (
			self.tripStatusActive(self.tripMap.status) &&
			self.tripMap.vehLat !== 0 &&
			self.tripMap.vehLng !== 0
		) {
			const vehMarker = new H.map.Marker(
				{
					lat: self.tripMap.vehLat,
					lng: self.tripMap.vehLng,
				},
				{
					icon: new H.map.Icon('../../assets/images/cab.png'),
					zIndex: 20,
				}
			);
			self.gMap.addObject(vehMarker);
		}
		self.fitMapBounds();
	}

	tripStatusActive(status: string) {
		return (
			status === 'ASSIGNED' ||
			status === 'ONSITE' ||
			status === 'PICKUP' ||
			status === 'UNASSGND'
		);
	}

	fitMapBounds() {
		const points = [];
		// create some space around the pickup, so that the map displays properly
		points.push(
			new H.geo.Point(
				self.tripMap.pkupLat - 0.005,
				self.tripMap.pkupLng - 0.005
			)
		);
		points.push(
			new H.geo.Point(
				self.tripMap.pkupLat + 0.005,
				self.tripMap.pkupLng + 0.005
			)
		);
		// if exists, create space around destination
		if (self.tripMap.destLat !== 0 && self.tripMap.destLng !== 0) {
			points.push(
				new H.geo.Point(
					self.tripMap.destLat - 0.005,
					self.tripMap.destLng - 0.005
				)
			);
			points.push(
				new H.geo.Point(
					self.tripMap.destLat + 0.005,
					self.tripMap.destLng + 0.005
				)
			);
		}
		// if exists, create space around vehicle
		if (
			self.tripStatusActive(self.tripMap.status) &&
			self.tripMap.vehLat !== 0 &&
			self.tripMap.vehLng !== 0
		) {
			points.push(
				new H.geo.Point(
					self.tripMap.vehLat - 0.005,
					self.tripMap.vehLng - 0.005
				)
			);
			points.push(
				new H.geo.Point(
					self.tripMap.vehLat + 0.005,
					self.tripMap.vehLng + 0.005
				)
			);
		}
		// create some space around the route
		self.gRouteShape.forEach((point) => {
			const parts = point.split(',');
			points.push(
				new H.geo.Point(
					parseFloat(parts[0]) + 0.005,
					parseFloat(parts[1]) + 0.005
				)
			);
		});
		const bounds = new H.geo.Rect.coverPoints(points);
		self.gMap.setViewBounds(bounds);
	}

	showUpdateButton() {
		return (
			this.tripMap.status === 'UNASSGND' ||
			this.tripMap.status === 'OFFERED' ||
			this.tripMap.status === 'ASSIGNED' ||
			this.tripMap.status === 'ONSITE' ||
			this.tripMap.status === 'PICKUP'
		);
	}

	updateMap() {
		this.getTripMap(this.tripNbr, this.tripDate);
	}
}

@Component({
	selector: 'app-events-dialog',
	templateUrl: './events-dialog.html',
	styleUrls: ['./track-trips.component.css'],
})
export class EventsDialogComponent implements OnInit {
	tripNbr: number;
	tripDate: string;
	events: TripEvent[];
	showSpinner = false;
	columnsToDisplay = ['date', 'desc', 'status', 'vehNbr'];

	constructor(
		private shared: SharedService,
		public dialogRef: MatDialogRef<MapDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.tripNbr = this.data.tripNbr;
		this.tripDate = this.data.tripDate;
		this.getTripEvents(this.tripNbr, this.tripDate);
	}

	closeDialog(): void {
		this.dialogRef.close();
	}

	getTripEvents(tripNbr: number, tripDate: string) {
		this.showSpinner = true;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);
		const apiPath = this.shared.appInit.apiPath;
		const params = new HttpParams()
			.append('tripNbr', tripNbr.toString())
			.append('tripDate', tripDate)
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'gettripevents', {
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
					const data: TripEventResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.events = data.tripEvents;
						(document.querySelector(
							'#events-table-wrapper'
						) as any).fakeScroll();
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
@Component({
	selector: 'app-details-dialog',
	templateUrl: './details-dialog.html',
	styleUrls: ['./track-trips.component.css'],
})
export class DetailsDialogComponent implements OnInit {
	tripNbr: number;
	tripDate: string;
	showSpinner: boolean;
	tripDetail: TripDetail;
	altTripDetail: TripDetail;
	currentAccount: AccountData;
	ALT_COMPLETION_NONE = 0;
	ALT_COMPLETION_ACTIVATE = 1;
	ALT_COMPLETION_CANCEL = 2;
	altCompletion: number = this.ALT_COMPLETION_NONE;

	constructor(
		private shared: SharedService,
		public dialogRef: MatDialogRef<any>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private http: HttpClient,
		private router: Router
	) {}

	ngOnInit() {
		this.showSpinner = false;
		this.tripNbr = this.data.tripNbr;
		this.tripDate = this.data.tripDate;
		this.currentAccount = this.data.currentAccount;
		this.getTripDetails(this.tripNbr, this.tripDate);
	}

	closeDialog(): void {
		this.dialogRef.close();
	}

	getTripDetails(tripNbr: number, tripDate: string) {
		this.showSpinner = true;
		this.tripDetail = new TripDetail();
		const apiPath = this.shared.appInit.apiPath;
		const currentDate = new Date();
		currentDate.setHours(0);
		currentDate.setMinutes(0);
		currentDate.setSeconds(0);
		const params = new HttpParams()
			.append('tripNbr', tripNbr.toString())
			.append('currentDate', this.shared.formatGetDateTime(currentDate))
			.append('tripDate', tripDate)
			.append('zone', this.shared.appUser.zoneId)
			.append('token', this.shared.appUser.identity.Token)
			.append('userId', this.shared.appUser.userId)
			.append('application', this.shared.appInit.application.toString());
		this.http
			.get(this.shared.appInit.apiPath + 'gettripdetail', {
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
					const data: TripDetailResponse = JSON.parse(response.body);
					if (data.status === 'OK') {
						this.tripDetail = data.tripDetail;
						// if (this.altCompletion === this.ALT_COMPLETION_NONE) {
						// 	this.tripDetail = data.tripDetail;
						// } else {
						// 	this.altTripDetail = data.tripDetail;
						// 	switch (this.altCompletion) {
						// 		case this.ALT_COMPLETION_ACTIVATE:
						// 			this.trackTrips.activateComplete();
						// 			break;
						// 		case this.ALT_COMPLETION_CANCEL:
						// 			this.trackTrips.cancelComplete();
						// 			break;
						// 	}
						// }
					} else if (data.status === 'AUTHENTICATION_ERROR') {
						this.shared.setAuthError();
						this.router.navigate(['/']);
						this.closeDialog();
					}
					// this.altCompletion = this.ALT_COMPLETION_NONE;
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

	formatPhone(input: string) {
		return this.shared.formatPhone(input);
	}
}
