# Travel Booking API (FastAPI)

FastAPI backend for an existing Supabase PostgreSQL schema (`users`, `destinations`, `hotels`,
`rooms`, `room_images`, `reservations`, `payments`, `saved_searches`) with Auth0 JWT authentication.
All endpoints live under `/api/v1`. Interactive docs: `/docs`, `/redoc`.

## Layout

`app/api/v1` (routes) → `app/services` (business rules) → `app/repositories` (queries) →
`app/models` (SQLAlchemy). `app/schemas` holds the API contracts, `app/core` config/security/logging,
`app/scripts` operational scripts.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env     # then fill in real values
.\.venv\Scripts\uvicorn app.main:app --reload
```

Required configuration (see `.env.example`): `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`,
`CORS_ORIGINS`. Secrets are never committed; `.env` is git-ignored. In non-test environments the app
refuses to start if these are missing.

### Supabase

- The schema already exists. **Do not run `alembic upgrade` expecting table creation.** Revision
  `0001` is an empty baseline: run `alembic stamp 0001` once, then use Alembic for future changes.
- Use `postgresql+psycopg://...?sslmode=require`. For the transaction pooler (port 6543) set
  `DB_PGBOUNCER=true` (disables prepared statements).
- The backend connects with a privileged role, which typically bypasses RLS. Authorization is
  therefore enforced in the API; do not expose the database publicly.

### Auth0

Create an API (its identifier is `AUTH0_AUDIENCE`) and use your tenant as `AUTH0_DOMAIN`. Tokens are
verified (RS256, JWKS, issuer, audience, expiry). Roles are read **only from the database**; token
role claims are ignored. A first login creates a profile with role `user`.

### Admin bootstrap (controlled, separate from the API)

No endpoint can create an admin. After the person has logged in once (or even before):

```powershell
.\.venv\Scripts\python -m app.scripts.bootstrap_admin --auth0-sub "auth0|abc123"
```

## Endpoints

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /health/db` |
| Auth | `GET /auth/me` |
| Catalog (public) | `GET /destinations`, `/destinations/{id}`, `/hotels`, `/hotels/{id}`, `/rooms/search`, `/rooms/{id}` |
| Reservations | `POST /reservations`, `GET /reservations/me`, `GET /reservations/{id}`, `POST /reservations/{id}/cancel` |
| Payments | `POST /payments/dummy`, `GET /payments/reservation/{id}` |
| Saved searches | `GET/POST /saved-searches`, `GET/DELETE /saved-searches/{id}`, `POST /saved-searches/{id}/run` |
| Admin | `/admin/destinations`, `/admin/hotels`, `/admin/rooms` (GET list, POST, PATCH `/{id}`, DELETE `/{id}`), `POST /admin/rooms/{id}/images`, `DELETE /admin/room-images/{id}`, `GET /admin/reservations`, `GET /admin/dashboard` |

The admin GET list endpoints were added beyond the spec so admins can see hidden records.
List responses: `{items, page, page_size, total, total_pages}`.

## Business rules

- **Availability / holds:** confirmed reservations block a room; pending ones block for
  `PENDING_HOLD_MINUTES` (default 15). Overlap: `check_in < req.check_out AND check_out > req.check_in`.
  Stale pending rows are expired lazily and by `python -m app.scripts.expire_pending` (schedule it).
- **Race safety:** reservation creation locks the room row (`SELECT ... FOR UPDATE`) and re-checks
  overlap inside the transaction. Payment and cancellation lock the reservation row.
- **Pricing:** server-side only: nights × current room rate + `TAX_RATE_PERCENT` + `FLAT_FEE`,
  rounded half-up. Client-supplied amounts/user ids are rejected (422).
- **Dummy payment (development only):** `POST /payments/dummy` with `{reservation_id, outcome}`;
  optional `Idempotency-Key` header makes retries safe. Disabled (404) in production unless
  `ENABLE_DUMMY_PAYMENTS=true`. Success confirms the reservation; failure leaves it pending.
- **Cancellation:** owner may cancel pending anytime; confirmed only `CANCELLATION_CUTOFF_DAYS`
  before check-in (admins exempt). Succeeded payments become `refunded`.
- **Access control:** non-owners get 404 for reservations, payments and saved searches.
- **Deletes:** destinations with hotels, hotels with rooms, and rooms with reservations return 409.
- **Dashboard revenue:** sum of `succeeded` payments; refunds reported separately.

### Known schema limitation

There is no nightly-rate snapshot on `reservations`; the total is stored but the breakdown is
recomputed from the current rate. Recommended backward-compatible migration: add a nullable
`rate_snapshot`/`price_breakdown` column. For DB-level overlap protection, consider an exclusion
constraint (`btree_gist`, `tstzrange`) on confirmed reservations.

## Testing and linting

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\ruff check .
.\.venv\Scripts\ruff format .
```

Tests run against in-memory SQLite with locally signed JWTs (JWKS is stubbed). Last run: 82 passed,
1 skipped. The skipped test is the concurrent-booking test, which needs real PostgreSQL:
set `TEST_DATABASE_URL` to a database whose name ends in `_test` (tables are dropped!).

**Not verified:** nothing has been run against real Supabase, Auth0 or PostgreSQL, so Postgres-specific
behavior (row locks, JSONB amenity filter, pooler settings) is untested here.

## Deployment notes

Run behind HTTPS with `APP_ENV=production`, restrict `CORS_ORIGINS`, keep dummy payments off,
use `uvicorn`/`gunicorn` workers, schedule `expire_pending`, and monitor `/health/db`.
`app.scripts.seed` is insert-only and refuses to run in production.
