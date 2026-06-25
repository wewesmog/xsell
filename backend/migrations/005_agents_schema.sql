-- Agents + roster (admin-managed; schedule & generate read from here)
-- Run: python scripts/apply_migration.py
--
-- agents          master list of outbound staff (assume populated from HR / existing source)
-- roster_absences per-agent dates when they cannot take leads (reduces schedule capacity)
--
-- Schedule wizard: GET /api/roster  → active agents + absent_dates[]
-- Generation:       agents_main.agents_by_staff_no()

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
-- staff_no     TEXT PK     e.g. KEN216725
-- staff_name   TEXT        display name for workbooks
-- active       INTEGER     1 = selectable in schedule, 0 = hidden/inactive
-- created_at   TEXT
-- updated_at   TEXT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
  staff_no    TEXT PRIMARY KEY,
  staff_name  TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agents_active ON agents (active);
CREATE INDEX IF NOT EXISTS idx_agents_staff_name ON agents (staff_name);

CREATE TRIGGER IF NOT EXISTS trg_agents_updated_at
AFTER UPDATE ON agents
FOR EACH ROW
BEGIN
  UPDATE agents
  SET updated_at = datetime('now')
  WHERE staff_no = OLD.staff_no;
END;

-- ---------------------------------------------------------------------------
-- roster_absences
-- ---------------------------------------------------------------------------
-- absence_id   TEXT PK
-- staff_no     TEXT FK → agents.staff_no
-- absent_date  TEXT        ISO date YYYY-MM-DD
-- note         TEXT        optional reason
-- created_at   TEXT
-- UNIQUE (staff_no, absent_date)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roster_absences (
  absence_id   TEXT PRIMARY KEY,
  staff_no     TEXT NOT NULL,
  absent_date  TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_no) REFERENCES agents (staff_no) ON DELETE CASCADE,
  UNIQUE (staff_no, absent_date)
);

CREATE INDEX IF NOT EXISTS idx_roster_absences_staff ON roster_absences (staff_no);
CREATE INDEX IF NOT EXISTS idx_roster_absences_date ON roster_absences (absent_date);

-- Optional dev sample rows (skip if agents are loaded from another system)
INSERT OR IGNORE INTO agents (staff_no, staff_name, active) VALUES
  ('KEN216725', 'Marcus Mwangi Kiama', 1),
  ('KEN216719', 'Damaris Mbula Judy', 1),
  ('KEN216774', 'Brian Wekesa Sikuku', 1),
  ('KEN216724', 'Cornel Bwire Musukio', 1),
  ('KEN217204', 'Sheila Jelimo', 1),
  ('KEN217200', 'Irene Jepchumba Kemboi', 1),
  ('KEN217198', 'Eunice Wacu Nduta', 1),
  ('KEN217043', 'Paullete Muthoni Kihara', 1);

INSERT OR IGNORE INTO roster_absences (absence_id, staff_no, absent_date, note)
SELECT
  lower(hex(randomblob(16))),
  'KEN216774',
  '2026-05-20',
  'Sample absence'
WHERE NOT EXISTS (
  SELECT 1 FROM roster_absences
  WHERE staff_no = 'KEN216774' AND absent_date = '2026-05-20'
);
