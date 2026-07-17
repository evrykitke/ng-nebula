import { LoginResponse, Profile, TenantChoice } from '../../shared/service-proxies/service-proxies';

/**
 * `POST /auth/login` returns a tagged union that NSwag's interface-style DTOs
 * flatten to an index signature; this restores the discriminated shape. The
 * tenant is resolved server-side from the credentials: every branch names it
 * (for the `X-Tenant` header from here on), and `tenant_selection` means the
 * credentials matched several companies — retry with one of them chosen.
 */
export type LoginResult =
  | {
      status: 'success';
      access_token: string;
      refresh_token: string;
      user: Profile;
      tenant: string | null;
    }
  | { status: 'two_factor_required'; two_factor_token: string; tenant: string | null }
  | { status: 'two_factor_setup_required'; two_factor_token: string; tenant: string | null }
  /**
   * The password is older than the company's policy allows. No session is
   * issued until it is replaced at `POST /auth/password/expired` with this
   * token. It arrives only after any second factor has been cleared.
   */
  | { status: 'password_expired'; password_token: string; tenant: string | null }
  | { status: 'tenant_selection'; tenants: TenantChoice[] };

const STATUSES: readonly LoginResult['status'][] = [
  'success',
  'two_factor_required',
  'two_factor_setup_required',
  'password_expired',
  'tenant_selection',
];

export function asLoginResult(res: LoginResponse): LoginResult {
  const status = res['status'] as LoginResult['status'] | undefined;
  if (status && STATUSES.includes(status)) {
    return res as unknown as LoginResult;
  }
  throw new Error(`unexpected login response status: ${String(status)}`);
}

/**
 * A persisted session. Permissions are not carried in nebula JWTs — they are
 * fetched from `GET /auth/me/permissions` when the session is established and
 * cached here to drive the guards and menu.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Tenant name for the `X-Tenant` header; `null` is the host context. */
  tenant: string | null;
  user: Profile;
  permissions: string[];
}

/** The signed-in user as the layout consumes it (topbar, menus). */
export interface AuthUser {
  display_name: string;
  email: string;
  avatar_url?: string | null;
}
