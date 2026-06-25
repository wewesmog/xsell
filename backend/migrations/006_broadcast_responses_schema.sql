-- Agent response storage (JSON for variable columns)

ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS workbook_schema_json JSONB;

CREATE TABLE IF NOT EXISTS broadcast_responses (
  response_id      TEXT PRIMARY KEY,
  broadcast_id     TEXT NOT NULL REFERENCES broadcasts (broadcast_id) ON DELETE CASCADE,
  staff_no         TEXT NOT NULL,
  assigned_date    TEXT NOT NULL,
  msisdn_clean     TEXT NOT NULL,
  lead_id          TEXT,
  assignment_json  JSONB NOT NULL DEFAULT '{}',
  responses_json   JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (broadcast_id, staff_no, assigned_date, msisdn_clean)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_broadcast
  ON broadcast_responses (broadcast_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_staff_date
  ON broadcast_responses (broadcast_id, staff_no, assigned_date);

CREATE INDEX IF NOT EXISTS idx_broadcast_responses_msisdn
  ON broadcast_responses (msisdn_clean);

CREATE OR REPLACE FUNCTION xsell_touch_broadcast_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broadcast_responses_updated_at ON broadcast_responses;
CREATE TRIGGER trg_broadcast_responses_updated_at
  BEFORE UPDATE ON broadcast_responses
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_broadcast_responses_updated_at();
