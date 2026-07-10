import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';

/**
 * Top-level routes. Feature areas mount as lazy children of the shell;
 * the login route (outside the shell) arrives with the auth wiring.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'administration',
        loadComponent: () =>
          import('./features/administration/administration-hub.page').then(
            (m) => m.AdministrationHubPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
