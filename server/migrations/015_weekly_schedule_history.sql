CREATE TABLE weekly_schedules_history_safe (
 id INTEGER PRIMARY KEY,
 enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 start_time TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0 AND duration_minutes<=1440),
 timezone TEXT NOT NULL,
 effective_from TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1
);
INSERT INTO weekly_schedules_history_safe SELECT * FROM weekly_schedules;
DROP TABLE weekly_schedules;
ALTER TABLE weekly_schedules_history_safe RENAME TO weekly_schedules;
CREATE INDEX weekly_schedule_active ON weekly_schedules(enrollment_id,active);
