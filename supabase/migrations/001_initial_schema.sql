-- Run in Supabase SQL Editor before switching Sub-Track to PostgreSQL.
-- Server-side access only. Never expose DATABASE_URL to the browser.
CREATE TABLE IF NOT EXISTS subtrack_users (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, currency text NOT NULL DEFAULT 'USD',
 theme text NOT NULL DEFAULT 'system',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subtrack_categories (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES subtrack_users(id) ON DELETE CASCADE,
 name text NOT NULL, icon text, color text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subtrack_subscriptions (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES subtrack_users(id) ON DELETE CASCADE,
 name text NOT NULL, category text NOT NULL, price numeric(14,2) NOT NULL,
 currency text NOT NULL DEFAULT 'USD', billing_cycle text NOT NULL,
 payment_method text NOT NULL, start_date text NOT NULL, next_billing_date text NOT NULL,
 status text NOT NULL DEFAULT 'active', notes text, website text, logo text,
 color text DEFAULT '#4F46E5', reminder_days integer DEFAULT 3,
 auto_renew integer DEFAULT 1, cancellation_url text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subtrack_payment_history (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES subtrack_users(id) ON DELETE CASCADE,
 subscription_id text NOT NULL REFERENCES subtrack_subscriptions(id) ON DELETE CASCADE,
 amount numeric(14,2) NOT NULL, currency text NOT NULL,
 billing_date text NOT NULL, payment_method text,
 status text NOT NULL DEFAULT 'paid', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_billing_idx ON subtrack_subscriptions(user_id,next_billing_date);
CREATE INDEX IF NOT EXISTS payment_history_subscription_idx ON subtrack_payment_history(subscription_id);
-- This app currently uses its own JWT authentication, not Supabase Auth.
-- Do not expose these tables via the Supabase Data API until RLS policies
-- and an appropriate identity mapping are implemented.
ALTER TABLE subtrack_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtrack_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtrack_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtrack_payment_history ENABLE ROW LEVEL SECURITY;
