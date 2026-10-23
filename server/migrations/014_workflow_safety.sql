ALTER TABLE students ADD COLUMN policy_id INTEGER REFERENCES registration_policies(id);
ALTER TABLE enrollments ADD COLUMN policy_id INTEGER REFERENCES registration_policies(id);
ALTER TABLE student_terms ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE workflow_requests (
  request_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE private_documents (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  student_term_id INTEGER REFERENCES student_terms(id),
  payment_id INTEGER REFERENCES payments(id),
  kind TEXT NOT NULL CHECK(kind IN ('signed_registration','receipt')),
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE letterhead_logo (
  id INTEGER PRIMARY KEY CHECK(id=1),
  data BLOB NOT NULL,
  revision TEXT NOT NULL
);
DROP TRIGGER attendance_term_guard;
CREATE TABLE attendance_new (
 id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id),
 student_term_id INTEGER NOT NULL REFERENCES student_terms(id),
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','present','absent','cancelled')),
 counts INTEGER NOT NULL DEFAULT 0 CHECK(counts IN (0,1)),
 reason TEXT NOT NULL DEFAULT '', cancelled_by TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
 requested_by TEXT NOT NULL DEFAULT '' CHECK(requested_by IN ('','teacher','student','academy','other')),
 justified INTEGER CHECK(justified IN (0,1)),
 CHECK((status='present' AND counts=1) OR (status='reserved' AND counts=0) OR
       (status='cancelled' AND (counts=0 OR cancelled_by='student')) OR
       (status='absent' AND length(trim(reason))>0)),
 CHECK(status!='cancelled' OR (length(trim(reason))>0 AND cancelled_by IN ('teacher','student','academy','other'))),
 UNIQUE(session_id,student_term_id)
);
INSERT INTO attendance_new SELECT id,session_id,student_term_id,status,counts,reason,cancelled_by,version,requested_by,justified FROM attendance;
DROP TABLE attendance;
ALTER TABLE attendance_new RENAME TO attendance;
CREATE INDEX attendance_membership_idx ON attendance(student_term_id,status);
CREATE TRIGGER attendance_term_guard BEFORE INSERT ON attendance BEGIN
 SELECT CASE WHEN (SELECT term_id FROM sessions WHERE id=NEW.session_id)!=(SELECT term_id FROM student_terms WHERE id=NEW.student_term_id)
 THEN RAISE(ABORT,'inconsistent session term') END;
END;
CREATE TRIGGER published_policy_guard BEFORE UPDATE ON registration_policies WHEN OLD.status='published' BEGIN
 SELECT RAISE(ABORT,'published policy is immutable');
END;
CREATE TRIGGER published_policy_delete_guard BEFORE DELETE ON registration_policies WHEN OLD.status='published' BEGIN
 SELECT RAISE(ABORT,'published policy is immutable');
END;
