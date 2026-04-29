-- ---------------------------------------------------------------------------
-- Supabase preamble for pglite-backed integration tests.
--
-- pglite is a vanilla Postgres. The OKrunit migrations assume a Supabase
-- environment, so we recreate the slice of Supabase the migrations actually
-- depend on: the auth schema, JWT claim helper functions, and the realtime
-- publication. None of this aims to mimic the full Supabase Auth/Realtime
-- behavior. It exists so migrations apply cleanly and so RLS policies that
-- call `auth.uid()` / `auth_org_id()` evaluate against test-controlled state.
-- ---------------------------------------------------------------------------

-- pglite ships with gen_random_uuid() built in (Postgres 13+ behavior) and
-- does not include the optional pgcrypto extension. Migrations that
-- "CREATE EXTENSION pgcrypto" are tolerated by createIntegrationDb's per-
-- block error handling; tests that need pgcrypto-only functions (e.g.
-- crypt/gen_salt) should skip on pglite.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

-- Roles the migrations grant to. pglite already runs as superuser; create
-- these as no-login roles so GRANT statements in migrations succeed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- auth.users: the table user_profiles.id references via FK.
-- We capture only the columns OKrunit reads in handle_new_user and policies.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}',
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  identity_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- storage schema stubs. Migrations that touch storage.buckets / storage.objects
-- (avatars, attachments) need these tables to exist; we don't test storage
-- behavior, just need INSERT/SELECT to not error.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner UUID,
  public BOOLEAN DEFAULT false,
  avif_autodetection BOOLEAN DEFAULT false,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- storage.foldername is the Supabase helper that splits a path like
-- 'avatars/abc/foo.png' into ['avatars','abc','foo.png']. Used in storage
-- RLS policies. We stub it as a string_to_array on '/'.
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] LANGUAGE SQL IMMUTABLE AS $$
  SELECT string_to_array(name, '/')
$$;

CREATE OR REPLACE FUNCTION storage.filename(name TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT split_part(name, '/', -1)
$$;

CREATE OR REPLACE FUNCTION storage.extension(name TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT lower(reverse(split_part(reverse(name), '.', 1)))
$$;

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID,
  metadata JSONB,
  path_tokens TEXT[],
  version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- JWT claim helpers. Tests set these via:
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
-- which makes auth.uid() return that uuid for the duration of the txn.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', current_setting('request.jwt.role', true), 'anon')
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT auth.jwt() ->> 'email'
$$;

-- ---------------------------------------------------------------------------
-- Realtime publication. Migrations do `ALTER PUBLICATION supabase_realtime
-- ADD TABLE ...` so it must exist. pglite has no replication, so this is
-- inert; the ALTER calls succeed and we ignore them.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- pgjwt-style helpers some migrations use. No-ops here.
CREATE OR REPLACE FUNCTION extensions.uuid_generate_v4()
RETURNS UUID LANGUAGE SQL AS $$ SELECT gen_random_uuid() $$;

-- moddatetime is a Supabase-bundled extension that updates an updated_at
-- column on row update. Our integration tests do not assert on updated_at
-- values, and the codebase also wires update_updated_at_column() triggers
-- where it cares, so a no-op is safe here.
CREATE OR REPLACE FUNCTION extensions.moddatetime()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RETURN NEW;
END;
$$;
