import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (!inAdmin()) {
    <header class="nav">
      <a routerLink="/" class="brand">Travel Booking</a>
      <nav>
        <a routerLink="/destinations" routerLinkActive="active">Destinations</a>
        <a routerLink="/rooms" routerLinkActive="active">Find rooms</a>
        @if (auth.isAuthenticated()) {
          <a routerLink="/reservations" routerLinkActive="active">My reservations</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          }
        }
      </nav>
      <div class="user">
        @if (auth.isAuthenticated()) {
          <span>{{ auth.profile()?.name || auth.profile()?.email }}</span>
          <button type="button" (click)="auth.logout()">Log out</button>
        } @else {
          <button type="button" (click)="auth.login()">Log in</button>
        }
      </div>
    </header>
    }
    <main [class.admin-host]="inAdmin()">
      @if (auth.profileError(); as err) { <p class="autherr">{{ err }}</p> }
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // The admin area renders its own sidebar and top bar.
  protected readonly inAdmin = computed(() => this.url().startsWith('/admin'));
}
