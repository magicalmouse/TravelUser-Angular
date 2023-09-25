import { Component, OnInit } from '@angular/core';
import { SharedService } from '../shared/shared.service';
import { InvoiceData } from '../shared/invoice.model';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserData } from '../shared/user.model';
import { AccountData } from '../shared/account.model';

@Component({
  selector: 'app-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css']
})
export class InvoiceComponent implements OnInit {
  appUser: UserData;
  currentAccount: AccountData;
  navigationSubscription: Subscription;

  invoices: InvoiceData[] = [
    { refNbr: '005098', crtdDateTime: '2018-06-08T13:09:00.000Z', origDocAmt: 243.9, docBal: 243.9, docType: 'IN', docDate: '2018-05-31T00:00:00.000Z',	cpnyID: 'CYC2', custID: '10137', dueDate: '2018-06-30T00:00:00.000Z' }
  ]

  constructor(
    private router: Router,
    private shared: SharedService,
    private http: HttpClient) {
      this.navigationSubscription = this.router.events.subscribe((e: any) => {
        // If it is a NavigationEnd event re-initalise the component
        if (e instanceof NavigationEnd) {
          this.ngOnInit();
        }
      });}

  ngOnInit() {
    this.appUser = this.shared.appUser;
    this.currentAccount = this.shared.currentAccount;
  }

  onView(refNbr: string) {

  }

  displayDateTime(date: string) {
    return this.shared.displayDateTime(date);
  }

  displayDate(date: string) {
    return this.shared.displayDate(date);
  }
}
