-- Track generated workbook output for broadcasts
-- Run: python scripts/apply_migration.py

ALTER TABLE broadcasts ADD COLUMN generated_at TEXT;
ALTER TABLE broadcasts ADD COLUMN output_dir TEXT;

CREATE INDEX IF NOT EXISTS idx_broadcasts_generated_at ON broadcasts (generated_at);
