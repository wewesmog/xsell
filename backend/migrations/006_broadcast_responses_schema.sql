-- Agent response storage: one logical table for all broadcasts (JSON for variable columns).
-- SQLite UAT: TEXT JSON + json_extract(); Oracle prod: CLOB JSON + JSON_VALUE().
-- Run: python scripts/apply_migration.py

ALTER TABLE broadcasts ADD COLUMN workbook_schema_json TEXT;

-- Per-assigned-lead row; schema varies by broadcast — see broadcasts.workbook_schema_json
CREATE TABLE IF NOT EXISTS broadcast_responses (
  response_id      TEXT PRIMARY KEY,
  broadcast_id     TEXT NOT NULL,
  staff_no         TEXT NOT NULL,
  assigned_date    TEXT NOT NULL,
  msisdn_clean     TEXT NOT NULL,
  lead_id          TEXT,
  assignment_json  TEXT NOT NULL DEFAULT '{}',
  responses_json   TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts (broadcast_id) ON DELETE CASCADE,
  UNIQUE (broadcast_id, staff_no, assigned_date, msisdn_clean)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_broadcast
  ON broadcast_responses (broadcast_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_staff_date
  ON broadcast_responses (broadcast_id, staff_no, assigned_date);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_msisdn
  ON broadcast_responses (msisdn_clean);

CREATE TRIGGER IF NOT EXISTS trg_broadcast_responses_updated_at
AFTER UPDATE ON broadcast_responses
FOR EACH ROW
BEGIN
  UPDATE broadcast_responses
  SET updated_at = datetime('now')
  WHERE response_id = OLD.response_id;
END;
