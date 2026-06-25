-- Broadcasts (schedule runs) under campaigns
-- Run: python scripts/apply_migration.py

CREATE TABLE IF NOT EXISTS broadcasts (
  broadcast_id     TEXT PRIMARY KEY,
  campaign_id        TEXT NOT NULL,
  broadcast_name     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive')),
  lead_list_id       TEXT,
  pool_size          INTEGER NOT NULL DEFAULT 0 CHECK (pool_size >= 0),
  schedule_dates     TEXT NOT NULL DEFAULT '[]',
  config_json        TEXT NOT NULL DEFAULT '{}',
  created_by         TEXT NOT NULL DEFAULT 'frontend-user',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcasts_campaign_name
  ON broadcasts (campaign_id, broadcast_name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_broadcasts_campaign_id ON broadcasts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts (status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts (created_at);

CREATE TRIGGER IF NOT EXISTS trg_broadcasts_updated_at
AFTER UPDATE ON broadcasts
FOR EACH ROW
BEGIN
  UPDATE broadcasts
  SET updated_at = datetime('now')
  WHERE broadcast_id = OLD.broadcast_id;
END;
