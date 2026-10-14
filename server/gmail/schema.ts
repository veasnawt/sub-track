export const gmailSchema = `-- Additive, server-only Gmail integration. Does not alter any Pinly tables.
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_connections (
 user_id text PRIMARY KEY REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 email text NOT NULL, refresh_cipher text NOT NULL, auto_sync boolean NOT NULL DEFAULT true,
 scan_page text, scan_from timestamptz, scan_started timestamptz,
 last_sync timestamptz, sync_until timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_states (
 hash text PRIMARY KEY, user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 nonce_hash text NOT NULL, verifier_cipher text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_events (
 user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 message_id text NOT NULL, evidence text NOT NULL, source_url text NOT NULL,
 email_date timestamptz NOT NULL, state text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,message_id)
);
ALTER TABLE public.subtrack_gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtrack_gmail_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtrack_gmail_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_senders (
 user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 sender_key text NOT NULL, name text NOT NULL, PRIMARY KEY(user_id,sender_key)
);
ALTER TABLE public.subtrack_gmail_senders ENABLE ROW LEVEL SECURITY;
`;
