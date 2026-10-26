BEGIN;
ALTER TABLE users ALTER COLUMN google_tokens DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_provider text NOT NULL DEFAULT 'google' CHECK (login_provider IN ('google','microsoft'));
CREATE TABLE IF NOT EXISTS auth_identities (
 provider text NOT NULL CHECK(provider IN ('google','microsoft')),
 subject text NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(provider,subject), UNIQUE(user_id,provider)
);
CREATE TABLE IF NOT EXISTS connections (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('google','microsoft')),
 subject text NOT NULL, email text NOT NULL, tokens text NOT NULL,
 scopes text NOT NULL, connected_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve the original Google user IDs, tasks, sessions and encrypted credentials.
INSERT INTO auth_identities(provider,subject,user_id)
 SELECT 'google',id,id FROM users WHERE google_tokens IS NOT NULL
 ON CONFLICT DO NOTHING;
INSERT INTO connections(user_id,provider,subject,email,tokens,scopes)
 SELECT id,'google',id,email,google_tokens,
 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.events.owned'
 FROM users WHERE google_tokens IS NOT NULL ON CONFLICT(user_id) DO NOTHING;
-- Keep the legacy encrypted column during rollout so the previous deployment
-- can finish requests. New code reads only connections; unlinking clears both.
ALTER TABLE mail_cache ADD COLUMN IF NOT EXISTS web_url text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS calendar_lookup_key text;
COMMIT;
