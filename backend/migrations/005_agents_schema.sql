-- Agents + roster (admin-managed; schedule & generate read from here)

CREATE TABLE IF NOT EXISTS agents (
  staff_no    TEXT PRIMARY KEY,
  staff_name  TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_active ON agents (active);
CREATE INDEX IF NOT EXISTS idx_agents_staff_name ON agents (staff_name);

CREATE OR REPLACE FUNCTION xsell_touch_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE PROCEDURE xsell_touch_agents_updated_at();

CREATE TABLE IF NOT EXISTS roster_absences (
  absence_id   TEXT PRIMARY KEY,
  staff_no     TEXT NOT NULL REFERENCES agents (staff_no) ON DELETE CASCADE,
  absent_date  TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_no, absent_date)
);

CREATE INDEX IF NOT EXISTS idx_roster_absences_staff ON roster_absences (staff_no);
CREATE INDEX IF NOT EXISTS idx_roster_absences_date ON roster_absences (absent_date);
