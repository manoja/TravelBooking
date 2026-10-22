import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="region" aria-label="Notifications" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast" [class.toast--error]="t.kind === 'error'"
          [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span>{{ t.message }}</span>
          <button type="button" class="icon-btn" aria-label="Dismiss notification"
            (click)="toastService.dismiss(t.id)">✕</button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);
}
