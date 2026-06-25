-- List ingestion schema (SQLite)
-- Drop + recreate for dev reset. Run manually against backend/xsell.db (no DDL in app code).
--
-- Upload flow:
--   pending    = files on disk only (no DB row)
--   processing = cleaned + deduped, awaiting user approval
--   ready      = approved for campaigns
--   archived   = soft-disabled; name can be reused (partial unique index)

PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS trg_list_rows_updated_at;
DROP TRIGGER IF EXISTS trg_lists_updated_on;
DROP TABLE IF EXISTS list_rows;
DROP TABLE IF EXISTS lists;

PRAGMA foreign_keys = ON;

-- 1) lists
CREATE TABLE lists (
  list_id            TEXT PRIMARY KEY,
  list_name          TEXT NOT NULL,
  uploaded_by        TEXT NOT NULL,
  uploaded_on        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_on         TEXT NOT NULL DEFAULT (datetime('now')),
  status             TEXT NOT NULL DEFAULT 'processing'
                     CHECK (status IN ('processing','ready','archived')),
  row_count_raw      INTEGER NOT NULL DEFAULT 0 CHECK (row_count_raw >= 0),
  row_count_clean    INTEGER NOT NULL DEFAULT 0 CHECK (row_count_clean >= 0)
);

CREATE INDEX idx_lists_uploaded_by ON lists(uploaded_by);
CREATE INDEX idx_lists_uploaded_on ON lists(uploaded_on);
CREATE INDEX idx_lists_status ON lists(status);

-- Active lists only: archived rows do not block name reuse
CREATE UNIQUE INDEX idx_lists_active_name
  ON lists (uploaded_by, list_name)
  WHERE status != 'archived';

-- 2) list_rows
CREATE TABLE list_rows (
  row_id                 TEXT PRIMARY KEY,
  list_id                TEXT NOT NULL,
  source_row_number      INTEGER,
  msisdn_clean           TEXT NOT NULL,
  customer_name          TEXT,
  others_json            TEXT NOT NULL DEFAULT '{}',
  row_hash               TEXT NOT NULL,
  is_valid               INTEGER NOT NULL DEFAULT 1 CHECK (is_valid IN (0,1)),
  dedupe_group_id        TEXT,
  decision               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (decision IN ('pending','keep','drop','merge')),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
  UNIQUE (list_id, msisdn_clean, row_hash)
);

CREATE INDEX idx_list_rows_list_id ON list_rows(list_id);
CREATE INDEX idx_list_rows_msisdn ON list_rows(msisdn_clean);
CREATE INDEX idx_list_rows_list_msisdn ON list_rows(list_id, msisdn_clean);
CREATE INDEX idx_list_rows_decision ON list_rows(decision);
CREATE INDEX idx_list_rows_dedupe_group ON list_rows(dedupe_group_id);

CREATE TRIGGER trg_lists_updated_on
AFTER UPDATE ON lists
FOR EACH ROW
BEGIN
  UPDATE lists
  SET updated_on = datetime('now')
  WHERE list_id = OLD.list_id;
END;

CREATE TRIGGER trg_list_rows_updated_at
AFTER UPDATE ON list_rows
FOR EACH ROW
BEGIN
  UPDATE list_rows
  SET updated_at = datetime('now')
  WHERE row_id = OLD.row_id;
END;
