-- Broadcasts (schedule runs) under campaigns

CREATE TABLE IF NOT EXISTS broadcasts (
  broadcast_id     TEXT PRIMARY KEY,
  campaign_id      TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  broadcast_name   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')),
  lead_list_id     TEXT,
  pool_size        INTEGER NOT NULL DEFAULT 0 CHECK (pool_size >= 0),
  schedule_dates   JSONB NOT NULL DEFAULT '[]',
  config_json      JSONB NOT NULL DEFAULT '{}',
  created_by       TEXT NOT NULL DEFAULT 'frontend-user',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcasts_campaign_name
  ON broadcasts (campaign_id, LOWER(broadcast_name));

CREATE INDEX IF NOT EXISTS idx_broadcasts_campaign_id ON broadcasts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts (status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts (created_at);

CREATE OR REPLACE FUNCTION xsell_touch_broadcasts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_broadcasts_updated_at ON broadcasts;
CREATE TRIGGER trg_broadcasts_updated_at
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_broadcasts_updated_at();
