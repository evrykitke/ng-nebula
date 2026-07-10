import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiError, toApiError } from '../../shared/api/api-error';

/** Requests that must not trigger a refresh-and-retry on 401. */
function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return (
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/token/refresh') ||
    req.url.includes('/auth/register')
  );
}

/**
 * Endpoints that accept the short-lived two-factor bridge token issued by
 * `POST /auth/login` — the code exchange, and setup/confirm when the company
 * mandates 2FA before the first full session exists.
 */
function isTwoFactorEndpoint(req: HttpRequest<unknown>): boolean {
  return (
    req.url.includes('/auth/login/two-factor') ||
    req.url.includes('/auth/two-factor/setup') ||
    req.url.includes('/auth/two-factor/confirm')
  );
}

/**
 * Build a normalised {@link ApiError} and log it with full context. This is the
 * single place every failed request is described, so the console always shows
 * exactly what happened — status, problem `title`/`detail`, and the request id
 * that correlates with the backend log for that request. The returned
 * `ApiError` is not an `HttpResponseBase`, so NSwag proxies rethrow it
 * unchanged and components receive it as-is.
 */
function report(err: unknown, req: HttpRequest<unknown>): ApiError {
  const apiError = toApiError(err, { method: req.method, url: req.url });
  console.error(
    `[API] ${apiError.method} ${apiError.url} → ${apiError.status} ${apiError.title}` +
      (apiError.requestId ? ` (request-id ${apiError.requestId})` : ''),
    { message: apiError.message },
  );
  return apiError;
}

/**
 * Cross-cutting request concerns for the nebula API:
 *  - attaches the `Authorization: Bearer` token when signed in, or the pending
 *    two-factor bridge token on the 2FA endpoints during sign-in;
 *  - attaches the `X-Tenant` header so the server resolves the tenant
 *    (header strategy) — needed even for the anonymous login request;
 *  - on a 401 it transparently refreshes the access token once and retries;
 *  - normalises and logs every failure as an {@link ApiError}.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const withAuth = (r: HttpRequest<unknown>): HttpRequest<unknown> => {
    const token =
      auth.token() ?? (isTwoFactorEndpoint(r) ? auth.twoFactorToken() : null);
    const tenant = auth.tenant();
    let headers = r.headers;
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    if (tenant && !headers.has('X-Tenant')) headers = headers.set('X-Tenant', tenant);
    return headers === r.headers ? r : r.clone({ headers });
  };

  return next(withAuth(req)).pipe(
    catchError((err: unknown) => {
      const is401 = err instanceof HttpErrorResponse && err.status === 401;

      // Try a one-shot refresh for authenticated, non-auth requests.
      if (is401 && !isAuthEndpoint(req) && auth.refreshToken()) {
        return auth.refreshSession().pipe(
          switchMap(() =>
            next(withAuth(req)).pipe(catchError((retryErr: unknown) => throwError(() => report(retryErr, req)))),
          ),
          catchError((refreshErr: unknown) => {
            void router.navigateByUrl('/login');
            return throwError(() => report(refreshErr, req));
          }),
        );
      }

      // A 401 we can't refresh away ends the session.
      if (is401 && !isAuthEndpoint(req) && auth.isAuthenticated()) {
        auth.logout();
        void router.navigateByUrl('/login');
      }

      return throwError(() => report(err, req));
    }),
  );
};
