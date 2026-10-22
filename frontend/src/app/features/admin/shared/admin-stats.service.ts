import { Injectable, computed, inject, signal } from '@angular/core';
import { Dashboard } from '../../../core/models/api.models';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
import { ApiService } from '../../../core/services/api.service';

// Shared by the top bar (notifications) and the dashboard so both stay in sync after edits.
@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly api = inject(ApiService);

  readonly dashboard = signal<Dashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingReservations = computed(
    () => this.dashboard()?.reservations_by_status?.['pending'] ?? 0,
  );

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.adminDashboard().subscribe({
      next: (d) => {
        this.dashboard.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
