-- Track generated workbook output for broadcasts

ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS output_dir TEXT;

CREATE INDEX IF NOT EXISTS idx_broadcasts_generated_at ON broadcasts (generated_at);
