# Gmail subscription tracking

Gmail connection uses Google OAuth with PKCE, a single-use state bound to an HttpOnly browser cookie, and `gmail.readonly`. No sending or mailbox edits. Gmail must match the Sub-Track account email. Refresh tokens are encrypted using AES-256-GCM with a key derived from the server JWT secret; rotating JWT_SECRET requires reconnecting Gmail.

## Activate on Vercel

1. In a Google Cloud project, enable Gmail API. Configure Google Auth Platform consent, audience and a Web application OAuth client. For personal testing, add your Gmail as a test user.
2. Add this authorized redirect URI: `https://sub-track-theta.vercel.app/api/gmail/callback`.
3. Save server-only production Vercel variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=https://sub-track-theta.vercel.app`, and a random `CRON_SECRET` of at least 32 characters. Never use VITE_ prefixes or commit secrets.
4. Redeploy. Open Sub-Track Settings > Automatic subscription tracking > Connect Gmail. Approve Google's read-only Gmail consent. Scan billing emails and review the first scan.

Google can require restricted-scope verification for a public app. OAuth applications in Testing may issue refresh tokens that expire after seven days. Follow Google's current consent and verification guidance before public rollout.

The integration initializes only the four new `public.subtrack_gmail_*` tables in migration 002, with RLS and no browser-access policies. It never changes existing Pinly tables. Existing Sub-Track tables remain unchanged. An operator may apply migration 002 explicitly in Supabase instead of allowing initialization on first configured use.

## Behavior and limits

A Vercel cron calls `/api/gmail/cron` once a day at 01:00 UTC and requires `Authorization: Bearer <CRON_SECRET>`. Scan can also run from Settings. Tokens and email bodies are never returned by status endpoints or logged. Stored evidence includes minimal billing details, sender fingerprints, source links, and state.

Initial backfill covers 100 days and is review-only. Later scans overlap by three days and deduplicate per account and message. Pagination is persisted and work is bounded per invocation; large inboxes may need multiple scans. Locks prevent overlapping scans for one account. For large numbers of connected accounts, move to a queue with per-account workers.

Automatic updates cover complete, authenticated USD receipts for existing active ElevenLabs Starter and Meshy Pro monthly services, and explicit authenticated Claude access-paused notices. Stripe merchant senders require prior user approval. New services, incomplete receipts, cancellations, payment failures, currency/cycle mismatches and duplicates stay in review. This is conservative deterministic parsing, not universal AI parsing. Provider templates may change; unrecognized formats go to review. Receipts are evidence, not proof of continued use. Unclear emails never create a paid history record automatically.

Regular recurring prices and actual amounts paid are stored separately. Approval cannot target another account's event. Source-based imports and email payment-history IDs are idempotent. Disconnect removes local Gmail credentials and attempts Google token revocation; tracked subscriptions and existing review evidence remain.

Validation: TypeScript check, production build and isolated PostgreSQL integration tests. Live OAuth and scheduled scans require the production OAuth settings and user consent; they cannot be verified using the ChatGPT Gmail connector's credentials.
