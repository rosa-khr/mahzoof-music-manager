ALTER TABLE students ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN age INTEGER CHECK(age IS NULL OR (age >= 0 AND age <= 130));
CREATE TABLE session_statuses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK(code IN ('present','absent','reserved','cancelled')),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status = 'active'),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO session_statuses(code,name,name_key) VALUES
('present','حاضر','حاضر'),('absent','غایب','غایب'),('reserved','رزرو','رزرو'),('cancelled','کنسل','کنسل');
