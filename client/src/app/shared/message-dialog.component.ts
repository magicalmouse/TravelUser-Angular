import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';

@Component({
	selector: 'app-message-dialog',
	template: ` <div style="font-family: 'Avenir'">
		<div class="content-title">
			{{ title }}
		</div>
		<div
			style="width: 350px; height: 100px; display: block; overflow: auto;"
			[innerHTML]="message"
		></div>
		<div>
			<button
				class="standard-button message-button"
				mat-raised-button
				(click)="closeDialog()"
			>
				OK
			</button>
		</div>
	</div>`,
	styles: ['.message-button { margin: 16px 0px 0px 270px; }'],
})
export class MessageDialogComponent {
	title: string;
	message: string;

	constructor(
		public dialogRef: MatDialogRef<MessageDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any
	) {
		this.title = data.title;
		this.message = data.message;
	}

	closeDialog(): void {
		this.dialogRef.close();
	}
}
