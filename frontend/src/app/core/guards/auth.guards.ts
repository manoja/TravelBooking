import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService as Auth0 } from '@auth0/auth0-angular';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { ApiService } from '../services/api.service';

// Wait for the Auth0 SDK to finish initialising, then emit the authenticated flag.
function authenticated$(auth0: Auth0) {
  return auth0.isLoading$.pipe(
    filter((loading) => !loading),
    take(1),
    switchMap(() => auth0.isAuthenticated$.pipe(take(1))),
  );
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth0 = inject(Auth0);
  return authenticated$(auth0).pipe(
    map((ok) => {
      if (!ok) auth0.loginWithRedirect({ appState: { target: state.url } }).subscribe();
      return ok;
    }),
  );
};

// UX only: the API independently enforces admin authorization.
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth0 = inject(Auth0);
  const router = inject(Router);
  const api = inject(ApiService);
  return authenticated$(auth0).pipe(
    switchMap((ok) => {
      if (!ok) {
        auth0.loginWithRedirect({ appState: { target: state.url } }).subscribe();
        return of(false);
      }
      // Only a definite non-admin profile is redirected; transient errors let the page show them.
      return api.me().pipe(
        map((p) => p.role === 'admin' || router.createUrlTree(['/'])),
        catchError(() => of(true)),
      );
    }),
  );
};
