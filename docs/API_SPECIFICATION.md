# API specification

- Base path: `/v1` (from Phase 1). Machine-readable spec: `GET /v1/openapi.json`, generated from the route schemas.
- Auth: httpOnly session cookie (browser, through the web app) or `Authorization: Bearer <token>`.
- Organization context: `x-org-id` header; roles checked on the server.
- Money: integer cents with an explicit currency; rates in basis points.
- Errors: `{ error, code }` with 400 / 401 / 403 / 404 / 409 / 429.
- Every metric carries a data source: Live, Manual, Imported, Verified, Delayed, Unavailable.

The full endpoint list with request schemas is generated (`npm run routes -w apps/api`, and the OpenAPI document). Business rules per endpoint are in `apps/api/README.md`.
