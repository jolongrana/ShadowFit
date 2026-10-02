/*
# Create ShadowFit Community tables

## Summary
Creates the four database tables that power the ShadowFit Community page:
profiles, workout sessions, friend requests, and friendships. These tables
were defined in the Drizzle schema (lib/db/src/schema/community.ts) but never
applied to the database, so the Community page had nowhere to store or
retrieve data.

## Authentication model
This app uses Clerk (not Supabase Auth) for user accounts. The frontend
never queries these tables directly — all reads and writes go through the
Express API server, which connects to Postgres with a privileged connection
string (DATABASE_URL) that bypasses RLS. Therefore RLS is enabled on every
table with deny-by-default (no permissive policies), so anon/authenticated
Supabase roles cannot access the data directly.

## New tables

1. shadowfit_profiles
   - user_id (text, primary key) — Clerk user ID
   - username (text, unique, not null) — lowercase handle for friend requests
   - display_name (text, not null) — name shown to friends
   - sharing_enabled (boolean, default false) — opt-in score sharing
   - time_zone (text, default 'UTC') — IANA timezone for local-day calculation
   - created_at, updated_at (timestamptz)

2. shadowfit_workout_sessions
   - id (serial, primary key)
   - user_id (text, FK → profiles, cascade delete)
   - client_session_id (text, not null) — dedup key from the frontend
   - workout_id (text, not null) — which workout was completed
   - sets (integer, not null) — completed sets
   - minutes (integer, not null) — session duration
   - completed_at (timestamptz, not null) — when the session finished
   - local_day (date, not null) — calendar day in the user's timezone
   - created_at (timestamptz)
   - Unique index on (user_id, client_session_id) to prevent duplicate syncs
   - Index on (user_id, local_day) for score calculation queries

3. shadowfit_friend_requests
   - id (serial, primary key)
   - requester_id (text, FK → profiles, cascade delete)
   - recipient_id (text, FK → profiles, cascade delete)
   - status (text, default 'pending') — pending / accepted / declined / cancelled
   - created_at, updated_at (timestamptz)
   - Unique index on (requester_id, recipient_id) — one request pair at a time
   - Index on (recipient_id, status) — fast lookup of incoming pending requests

4. shadowfit_friendships
   - user_id (text, FK → profiles, cascade delete)
   - friend_user_id (text, FK → profiles, cascade delete)
   - created_at (timestamptz)
   - Composite primary key on (user_id, friend_user_id)
   - Index on friend_user_id — reverse lookup for bidirectional deletes

## Security
- RLS enabled on all four tables.
- No permissive policies created (deny-by-default for anon/authenticated roles).
- All application access goes through the API server's privileged connection,
  which bypasses RLS. The frontend never queries these tables directly.
*/

-- 1. Profiles
CREATE TABLE IF NOT EXISTS shadowfit_profiles (
  user_id text PRIMARY KEY,
  username text NOT NULL,
  display_name text NOT NULL,
  sharing_enabled boolean NOT NULL DEFAULT false,
  time_zone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shadowfit_profiles_username_idx
  ON shadowfit_profiles (username);

ALTER TABLE shadowfit_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Workout sessions
CREATE TABLE IF NOT EXISTS shadowfit_workout_sessions (
  id serial PRIMARY KEY,
  user_id text NOT NULL
    REFERENCES shadowfit_profiles (user_id) ON DELETE CASCADE,
  client_session_id text NOT NULL,
  workout_id text NOT NULL,
  sets integer NOT NULL,
  minutes integer NOT NULL,
  completed_at timestamptz NOT NULL,
  local_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shadowfit_workout_user_client_idx
  ON shadowfit_workout_sessions (user_id, client_session_id);

CREATE INDEX IF NOT EXISTS shadowfit_workout_user_day_idx
  ON shadowfit_workout_sessions (user_id, local_day);

ALTER TABLE shadowfit_workout_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Friend requests
CREATE TABLE IF NOT EXISTS shadowfit_friend_requests (
  id serial PRIMARY KEY,
  requester_id text NOT NULL
    REFERENCES shadowfit_profiles (user_id) ON DELETE CASCADE,
  recipient_id text NOT NULL
    REFERENCES shadowfit_profiles (user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shadowfit_friend_request_pair_idx
  ON shadowfit_friend_requests (requester_id, recipient_id);

CREATE INDEX IF NOT EXISTS shadowfit_friend_request_recipient_status_idx
  ON shadowfit_friend_requests (recipient_id, status);

ALTER TABLE shadowfit_friend_requests ENABLE ROW LEVEL SECURITY;

-- 4. Friendships
CREATE TABLE IF NOT EXISTS shadowfit_friendships (
  user_id text NOT NULL
    REFERENCES shadowfit_profiles (user_id) ON DELETE CASCADE,
  friend_user_id text NOT NULL
    REFERENCES shadowfit_profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shadowfit_friendships
  ADD CONSTRAINT shadowfit_friendships_pkey
  PRIMARY KEY (user_id, friend_user_id);

CREATE INDEX IF NOT EXISTS shadowfit_friendships_friend_idx
  ON shadowfit_friendships (friend_user_id);

ALTER TABLE shadowfit_friendships ENABLE ROW LEVEL SECURITY;