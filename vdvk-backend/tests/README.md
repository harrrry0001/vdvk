# API Endpoint Test Suite

Integration tests for the VDVK MIS backend that verify every endpoint behaves as
expected: status codes, response shapes, RBAC guards, and full form lifecycles
(Draft → Submitted → Approved).

Built on **Vitest** + Hono's in-process `app.request()` — no HTTP server needed.

## Quick start

```bash
npm install        # one-time
npm test           # run the full suite
npm run test:watch # dev mode with hot reload
```

## What is covered

| Spec file | Coverage |
|---|---|
| `auth.test.ts` | health, login (all 6 roles), wrong password/role, `/me`, refresh rotation, logout revokes sessions, password change (and restore) |
| `master.test.ts` | geo hierarchy, commodities, grades, rates (incl. Turmeric Grade A = Rs.120), schemes, exp-heads, customers, suppliers, VDVK master |
| `forms.test.ts` | Full Draft → Submit → Approve lifecycle for all 12 forms + zod validation (400) + state-machine violations (400) |
| `dashboard.test.ts` | all 6 dashboard endpoints |
| `mda.test.ts` | stock query/summary, rate prefill + CRUD + revision, master-data CRUD, user management (create/reset/transfer/deactivate), audit trail, machinery transfer workflow, facilities |
| `rbac.test.ts` | 401 (no/garbage/expired token), 403 (wrong role for 10+ guarded endpoints), 404 |

## How it works

- Tests run **in-process** against the Hono app (`tests/helpers/client.ts`
  imports `src/app.ts` — no server, no port).
- They hit the **real Postgres dev DB on Aiven** (from `.env`), so mutating tests:
  - use unique suffixed IDs (see `tests/helpers/ctx.ts`), never touching seeded rows
  - create throwaway records that stay as `Draft`/`Approved` in dev data
  - restore the seeded password if the password-change test runs
- Files run **sequentially** (`fileParallelism: false` in `vitest.config.ts`)
  so mutating specs can't collide.

## Pointing at a separate test database (recommended for CI)

```powershell
# Windows (PowerShell)
$env:DATABASE_URL="postgres://<user>:<pass>@<host>:<port>/<db>"
$env:DATABASE_CA_CERT="<path-to-ca.pem>"
npm test

# bash/zsh
DATABASE_URL=... DATABASE_CA_CERT=... npm test
```

The Aiven CA certificate is required for the TLS handshake (see `ca.pem` in the
project root). To seed a fresh database before testing: `npm run db:seed`.

## Testing a live/deployed server

Run the backend (`npm run dev`), then:

```powershell
$env:API_BASE_URL="http://localhost:3000"   # or your deployed URL
npm test
```

The same specs run over real HTTP. Everything from the README still applies,
minus the in-process import.

## Common pitfalls

- **Failed login attempts lock users for 30 minutes** after 5 failures — tests
  only trigger 1 failure per user.
- **Do not run two suites concurrently** against the same database (e.g. two
  terminals at once) — shared-DB writes may interfere.
- Deleting seeded rows will break specs. If the seed password was changed
  manually, reset it: `npm run db:seed`.

## Fresh test database setup

1. Create a database on Aiven (or any Postgres) and download its CA cert.
2. Set `DATABASE_URL` and `DATABASE_CA_CERT` in `.env` (or the environment).
3. Push the schema: `npx drizzle-kit push`.
4. Seed: `npm run db:seed`.
5. Run: `npm test`.
