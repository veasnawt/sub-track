# Persistent storage repair (in progress)

## Root cause
`server/db.ts` uses a process-local JavaScript store, serialized to `/tmp/subtrack_db.json` on Vercel. This cannot guarantee persistence across invocations or instances. The current synchronous `db.prepare(...).get/all/run` interface is not compatible with PostgreSQL's asynchronous client without a backend refactor.

## Database schema
Run `supabase/migrations/001_initial_schema.sql` in your Supabase project's SQL Editor. This creates user-owned subscription, category and payment tables. Row-level security is enabled; the existing app uses its own JWT authentication, so **server-side PostgreSQL access is required**. Do not use a public anon key to query these tables.

## Remaining implementation work before deployment
1. Add a server-only PostgreSQL connection pool using a `DATABASE_URL` secret, with TLS as required by the provider.
2. Refactor `server/routes/auth.ts`, `subscriptions.ts`, `categories.ts`, `analytics.ts` and seeding to async parameterized SQL, including transaction handling.
3. Remove the temporary JSON store and its swallowed write exceptions. Fail startup loudly if persistent storage is unavailable.
4. Fix the Vercel API entrypoint and verify routing and deployments. Do not deploy until the app can register, log in, create a subscription, and retrieve it after a fresh deployment.
5. Migrate any recoverable data from the old store before cutover. Data in Vercel's temporary filesystem may already be unrecoverable.
6. Set a strong `JWT_SECRET` in hosting configuration. Never commit database credentials or use the current hardcoded JWT fallback in production.
7. Add integration tests for create/read/update/delete, multi-user isolation, and persistence after process restart.

**This migration is schema-only so far. It does not fix production persistence until the backend migration is complete.**
