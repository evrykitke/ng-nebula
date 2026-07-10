import { Injectable, signal } from '@angular/core';

/** The signed-in user as the layout consumes it (topbar, menus). */
export interface AuthUser {
  display_name: string;
  email: string;
  avatar_url?: string | null;
}

/**
 * Authentication state. INTERIM: a stub that presents a signed-in demo user
 * and grants every permission, so the shell renders fully while the real
 * wiring to the backend (`POST /auth/login` with the tenant header, refresh
 * token rotation, `GET /auth/me` + `/auth/me/permissions`) lands in the next
 * milestone. The public surface already matches what that wiring needs.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>({
    display_name: 'Demo User',
    email: 'demo@example.com',
  });
  private readonly _permissions = signal<Set<string> | null>(null);

  readonly currentUser = this._user.asReadonly();

  isAuthenticated(): boolean {
    return this._user() !== null;
  }

  /** True when the user holds any of the given permissions. `null` = all (stub). */
  hasAnyPermission(names: string[]): boolean {
    const granted = this._permissions();
    if (granted === null) return true;
    return names.some((n) => granted.has(n));
  }

  logout(): void {
    this._user.set(null);
  }
}
