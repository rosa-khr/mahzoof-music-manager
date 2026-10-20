ALTER TABLE students ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE student_photos (
  student_id INTEGER PRIMARY KEY REFERENCES students(id),
  data BLOB NOT NULL,
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
