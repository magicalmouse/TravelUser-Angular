import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { UserData } from './user.model';
import { AppInitData } from './app-init.model';
import { AccountData } from './account.model';
import { MatDialog, MatDialogRef } from '@angular/material';
import { MessageDialogComponent } from '../shared/message-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { PageData } from './page.model';

@Injectable()
export class SharedService {
	public appInit: AppInitData;
	public appUser: UserData;
	public accountIndex: number;
	public accountIndexSet = new Subject<number>();
	public pageIdSet = new Subject<number>();
	public authErrorSet = new Subject();
	public activationCompletedSet = new Subject();
	public resetPasswordSet = new Subject();
	public secret: string;
	public breadCrumbs: string = null;

	CRUD_ACTION_CREATE = 'C';
	CRUD_ACTION_READ = 'R';
	CRUD_ACTION_UPDATE = 'U';
	CRUD_ACTION_DELETE = 'D';

	get currentAccount(): AccountData {
		return this.appUser.accounts[this.accountIndex];
	}

	constructor(private dialog: MatDialog) {}

	setAccountIndex(index: number) {
		localStorage.setItem('accountIndex', String(index));
		this.accountIndexSet.next(index);
	}

	setPageId(index: number) {
		this.pageIdSet.next(index);
	}

	setAuthError() {
		this.authErrorSet.next();
	}

	setActivationCompleted() {
		this.activationCompletedSet.next();
	}
	resetPasswordCompleted() {
		this.resetPasswordSet.next();
	}

	getReservationPath() {
		let path = '';
		switch (this.appUser.zoneId) {
			case 'asc':
			case 'aus':
			case 'bna':
			case 'cle':
			case 'clt':
			case 'co':
			case 'cyc':
			case 'gai':
			case 'iad':
			case 'mco':
			case 'mem':
			case 'msp':
			case 'odo':
			case 'pbi':
			case 'rdu':
			case 'rsw':
			case 'san':
			case 'sdf':
			case 'ccsi':
				path = this.appInit.ccsiReservationPath;
				break;
			case 'b&l':
			case 'gos':
			case 'tlh':
			case 'tpa':
			case 'bnl':
				path = this.appInit.bnlReservationPath;
				break;
		}
		return path;
	}

	formatGetDateTime(date: Date) {
		// const d =
		//     date.getUTCFullYear() + '-' +
		//     (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-' +
		//     date.getUTCDate().toString().padStart(2, '0') + 'T' +
		//     date.getUTCHours().toString().padStart(2, '0') + ':' +
		//     date.getUTCMinutes().toString().padStart(2, '0') + ':' +
		//     date.getUTCSeconds().toString().padStart(2, '0') + '.000Z';
		// return d;
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const seconds = date.getSeconds().toString().padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
		// YYYY-MM-DD HH:MI:SS
	}

	displayDate(date: string): string {
		if (date === '') {
			return '';
		}
		const dt = new Date(date);
		const d =
			(dt.getUTCMonth() + 1).toString().padStart(2, '0') +
			'/' +
			dt.getUTCDate().toString().padStart(2, '0') +
			'/' +
			dt.getUTCFullYear();
		return d;
	}

	displayDateTime(date: string): string {
		if (date === '') {
			return '';
		}
		const dt = new Date(date);
		let d =
			(dt.getUTCMonth() + 1).toString().padStart(2, '0') +
			'/' +
			dt.getUTCDate().toString().padStart(2, '0') +
			'/' +
			dt.getUTCFullYear() +
			' ';
		if (this.isWillCall(dt)) {
			// handle will call trips
			d += '(will call)';
		} else {
			d +=
				this.getAmPmHour(dt).padStart(2, '0') +
				':' +
				dt.getUTCMinutes().toString().padStart(2, '0') +
				' ' +
				this.getAmPm(dt);
		}
		return d;
	}

	isWillCallFromIso(date: string) {
		const dt = new Date(date);
		return this.isWillCall(dt);
	}

	isWillCall(date: Date) {
		return date.getUTCHours() === 23 && date.getUTCMinutes() === 47;
	}

	nbrDisplay(nbr: number): string {
		if (nbr < 1) {
			return '';
		}
		return nbr.toString();
	}

	nameDisplay(lastName: string, firstName: string) {
		let name = '';
		if (lastName !== '') {
			name += lastName;
		}
		if (lastName !== '' && firstName !== '') {
			name += ', ';
		}
		if (firstName !== '') {
			name += firstName;
		}
		return name;
	}

	formatPhone(input: string): string {
		const output = this.unformatPhone(input).split('');
		if (output.length === 10) {
			output.splice(3, 0, '.');
			output.splice(7, 0, '.');
		}
		return output.join('');
	}

	unformatPhone(input: string): string {
		const chars = input.split('');
		let output = '';
		chars.forEach((char: string) => {
			if (output.length < 10) {
				if (!isNaN(parseInt(char, 10))) {
					output += char;
				}
			}
		});
		return output;
	}

	addressDisplay(strNbr: string, strName: string, city: string): string {
		let addr = '';
		if (strNbr !== '' && strName !== '') {
			addr += strNbr + ' ' + strName;
		}
		if (addr !== '' && city !== '') {
			addr += ', ';
		}
		if (city !== '') {
			addr += city;
		}
		return addr;
	}

	private getAmPmHour(dt: Date): string {
		const hour = dt.getUTCHours();
		if (hour === 0) {
			return '12';
		} else if (hour < 13) {
			return hour.toString();
		} else {
			return (hour - 12).toString();
		}
	}

	private getAmPm(dt: Date): string {
		if (dt.getUTCHours() < 12) {
			return 'AM';
		} else {
			return 'PM';
		}
	}

	openMessageDialog(
		title: string,
		message: string
	): MatDialogRef<MessageDialogComponent, any> {
		const dialogRef = this.dialog.open(MessageDialogComponent, {
			width: '400px',
			height: '250px',
			data: { title: title, message: message },
		});
		return dialogRef;
	}

	openConfirmDialog(
		title: string,
		message: string
	): MatDialogRef<ConfirmDialogComponent, any> {
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			width: '400px',
			height: '250px',
			data: { title: title, message: message },
		});
		return dialogRef;
	}

	buildBreadCrumbs(path, appUser) {
		// build the breadcrumb trail based on what page the client
		// is currently on and the current account index
		this.breadCrumbs = '';
		const accountIndex = localStorage.getItem('accountIndex');
		switch (path) {
			case 'track-trips':
				this.breadCrumbs +=
					' <b>></b> Manage Trips <b>></b> ' +
					appUser.accounts[accountIndex].name;
				break;
			case 'user-profile':
				this.breadCrumbs += ' <b>></b> User Profile';
				break;
			case 'admin-tasks':
				this.breadCrumbs += ' <b>></b> Manage Users';
				break;
			case 'phone-booking':
				this.breadCrumbs +=
					' <b>></b> Phone Booking Authorization <b>></b> ' +
					appUser.accounts[accountIndex].name;
				break;
			case 'mobile-app-booking':
				this.breadCrumbs +=
					' <b>></b> Mobile App Booking Authorization <b>></b> ' +
					appUser.accounts[accountIndex].name;
				break;
			default:
				this.breadCrumbs = null;
		}
	}
}
