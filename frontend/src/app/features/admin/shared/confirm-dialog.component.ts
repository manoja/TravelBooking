import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="dlg dlg--sm" aria-labelledby="confirm-title" aria-describedby="confirm-msg"
      (cancel)="dismiss($event)">
      @if (confirm.request(); as r) {
        <h2 id="confirm-title">{{ r.title }}</h2>
        <p id="confirm-msg">{{ r.message }}</p>
        <div class="dlg-actions">
          <button type="button" class="btn btn--ghost" (click)="confirm.answer(false)">Cancel</button>
          <button type="button" class="btn" [class.btn--danger]="r.destructive"
            (click)="confirm.answer(true)">{{ r.confirmLabel ?? 'Confirm' }}</button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      const open = this.confirm.request() !== null;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }

  // Escape key closes a native dialog; treat it as "Cancel".
  protected dismiss(event: Event): void {
    event.preventDefault();
    this.confirm.answer(false);
  }
}
