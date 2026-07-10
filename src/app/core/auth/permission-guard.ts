import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guard that requires the caller to hold the permission(s) declared in the
 * route's `data.permission` (a single name or an array — any match passes).
 * Unauthenticated users are sent to `/login`; authenticated-but-unauthorized
 * users are sent to `/dashboard`.
 *
 * ```ts
 * { path: 'users', loadComponent: ..., canActivate: [permissionGuard],
 *   data: { permission: Permissions.usersView } }
 * ```
 */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  const required = route.data['permission'] as string | string[] | undefined;
  const names = required === undefined ? [] : Array.isArray(required) ? required : [required];

  return auth.hasAnyPermission(names) ? true : router.parseUrl('/dashboard');
};
