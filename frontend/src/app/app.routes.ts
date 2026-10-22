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
  { path: '**', redirectTo: 'destinations' },
];
