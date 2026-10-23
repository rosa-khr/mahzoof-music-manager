ALTER TABLE students ADD COLUMN contact_owner TEXT NOT NULL DEFAULT 'student' CHECK(contact_owner IN ('student','parent','other'));
ALTER TABLE students ADD COLUMN birth_date TEXT;
ALTER TABLE students ADD COLUMN gender TEXT NOT NULL DEFAULT '' CHECK(gender IN ('','female','male','other'));
ALTER TABLE students ADD COLUMN national_id TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN landline TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN education_level TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN artistic_history TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN referral_source TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN registration_goal TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN interview_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN internal_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN audience_group TEXT NOT NULL DEFAULT '' CHECK(audience_group IN ('','child','teen','adult'));

ALTER TABLE instruments ADD COLUMN rate_toman_30 INTEGER CHECK(rate_toman_30 IS NULL OR rate_toman_30>=0);
ALTER TABLE instruments ADD COLUMN rate_usd_cents_30 INTEGER CHECK(rate_usd_cents_30 IS NULL OR rate_usd_cents_30>=0);

CREATE TABLE registration_policies (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  effective_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT
);

CREATE UNIQUE INDEX one_registration_policy_draft ON registration_policies(status) WHERE status='draft';

CREATE TABLE enrollment_settings (
  enrollment_id INTEGER PRIMARY KEY REFERENCES enrollments(id),
  instructor_id INTEGER REFERENCES instructors(id),
  teaching_type_id INTEGER REFERENCES teaching_types(id),
  academy_id INTEGER REFERENCES subjects(id),
  mode TEXT NOT NULL DEFAULT 'onsite' CHECK(mode IN ('onsite','online')),
  structure TEXT NOT NULL DEFAULT 'private' CHECK(structure IN ('private','group')),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK(duration_minutes>0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  rate_toman_30 INTEGER CHECK(rate_toman_30 IS NULL OR rate_toman_30>=0),
  rate_usd_cents_30 INTEGER CHECK(rate_usd_cents_30 IS NULL OR rate_usd_cents_30>=0),
  version INTEGER NOT NULL DEFAULT 1,
  CHECK(mode='online' OR academy_id IS NOT NULL)
);

CREATE TABLE weekly_schedules (
  id INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL CHECK(start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK(duration_minutes>0 AND duration_minutes<=1440),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  effective_from TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(enrollment_id,weekday,start_time,effective_from)
);

ALTER TABLE student_terms ADD COLUMN policy_id INTEGER REFERENCES registration_policies(id);
ALTER TABLE student_terms ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'legacy' CHECK(discount_type IN ('legacy','none','percent','fixed'));
ALTER TABLE student_terms ADD COLUMN discount_value INTEGER NOT NULL DEFAULT 0 CHECK(discount_value>=0);
ALTER TABLE student_terms ADD COLUMN base_rate_minor_30 INTEGER CHECK(base_rate_minor_30 IS NULL OR base_rate_minor_30>=0);
ALTER TABLE student_terms ADD COLUMN currency_snapshot TEXT CHECK(currency_snapshot IN ('TOMAN','USD'));

CREATE TABLE term_schedules (
  id INTEGER PRIMARY KEY,
  student_term_id INTEGER NOT NULL REFERENCES student_terms(id),
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0),
  timezone TEXT NOT NULL,
  UNIQUE(student_term_id,weekday,start_time)
);

ALTER TABLE invoices ADD COLUMN settlement_flow TEXT NOT NULL DEFAULT 'legacy' CHECK(settlement_flow IN ('legacy','full'));

CREATE TABLE full_tuition_receipts (
  invoice_id INTEGER PRIMARY KEY REFERENCES invoices(id),
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),
  voided_at TEXT,
  void_reason TEXT NOT NULL DEFAULT '',
  void_actor_id INTEGER REFERENCES users(id)
);

CREATE TABLE academy_letterhead (
  id INTEGER PRIMARY KEY CHECK(id=1),
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  manager TEXT NOT NULL,
  phone TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL,
  instagram TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  visible_fields TEXT NOT NULL DEFAULT '["name_en","manager","phone","mobile","address","website","instagram"]',
  logo_url TEXT NOT NULL DEFAULT '/brand/mahzoof-logo-transparent.png',
  version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO academy_letterhead(id,name_fa,name_en,manager,phone,mobile,website,instagram)
VALUES(1,'آموزشگاه موسیقی شهرام محذوف','Shahram Mahzoof Academy','شهرام محذوف','02177588770','09121497132','https://shahrammahzoof.ir/','shahram_mahzoof_music_academy');

