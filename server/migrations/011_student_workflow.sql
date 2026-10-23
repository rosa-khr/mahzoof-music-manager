CREATE TABLE enrollments_new (
 id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id),
 subject_id INTEGER REFERENCES subjects(id), instrument_id INTEGER REFERENCES instruments(id),
 UNIQUE(student_id,subject_id), UNIQUE(student_id,instrument_id),
 CHECK((subject_id IS NOT NULL AND instrument_id IS NULL) OR (subject_id IS NULL AND instrument_id IS NOT NULL))
);
INSERT INTO enrollments_new(id,student_id,subject_id) SELECT id,student_id,subject_id FROM enrollments;
DROP TABLE enrollments;
ALTER TABLE enrollments_new RENAME TO enrollments;
CREATE TABLE class_offerings_new (
 id INTEGER PRIMARY KEY, subject_id INTEGER REFERENCES subjects(id),
 structure TEXT NOT NULL DEFAULT 'private' CHECK(structure IN ('private','group')),
 teacher TEXT NOT NULL DEFAULT 'شهرام محذوف', mode TEXT NOT NULL CHECK(mode IN ('onsite','online')),
 location TEXT NOT NULL DEFAULT '', course_format TEXT NOT NULL DEFAULT 'normal' CHECK(course_format IN ('normal','masterclass')),
 instrument_id INTEGER REFERENCES instruments(id), instructor_id INTEGER REFERENCES instructors(id),
 teaching_type_id INTEGER REFERENCES teaching_types(id), academy_id INTEGER REFERENCES subjects(id),
 CHECK(subject_id IS NOT NULL OR instrument_id IS NOT NULL)
);
INSERT INTO class_offerings_new(id,subject_id,structure,teacher,mode,location,course_format)
 SELECT id,subject_id,structure,teacher,mode,location,course_format FROM class_offerings;
DROP TABLE class_offerings;
ALTER TABLE class_offerings_new RENAME TO class_offerings;
CREATE TABLE student_education_preferences (
 student_id INTEGER PRIMARY KEY REFERENCES students(id), instrument_id INTEGER NOT NULL REFERENCES instruments(id),
 instructor_id INTEGER NOT NULL REFERENCES instructors(id), teaching_type_id INTEGER NOT NULL REFERENCES teaching_types(id),
 mode TEXT NOT NULL CHECK(mode IN ('onsite','online')), academy_id INTEGER REFERENCES subjects(id),
 payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),
 CHECK(mode='online' OR academy_id IS NOT NULL)
);
ALTER TABLE student_terms ADD COLUMN workflow_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id);
ALTER TABLE invoices ADD COLUMN payment_method_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'single' CHECK(settlement_type IN ('single','installment','free'));
CREATE TABLE invoice_installments (
 id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id),
 number INTEGER NOT NULL CHECK(number>0), amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 due_date TEXT NOT NULL, UNIQUE(invoice_id,number)
);
ALTER TABLE attendance ADD COLUMN requested_by TEXT NOT NULL DEFAULT '' CHECK(requested_by IN ('','teacher','student','academy','other'));
ALTER TABLE attendance ADD COLUMN justified INTEGER CHECK(justified IN (0,1));
CREATE INDEX invoice_installments_invoice ON invoice_installments(invoice_id,due_date,number);
