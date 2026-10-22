# Travel Booking – Angular frontend

Angular 20 standalone-component SPA (client-rendered) that talks to the FastAPI backend in `../backend`.

## Run

```powershell
npm install
# edit src/environments/environment.ts: apiUrl + Auth0 domain / clientId / audience
npm start
```

Auth0: create a *Single Page Application*, add `http://localhost:4200` to Allowed Callback URLs,
Logout URLs and Web Origins, and use the same API audience as the backend. Add
`http://localhost:4200` to the backend `CORS_ORIGINS`.

## Structure

- `core/` – `auth` (Auth0 wrapper; admin role comes from `GET /auth/me`), `guards`, `interceptors`
  (bearer token only for protected endpoints + 401 handling), `services/api.service.ts`, `models`.
- `shared/` – `ImageComponent` (fixed dimensions, lazy loading), `MoneyPipe`.
- `features/` – `destinations`, `room-search`, `room-details`, `checkout`, `reservations`, `admin`;
  every route is lazy-loaded with `loadComponent`.

## State management and performance

| Technique | Where |
|---|---|
| Signals | `room-search.store.ts` (filters, results, validation), checkout summary, auth profile |
| RxJS `switchMap` | Search store: obsolete room-search requests are cancelled when filters change (300 ms debounce) |
| Lazy loading | All feature routes; admin/checkout/reservations additionally behind guards |
| `@defer (on viewport)` | Room gallery in `room-details` |
| CDK virtual scrolling | Room results list (`cdk-virtual-scroll-viewport`), loads the next server page near the end |
| Web Worker | `room-search.worker.ts` ranks/filters loaded rooms by a free-text query; availability/price filtering stays on the server |
| Server-side pagination | 20 rooms per request |
| Caching | Public destinations are cached in `ApiService` (cleared after admin changes); room search is never cached |
| Images | `NgOptimizedImage` with explicit width/height and lazy loading |

## Notes and limitations

- Route guards are UX only; the API enforces authorization.
- Checkout shows a price *estimate*; the server computes the authoritative total. Payment is the
  backend's development-only dummy endpoint.
- Responsive `srcset` is not generated because image URLs come from arbitrary hosts.
- Verified: `ng build` succeeds. Not verified: running against a live backend/Auth0, and no
  frontend unit tests are included yet.
