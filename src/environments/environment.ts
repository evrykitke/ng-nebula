/**
 * Runtime environment configuration.
 *
 * `apiBaseUrl` is the origin of the nebula server API and is bound to the
 * generated proxies' `API_BASE_URL` injection token in `app.config.ts`. For
 * production builds, override this via an `environment.production.ts` file
 * replacement.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000',
};
