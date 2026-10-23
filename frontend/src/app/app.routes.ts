import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'destinations' },
  {
    path: 'destinations',
    loadComponent: () =>
      import('./features/destinations/destinations.component').then((m) => m.DestinationsComponent),
  },
  {
    path: 'rooms',
    loadComponent: () =>
      import('./features/room-search/room-search.component').then((m) => m.RoomSearchComponent),
  },
  {
    path: 'rooms/:id',
    loadComponent: () =>
      import('./features/room-details/room-details.component').then((m) => m.RoomDetailsComponent),
  },
  {
    path: 'checkout/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'payment/:reservationId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/payment.component').then((m) => m.PaymentComponent),
  },
  {
    path: 'payment-success/:reservationId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/payment-success.component').then((m) => m.PaymentSuccessComponent),
  },
  {
    path: 'reservations',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reservations/reservations.component').then((m) => m.ReservationsComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'property-rules',
    loadComponent: () =>
      import('./features/policies/property-rules.component').then((m) => m.PropertyRulesComponent),
  },
  {
    path: 'terms-conditions',
    loadComponent: () =>
      import('./features/policies/terms-conditions.component').then((m) => m.TermsConditionsComponent),
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./features/policies/privacy-policy.component').then((m) => m.PrivacyPolicyComponent),
  },
  {
    path: 'covid-safety',
    loadComponent: () =>
      import('./features/policies/covid-safety.component').then((m) => m.CovidSafetyComponent),
  },
  { path: '**', redirectTo: 'destinations' },
];
