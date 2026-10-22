import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Page, Reservation } from '../../../core/models/api.models';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
import { ApiService } from '../../../core/services/api.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { statusTone } from '../shared/status-tone';

const STATUSES = ['pending', 'confirmed', 'cancelled', 'expired'];

@Component({
  selector: 'app-admin-reservations',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservations.component.html',
})
export class AdminReservationsComponent {
  private readonly api = inject(ApiService);

  protected readonly statuses = STATUSES;
  protected readonly status = signal('');
  protected readonly page = signal(1);
  private readonly tick = signal(0);
  protected readonly data = signal<Page<Reservation> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly hasFilters = computed(() => !!this.status());

  constructor() {
    toObservable(
      computed(() => ({ status: this.status(), page: this.page(), tick: this.tick() })),
    )
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((p) =>
          this.api.adminReservations(p.page, p.status).pipe(
            catchError((e) => {
              this.error.set(errorMessage(e));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) this.data.set(result);
      });
  }

  protected tone(status: string): string {
    return statusTone(status);
  }

  protected setStatus(value: string): void {
    this.status.set(value);
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.setStatus('');
  }

  protected goTo(page: number): void {
    this.page.set(page);
  }

  protected reload(): void {
    this.tick.update((t) => t + 1);
  }
}
