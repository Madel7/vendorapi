-- sql/schema.sql
-- VendorOS – Full PostgreSQL schema
-- Run via:  psql -U postgres -d vendoros -f sql/schema.sql

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users (auth) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,        -- bcrypt hash
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin','member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Categories (lookup) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) UNIQUE NOT NULL
);

INSERT INTO categories (name) VALUES
  ('Audio/Visual'),('Catering'),('Entertainment'),
  ('Florals'),('Photography'),('Transportation'),
  ('Security'),('Decor'),('Other')
ON CONFLICT DO NOTHING;

-- ── Vendors ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  email       VARCHAR(255) UNIQUE NOT NULL,
  phone       VARCHAR(50),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('active','pending','completed','inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_status   ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category_id);

-- ── Events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  event_date  DATE NOT NULL,
  location    VARCHAR(300),
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vendor ↔ Event assignments ────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_events (
  vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  role        VARCHAR(120),                          -- optional role description
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_id, event_id)
);

-- ── Documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        VARCHAR(300) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  file_size   BIGINT,                                -- bytes
  mime_type   VARCHAR(100),
  doc_type    VARCHAR(50) DEFAULT 'document'
                CHECK (doc_type IN ('contract','invoice','document','other')),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_vendor ON documents(vendor_id);

-- ── Auto-update updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vendors_updated_at')
  THEN CREATE TRIGGER trg_vendors_updated_at
       BEFORE UPDATE ON vendors
       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_events_updated_at')
  THEN CREATE TRIGGER trg_events_updated_at
       BEFORE UPDATE ON events
       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at')
  THEN CREATE TRIGGER trg_users_updated_at
       BEFORE UPDATE ON users
       FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF;
END $$;
