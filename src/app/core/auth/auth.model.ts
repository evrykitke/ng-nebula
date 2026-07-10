import { LoginResponse, Profile } from '../../shared/service-proxies/service-proxies';

/**
 * `POST /auth/login` returns a tagged union that NSwag's interface-style DTOs
 * flatten to an index signature; this restores the discriminated shape.
 */
export type LoginResult =
  | { status: 'success'; access_token: string; refresh_token: string; user: Profile }
  | { status: 'two_factor_required'; two_factor_token: string }
  | { status: 'two_factor_setup_required'; two_factor_token: string };

export function asLoginResult(res: LoginResponse): LoginResult {
  const status = res['status'] as LoginResult['status'] | undefined;
  if (status === 'success' || status === 'two_factor_required' || status === 'two_factor_setup_required') {
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
