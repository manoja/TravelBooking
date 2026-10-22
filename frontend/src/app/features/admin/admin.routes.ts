import { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      ...(['destinations', 'hotels', 'rooms'] as const).map((resource) => ({
        path: resource,
        data: { resource },
        loadComponent: () => import('./resource/resource.component').then((m) => m.ResourceComponent),
      })),
      {
        path: 'reservations',
        loadComponent: () =>
          import('./reservations/reservations.component').then((m) => m.AdminReservationsComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
