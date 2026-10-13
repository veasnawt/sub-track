# Persistent PostgreSQL storage

Sub-Track uses server-only PostgreSQL queries against `public.subtrack_users`, `public.subtrack_categories`, `public.subtrack_subscriptions`, and `public.subtrack_payment_history`. No Pinly tables are read or changed. The temporary JSON store has been removed. All routes await bound SQL queries. Creation, renewal, seeding, and bulk imports use transactions. API health returns 503 if database readiness fails.

## Hosting configuration

- `DATABASE_URL`: save the Supabase transaction pooler URI as a Vercel Secret. Use the existing database password privately; do not reset Pinly's password. Never use a `VITE_` prefix. TLS certificate verification is enabled.
- `JWT_SECRET`: save a long random secret (at least 32 characters) as a Vercel Secret. The previous public fallback has been removed. Existing login tokens will need replacing by signing in again.
- Set both variables in Production before deployment. Preview also needs its own environment configuration to run API checks.
- Apply `supabase/migrations/001_initial_schema.sql` only if these tables do not already exist. It enables RLS on Sub-Track's tables. The app uses its own JWT authentication, so queries run on the server and enforce ownership through `user_id`; the public Supabase key is not used.
- Deploy the completed branch, confirm `/api/health` returns `storage: postgresql`, then create a subscription and confirm it remains after a fresh deployment and login.

The existing four tables in pinly-content-machine were inspected and match the migration with RLS enabled. No schema changes were made during that inspection. `DATABASE_URL` is saved for Vercel Production. `JWT_SECRET` and live production validation remain required.

## Validation

`npm run check`, `npm test`, and `npm run build` validate types, API behavior, and frontend compilation. API tests use an isolated PostgreSQL emulator and cover registration/login, CRUD, renewal, import, analytics, cross-user isolation, persistence across an API restart, and transaction rollback/release commands. The emulator does not validate live Supabase connectivity, TLS, RLS enforcement, or database rollback semantics; live deployment validation is still needed.

Old data in Vercel's temporary filesystem may already be unrecoverable. This change does not invent or automatically import missing records.
