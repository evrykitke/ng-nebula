/**
 * Production environment, swapped in for `environment.ts` by the
 * `fileReplacements` of the `production` build configuration.
 *
 * `apiBaseUrl` is same-origin: nginx serves this bundle at
 * https://nebula.evrykit.com and reverse-proxies `/api/` to the nebula
 * server on 127.0.0.1:5000, stripping the prefix. Same origin means no
 * preflight and no CORS — which is why `server.cors_origins` is empty in
 * the server's `config/prod.yaml`.
 *
 * No trailing slash: the generated proxies build `baseUrl + '/accounting/...'`.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://nebula.evrykit.com/api',
};
