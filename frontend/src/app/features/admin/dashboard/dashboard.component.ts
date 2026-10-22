import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AdminStatsService } from '../shared/admin-stats.service';
import { statusTone } from '../shared/status-tone';

interface StatusCount {
  status: string;
  count: number;
  tone: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [MoneyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly stats = inject(AdminStatsService);
  private readonly auth = inject(AuthService);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const first = this.auth.profile()?.name?.split(/\s+/)[0];
    return `Good ${part}, ${first || 'Admin'}`;
  });

  protected readonly statusCounts = computed<StatusCount[]>(() => {
    const by = this.stats.dashboard()?.reservations_by_status ?? {};
    return Object.entries(by).map(([status, count]) => ({
      status,
      count,
      tone: statusTone(status),
    }));
  });

  protected retry(): void {
    this.stats.refresh();
  }
}
