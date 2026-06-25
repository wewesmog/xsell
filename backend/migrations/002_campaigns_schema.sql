-- Campaigns (parent container for broadcasts / schedule runs)

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id    TEXT PRIMARY KEY,
  campaign_name  TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
  created_by     TEXT NOT NULL DEFAULT 'frontend-user',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns (LOWER(campaign_name));
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at);

CREATE OR REPLACE FUNCTION xsell_touch_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_campaigns_updated_at();
