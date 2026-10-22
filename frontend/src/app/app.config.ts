import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience,
      },
      cacheLocation: 'localstorage',
      httpInterceptor: {
        // Only protected API calls receive the bearer token; public catalog reads stay anonymous.
        allowedList: [
          { uri: `${environment.apiUrl}/auth/*`, allowAnonymous: false },
          { uri: `${environment.apiUrl}/reservations*`, allowAnonymous: false },
          { uri: `${environment.apiUrl}/payments/*`, allowAnonymous: false },
          { uri: `${environment.apiUrl}/saved-searches*`, allowAnonymous: false },
          { uri: `${environment.apiUrl}/admin/*`, allowAnonymous: false },
        ],
      },
    }),
    provideHttpClient(withInterceptors([authHttpInterceptorFn, errorInterceptor])),
  ],
};
