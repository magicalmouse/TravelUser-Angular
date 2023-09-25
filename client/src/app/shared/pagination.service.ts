import { Injectable } from '@angular/core';

@Injectable()
export class PaginationService {
  html = `
    <a class="page-link" *ngIf="page.firstPage > 0" 
      (click)="onPaginate(1)">[{{ page.firstPage }}]&nbsp;&nbsp;</a>
    <a class="page-link" *ngIf="page.pagePrev > 0" 
      (click)="onPaginate(page.pagePrev)">« Prev&nbsp;&nbsp;</a>
    <a [ngClass]="{'page-link': page.page1 != page.page, 'page-current': page.page1 == page.page}"
      *ngIf="page.page1 > 0" (click)="onPaginate(page.page1)">{{ page.page1 }}</a>
      <i *ngIf="page.page1 > 0"> , </i>
    <a [ngClass]="{'page-link': page.page2 != page.page, 'page-current': page.page2 == page.page}" 
      *ngIf="page.page2 > 0" (click)="onPaginate(page.page2)">{{ page.page2 }}</a>
      <i *ngIf="page.page2 > 0"> , </i>
    <a [ngClass]="{'page-link': page.page3 != page.page, 'page-current': page.page3 == page.page}" 
      *ngIf="page.page3 > 0" (click)="onPaginate(page.page3)">{{ page.page3 }}</a>
      <i *ngIf="page.page3 > 0"> , </i>
    <a [ngClass]="{'page-link': page.page4 != page.page, 'page-current': page.page4 == page.page}" 
      *ngIf="page.page4 > 0" (click)="onPaginate(page.page4)">{{ page.page4 }}</a>
      <i *ngIf="page.page4 > 0"> , </i>
    <a [ngClass]="{'page-link': page.page5 != page.page, 'page-current': page.page5 == page.page}" 
      *ngIf="page.page5 > 0" (click)="onPaginate(page.page5)">{{ page.page5 }}&nbsp;&nbsp;</a>
    <a class="page-link" *ngIf="page.pageNext > 0" 
      (click)="onPaginate(page.pageNext)">Next »&nbsp;&nbsp;</a>
    <a class="page-link" *ngIf="page.lastPage > 0" 
      (click)="onPaginate(page.numPages)">[{{ page.numPages }}]</a>
    `;

  pageLength = 0;
  numItems = 0;
  page = 0;
  numPages = 0;
  firstPage = 0;
  pagePrev = 0;
  page1 = 0;
  page2 = 0;
  page3 = 0;
  page4 = 0;
  page5 = 0;
  pageNext = 0;
  lastPage = 0;
  pageWindowTop = 0;

  constructor() {

  }

  init(pageLength: number) {
    this.pageLength = pageLength;
    this.page = 1;
    this.pageWindowTop = 5;
  }

  paginate(page: number, numItems: number) {
    this.page = page;
    this.numItems = numItems;
    this.firstPage = 0;
    this.pagePrev = 0;
    this.page1 = 0;
    this.page2 = 0;
    this.page3 = 0;
    this.page4 = 0;
    this.page5 = 0;
    this.pageNext = 0;
    this.lastPage = 0;
    if (this.numItems === 0) {
      return;
    }
    this.numPages = Math.ceil(this.numItems / this.pageLength);
    if (this.numPages === 1) {
      return;
    }
    if (this.numPages > 1) {
      if (this.pageWindowTop < this.page) {
        this.pageWindowTop = this.page;
      } else if (this.pageWindowTop > (this.page + 4)) {
        this.pageWindowTop = this.page + 4;
      }
      if (this.pageWindowTop > this.numPages) {
        this.pageWindowTop = this.numPages;
      }

      this.firstPage = this.numPages > 5 && this.page > 1 ? 1 : 0;
      this.pagePrev = this.page > 1 ? this.page - 1 : 0;
      this.page1 = this.pageWindowTop - 4;
      this.page2 = this.pageWindowTop - 3;
      this.page3 = this.pageWindowTop - 2;
      this.page4 = this.pageWindowTop - 1;
      this.page5 = this.pageWindowTop;
      this.pageNext = this.page < this.numPages ? this.page + 1 : 0;
      this.lastPage = this.numPages > 5 && this.page < this.numPages ? this.numPages : 0;
    }
  }
}