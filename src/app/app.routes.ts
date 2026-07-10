import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { authGuard } from './core/auth/auth-guard';

/**
 * Top-level routes. The login route lives outside the shell; feature areas
 * mount as lazy children of the shell behind the auth guard, and
 * permission-gated pages add `permissionGuard` with a `data.permission`.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./core/auth/pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
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
