BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, email text NOT NULL, name text NOT NULL,
 google_tokens text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS mail_cache (
 id text NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 thread_id text NOT NULL, message_id text NOT NULL, subject text NOT NULL,
 sender text NOT NULL, recipient text NOT NULL, body text NOT NULL,
 received_at timestamptz NOT NULL, in_inbox boolean NOT NULL DEFAULT true, analysis jsonb, synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS notes (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 transcript text NOT NULL, analysis jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL, duration integer NOT NULL CHECK(duration BETWEEN 5 AND 480),
 priority text NOT NULL CHECK(priority IN ('Hoog','Normaal','Laag')),
 deadline date NOT NULL, work_date date NOT NULL, done boolean NOT NULL DEFAULT false,
 source_mail text, source_note text REFERENCES notes(id) ON DELETE SET NULL, proposal_index integer,
 calendar_event_id text, calendar_status text NOT NULL DEFAULT 'none' CHECK(calendar_status IN ('none','pending','planned','uncertain')),
 scheduled_start timestamptz, scheduled_end timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,source_mail) REFERENCES mail_cache(user_id,id),
 UNIQUE(user_id,source_mail,proposal_index), UNIQUE(user_id,source_note,proposal_index)
);
CREATE TABLE IF NOT EXISTS drafts (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_mail text NOT NULL, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','uncertain','failed')),
 sent_id text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,source_mail) REFERENCES mail_cache(user_id,id), UNIQUE(user_id,source_mail)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id bigserial PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action text NOT NULL, status text NOT NULL, resource_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_owner ON tasks(user_id,work_date);
CREATE INDEX IF NOT EXISTS audit_owner ON audit_log(user_id,created_at DESC);
-- This database is accessed only through the application server, never with a browser DB key.
COMMIT;
