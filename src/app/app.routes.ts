import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';
import { Permissions } from './core/auth/permissions.constants';
import { APPS } from './core/layout/apps';

/**
 * Top-level routes: login outside the shell, everything else inside it behind
 * the auth guard.
 *
 * The apps bring their own pages — this composes them rather than listing them.
 * What stays here is what belongs to no app: the profile, and administration,
 * which is pinned apart from the apps by design.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./core/auth/pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./core/auth/pages/register/register').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      ...APPS.flatMap((a) => a.routes),
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'administration',
        loadComponent: () =>
          import('./features/administration/administration-hub.page').then(
            (m) => m.AdministrationHubPage,
          ),
      },
      {
        path: 'administration/users',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersView },
        loadComponent: () =>
          import('./features/administration/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'administration/users/:id/permissions',
        canActivate: [permissionGuard],
        data: { permission: Permissions.usersPermissions },
        loadComponent: () =>
          import('./features/administration/users/user-permissions.page').then(
            (m) => m.UserPermissionsPage,
          ),
      },
      {
        path: 'administration/roles',
        canActivate: [permissionGuard],
        data: { permission: Permissions.rolesView },
        loadComponent: () =>
          import('./features/administration/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'administration/audit-logs',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-logs.page').then(
            (m) => m.AuditLogsPage,
          ),
      },
      {
        path: 'administration/audit-logs/:id',
        canActivate: [permissionGuard],
        data: { permission: Permissions.auditLogsView },
        loadComponent: () =>
          import('./features/administration/audit-logs/audit-log-detail.page').then(
            (m) => m.AuditLogDetailPage,
          ),
      },
      {
        path: 'administration/settings',
        canActivate: [permissionGuard],
        data: { permission: Permissions.tenantSettings },
        loadComponent: () =>
          import('./features/administration/settings/tenant-settings.page').then(
            (m) => m.TenantSettingsPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
