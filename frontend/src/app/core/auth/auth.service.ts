import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService as Auth0 } from '@auth0/auth0-angular';
import { catchError, filter, of, switchMap } from 'rxjs';
import { UserProfile } from '../models/api.models';
import { errorMessage } from '../interceptors/error.interceptor';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth0 = inject(Auth0);
  private readonly api = inject(ApiService);

  readonly isLoading = toSignal(this.auth0.isLoading$, { initialValue: true });
  readonly isAuthenticated = toSignal(this.auth0.isAuthenticated$, { initialValue: false });

  // The role always comes from the backend profile, never from client-side token claims.
  readonly profile = signal<UserProfile | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');

  constructor() {
    this.auth0.error$.subscribe((e) => this.profileError.set(`Login failed: ${e.message}`));
    this.auth0.isAuthenticated$
      .pipe(
        filter(Boolean),
        switchMap(() =>
          this.api.me().pipe(
            catchError((e) => {
              this.profileError.set(`Profile load failed: ${errorMessage(e)}`);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((p) => this.profile.set(p));
  }

  login(returnTo = '/'): void {
    this.auth0.loginWithRedirect({ appState: { target: returnTo } }).subscribe();
  }

  logout(): void {
    this.profile.set(null);
    this.auth0.logout({ logoutParams: { returnTo: window.location.origin } }).subscribe();
  }
}
