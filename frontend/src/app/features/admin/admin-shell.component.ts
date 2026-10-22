import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ViewEncapsulation } from '@angular/core';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AdminStatsService } from './shared/admin-stats.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ToastHostComponent } from './shared/toast-host.component';

interface NavItem {
  path: string;
  label: string;
  glyph: string;
}

const NAV: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', glyph: '▦' },
  { path: 'destinations', label: 'Destinations', glyph: '◎' },
  { path: 'hotels', label: 'Hotels', glyph: '⌂' },
  { path: 'rooms', label: 'Rooms', glyph: '▭' },
  { path: 'reservations', label: 'Reservations', glyph: '✓' },
  { path: 'settings', label: 'Settings', glyph: '⚙' },
];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Shell styles are global to the admin area so every admin page shares one design system.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin.scss',
})
export class AdminShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly stats = inject(AdminStatsService);
  private readonly router = inject(Router);

  protected readonly nav = NAV;
  protected readonly navOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly section = computed(() => {
    const segment = this.url().split('?')[0].split('/').filter(Boolean)[1] ?? 'dashboard';
    return NAV.find((n) => n.path === segment)?.label ?? 'Dashboard';
  });

  protected readonly displayName = computed(() => {
    const p = this.auth.profile();
    return p?.name || p?.email || 'Admin';
  });

  protected readonly initials = computed(() =>
    this.displayName()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  constructor() {
    this.stats.refresh();
  }

  protected toggleNav(): void {
    this.navOpen.update((v) => !v);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }
}
