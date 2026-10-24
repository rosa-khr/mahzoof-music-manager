CREATE TABLE student_policy_acceptances (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  student_term_id INTEGER NOT NULL REFERENCES student_terms(id),
  policy_id INTEGER NOT NULL REFERENCES registration_policies(id),
  statement TEXT NOT NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_term_id, policy_id)
);

CREATE INDEX student_policy_acceptances_student_idx
  ON student_policy_acceptances(student_id, accepted_at DESC);
