import { Component, Inject, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { MessageDialogComponent } from './message-dialog.component';
import { Subject } from 'rxjs';


@Component({
    selector: 'app-message-dialog',
    template: `
      <div style="font-family: 'Avenir'">
        <div class="content-title">
          {{ title }}
        </div>
        <div style="width: 350px; height: 100px; display: block; overflow: auto;"
          [innerHTML]="message">
        </div>
        <div style="margin-left: 150px;">
          <button class="standard-button confirm-button" mat-raised-button (click)="onYes()">
            Yes
          </button>
          <button class="standard-button confirm-button" mat-raised-button (click)="onNo()">
            No
          </button>
        </div>
      </div>`,
    styles: ['.confirm-button { margin: 16px 0px 0px 12px; }']
  })
  export class ConfirmDialogComponent {
    @Output() Choice: Subject<boolean> = new Subject<boolean>();
    title: string;
    message: string;

    constructor(
      public dialogRef: MatDialogRef<MessageDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: any) {
        this.title = data.title;
        this.message = data.message;
       }

    onYes() {
        this.Choice.next(true);
        this.closeDialog();
    }

    onNo() {
      this.Choice.next(false);
        this.closeDialog();
    }

    closeDialog(): void {
      this.dialogRef.close();
    }

  }
