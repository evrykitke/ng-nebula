# End-to-end checks

Browser-driven checks that run a real Chrome against a **running dev stack** —
the nebula server on `:5000` and `ng serve` on `:4200`. They exist to catch what
`ng build` cannot: routes, permission gates, proxy drift, and the backend's own
domain rules.

They are not part of `npm test` (that is the unit suite, no servers needed).

## Running

Start the backend and `npm start`, then:

```sh
E2E_EMAIL=you@example.com E2E_PASSWORD=... npm run e2e
```

| Script | What it does |
| --- | --- |
| `npm run e2e:pages` | Visits every sales page; asserts each renders with no console or runtime errors. Read-only. |
| `npm run e2e:o2c` | Drives the full order-to-cash chain through the UI. **Writes records.** |
| `npm run e2e:moves` | Receipt draft → edit → post, plus the mobile header/lines layout. Registers its own throwaway tenant (`E2E_TENANT` or a generated name; `E2E_EMAIL`/`E2E_PASSWORD` become its admin). **Writes records.** |
| `npm run e2e` | All of them. |

## Environment

| Variable | Default | |
| --- | --- | --- |
| `E2E_EMAIL` | — | **required** |
| `E2E_PASSWORD` | — | **required** |
| `E2E_BASE` | `http://localhost:4200` | frontend origin |
| `E2E_API` | `http://localhost:5000` | backend origin |
| `E2E_CHROME` | Windows Chrome path | any Chrome/Edge binary |
| `E2E_HEADLESS` | headless | `0` to watch it run in a window |

Credentials are never committed — they come from the environment.

## Notes

- `e2e:o2c` creates a customer, order, delivery, invoice and payment. **Point it
  at a dev tenant, never production.** It needs a tenant with a sellable item
  that has stock; it discovers one at runtime and skips loudly if there is none.
- Its final step asserts the AR subledger reconciles to the ledger with an empty
  GL outbox — the invariant `scm_gl.rs` guards in the backend, re-checked here
  across the whole stack.
- `harness.mjs` holds the shared sign-in, clicking and API helpers. Two gotchas
  are encoded there: modal buttons need `getClientRects()` (not `offsetParent`,
  which is null under the fixed overlay), and header actions must be scoped to
  `app-page-header` so a sidebar link cannot swallow the click.
