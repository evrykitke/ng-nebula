import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import {
  AuthServiceProxy,
  LoginRequest,
  Profile,
  RefreshRequest,
  TwoFactorLoginRequest,
} from '../../shared/service-proxies/service-proxies';
import { AuthUser, LoginResult, Session, asLoginResult } from './auth.model';

const SESSION_KEY = 'pylon.session';
const TENANT_KEY = 'pylon.tenant';

/**
 * Load a persisted session. The access token may be expired (a refresh will
 * renew it), so the session is kept as long as it parses; the interceptor's
 * 401-refresh-retry sorts out staleness on the first authenticated request.
 */
function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Session;
    if (!stored.accessToken || !stored.refreshToken || !stored.user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return stored;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/**
 * Authentication state. Holds the active session (tokens, user, permissions)
 * in a signal, persists it to `localStorage`, and re-derives it on startup.
 * Permissions come from `GET /auth/me/permissions` — nebula JWTs do not carry
 * them — and drive the app's permission guards and menu.
 *
 * Two-factor sign-in is a two-step exchange: `login` may answer with a
 * short-lived bridge token (`two_factor_required` when a code is expected,
 * `two_factor_setup_required` when the company mandates 2FA and the account
 * has none). The bridge token is held here and attached by the interceptor to
 * the two-factor endpoints until the exchange completes.
 *
 * A sign-in can also end at `password_expired` — the company's policy has
 * aged the password out. That carries its own bridge token, kept separate
 * from the two-factor one because it opens a different door: the forced
 * change at `POST /auth/password/expired`. It only ever arrives once any
 * second factor has been cleared.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly proxy = inject(AuthServiceProxy);

  private readonly _session = signal<Session | null>(loadSession());
  private readonly _tenant = signal<string | null>(
    localStorage.getItem(TENANT_KEY) ?? this._session()?.tenant ?? null,
  );
  private readonly _twoFactorToken = signal<string | null>(null);
  private readonly _passwordToken = signal<string | null>(null);

  /** In-flight refresh, shared so concurrent 401s trigger a single refresh. */
  private refreshInFlight?: Observable<Session>;

  readonly session = this._session.asReadonly();
  readonly profile = computed<Profile | null>(() => this._session()?.user ?? null);
  readonly permissions = computed<ReadonlySet<string>>(
    () => new Set(this._session()?.permissions ?? []),
  );
  readonly token = computed<string | null>(() => this._session()?.accessToken ?? null);
  readonly refreshToken = computed<string | null>(() => this._session()?.refreshToken ?? null);
  readonly tenant = this._tenant.asReadonly();
  /** The pending two-factor bridge token, while a 2FA exchange is under way. */
  readonly twoFactorToken = this._twoFactorToken.asReadonly();
  /** The pending bridge token for a forced change of an expired password. */
  readonly passwordToken = this._passwordToken.asReadonly();

  /** The signed-in user as the layout consumes it. */
  readonly currentUser = computed<AuthUser | null>(() => {
    const user = this._session()?.user;
    if (!user) return null;
    return {
      display_name: `${user.first_name} ${user.last_name}`.trim() || user.user_name,
      email: user.email,
    };
  });

  isAuthenticated(): boolean {
    return this._session() !== null;
  }

  /** Where to send a user after authenticating. */
  landingUrl(): string {
    return '/dashboard';
  }

  /** Persist the tenant name used for the `X-Tenant` header. */
  setTenant(tenant: string | null): void {
    this._tenant.set(tenant);
    if (tenant) localStorage.setItem(TENANT_KEY, tenant);
    else localStorage.removeItem(TENANT_KEY);
  }

  /**
   * Authenticate with credentials alone — the server resolves which company
   * they belong to (users never type a workspace). A `tenant_selection` result
   * means the credentials matched several companies; call again with the
   * chosen workspace name, which is sent as the `X-Tenant` header instead.
   */
  login(login: string, password: string, tenant?: string): Observable<LoginResult> {
    // Clear any stale workspace so resolution starts from the credentials;
    // a caller-provided one (the selection retry) scopes the request instead.
    this.setTenant(tenant?.trim() || null);
    const body: LoginRequest = { login, password };
    return this.proxy.login(body).pipe(switchMap((res) => this.settle(asLoginResult(res))));
  }

  /** Finish a two-factor sign-in with an authenticator (or recovery) code. */
  loginTwoFactor(code: string): Observable<LoginResult> {
    const body: TwoFactorLoginRequest = { code };
    return this.proxy.login_two_factor(body).pipe(switchMap((res) => this.settle(asLoginResult(res))));
  }

  /**
   * Replace a password the server refused as expired, using the bridge
   * token from `password_expired`. No session comes back — the user signs
   * in again with the new password, the same way mandated two-factor setup
   * ends.
   */
  changeExpiredPassword(newPassword: string): Observable<void> {
    return this.proxy.change_expired_password({ new_password: newPassword }).pipe(
      map(() => {
        this._passwordToken.set(null);
      }),
    );
  }

  /** Route a login result: establish the session or hold the bridge token. */
  private settle(result: LoginResult): Observable<LoginResult> {
    if (result.status === 'tenant_selection') {
      return of(result);
    }
    // Adopt the server-resolved tenant: the two-factor endpoints and the
    // whole session must carry it as the `X-Tenant` header.
    if (result.tenant) this.setTenant(result.tenant);
    if (result.status === 'password_expired') {
      // The second factor is behind us; this bridge opens only the forced
      // change, so the two-factor one has no further use.
      this._twoFactorToken.set(null);
      this._passwordToken.set(result.password_token);
      return of(result);
    }
    if (result.status !== 'success') {
      this._twoFactorToken.set(result.two_factor_token);
      return of(result);
    }
    this._twoFactorToken.set(null);
    this._passwordToken.set(null);
    this.establish(result.access_token, result.refresh_token, result.user, []);
    // Permissions live server-side; fetch them with the fresh access token.
    return this.proxy.my_permissions().pipe(
      tap((permissions) => this.setPermissions(permissions)),
      map(() => result),
    );
  }

  /** Establish and persist a session. */
  private establish(
    accessToken: string,
    refreshToken: string,
    user: Profile,
    permissions: string[],
  ): Session {
    const session: Session = {
      accessToken,
      refreshToken,
      tenant: this._tenant(),
      user,
      permissions,
    };
    this._session.set(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  private setPermissions(permissions: string[]): void {
    const current = this._session();
    if (!current) return;
    const session = { ...current, permissions };
    this._session.set(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /** Update the current user in the active session (e.g. after a profile edit). */
  setUser(user: Profile): void {
    const current = this._session();
    if (!current) return;
    const session = { ...current, user };
    this._session.set(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Exchange the stored refresh token for a fresh pair (rotation: the old one
   * is spent). Concurrent callers share a single in-flight request; failure
   * clears the session. Cached permissions are kept — they are refreshed on
   * full logins, not on token rotation.
   */
  refreshSession(): Observable<Session> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refreshToken = this.refreshToken();
    const permissions = this._session()?.permissions ?? [];
    if (!refreshToken) {
      return throwError(() => new Error('no refresh token available'));
    }

    const body: RefreshRequest = { refresh_token: refreshToken };
    this.refreshInFlight = this.proxy.refresh(body).pipe(
      map((res) => {
        const result = asLoginResult(res);
        if (result.status !== 'success') throw new Error('refresh did not yield a session');
        return this.establish(result.access_token, result.refresh_token, result.user, permissions);
      }),
      tap({
        next: () => (this.refreshInFlight = undefined),
        error: () => {
          this.refreshInFlight = undefined;
          this.clear();
        },
      }),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  logout(): void {
    // Best-effort server-side sign-out: revoke the refresh token and record
    // the audit event. Fire-and-forget — local session is cleared regardless.
    const refreshToken = this.refreshToken();
    if (refreshToken) {
      this.proxy.logout({ refresh_token: refreshToken }).subscribe({
        next: () => {},
        error: () => {},
      });
    }
    this.clear();
  }

  /**
   * Drop all local authentication state, the workspace included. Keeping it
   * would be worse than useless: sign-in resolves the workspace from the
   * credentials, so nothing reads it back — but the interceptor would go on
   * stamping `X-Tenant` on every request, and a workspace that has since been
   * renamed or removed makes the server refuse them all (tenant resolution
   * runs ahead of the handler, so even anonymous ones like the currency list
   * on the sign-up page 404).
   */
  private clear(): void {
    this._session.set(null);
    this._twoFactorToken.set(null);
    this.setTenant(null);
    localStorage.removeItem(SESSION_KEY);
  }

  hasPermission(name: string): boolean {
    return this.permissions().has(name);
  }

  hasAnyPermission(names: readonly string[]): boolean {
    if (names.length === 0) return true;
    const granted = this.permissions();
    return names.some((n) => granted.has(n));
  }
}
