ALTER TABLE instructors ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE instructors ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
UPDATE instructors SET
  first_name=CASE WHEN instr(trim(name),' ')>0 THEN substr(trim(name),1,instr(trim(name),' ')-1) ELSE trim(name) END,
  last_name=CASE WHEN instr(trim(name),' ')>0 THEN trim(substr(trim(name),instr(trim(name),' ')+1)) ELSE '' END;
CREATE TABLE instructor_instruments (
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),
  PRIMARY KEY(instructor_id,instrument_id)
);
CREATE TABLE instructor_photos (
  instructor_id INTEGER PRIMARY KEY REFERENCES instructors(id) ON DELETE CASCADE,
  data BLOB NOT NULL,
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
