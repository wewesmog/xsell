-- Campaigns (parent container for broadcasts / schedule runs)
-- Run after 001_list_ingestion_schema.sql:
--   python scripts/apply_migration.py

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id    TEXT PRIMARY KEY,
  campaign_name  TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
  created_by     TEXT NOT NULL DEFAULT 'frontend-user',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_name
  ON campaigns (campaign_name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at);

CREATE TRIGGER IF NOT EXISTS trg_campaigns_updated_at
AFTER UPDATE ON campaigns
FOR EACH ROW
BEGIN
  UPDATE campaigns
  SET updated_at = datetime('now')
  WHERE campaign_id = OLD.campaign_id;
END;
