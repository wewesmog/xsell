-- List ingestion schema (PostgreSQL)
-- Idempotent: CREATE IF NOT EXISTS (safe to re-run via apply_migration.py)

CREATE TABLE IF NOT EXISTS lists (
  list_id            TEXT PRIMARY KEY,
  list_name          TEXT NOT NULL,
  uploaded_by        TEXT NOT NULL,
  uploaded_on        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_on         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','ready','archived')),
  row_count_raw      INTEGER NOT NULL DEFAULT 0 CHECK (row_count_raw >= 0),
  row_count_clean    INTEGER NOT NULL DEFAULT 0 CHECK (row_count_clean >= 0)
);

CREATE INDEX IF NOT EXISTS idx_lists_uploaded_by ON lists(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_lists_uploaded_on ON lists(uploaded_on);
CREATE INDEX IF NOT EXISTS idx_lists_status ON lists(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_active_name
  ON lists (uploaded_by, list_name)
  WHERE status != 'archived';

CREATE TABLE IF NOT EXISTS list_rows (
  row_id                 TEXT PRIMARY KEY,
  list_id                TEXT NOT NULL REFERENCES lists(list_id) ON DELETE CASCADE,
  source_row_number      INTEGER,
  msisdn_clean           TEXT NOT NULL,
  customer_name          TEXT,
  others_json            JSONB NOT NULL DEFAULT '{}',
  row_hash               TEXT NOT NULL,
  is_valid               BOOLEAN NOT NULL DEFAULT TRUE,
  dedupe_group_id        TEXT,
  decision               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (decision IN ('pending','keep','drop','merge')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, msisdn_clean, row_hash)
);

CREATE INDEX IF NOT EXISTS idx_list_rows_list_id ON list_rows(list_id);
CREATE INDEX IF NOT EXISTS idx_list_rows_msisdn ON list_rows(msisdn_clean);
CREATE INDEX IF NOT EXISTS idx_list_rows_list_msisdn ON list_rows(list_id, msisdn_clean);
CREATE INDEX IF NOT EXISTS idx_list_rows_decision ON list_rows(decision);
CREATE INDEX IF NOT EXISTS idx_list_rows_dedupe_group ON list_rows(dedupe_group_id);

CREATE OR REPLACE FUNCTION xsell_touch_lists_updated_on()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_on = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lists_updated_on ON lists;
CREATE TRIGGER trg_lists_updated_on
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_lists_updated_on();

CREATE OR REPLACE FUNCTION xsell_touch_list_rows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_list_rows_updated_at ON list_rows;
CREATE TRIGGER trg_list_rows_updated_at
  BEFORE UPDATE ON list_rows
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_list_rows_updated_at();
