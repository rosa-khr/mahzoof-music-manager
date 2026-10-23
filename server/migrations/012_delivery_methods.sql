ALTER TABLE teaching_types ADD COLUMN requires_academy INTEGER CHECK(requires_academy IN (0,1));
-- Only unanimous previous usage determines configuration; histories remain intact.
UPDATE teaching_types SET requires_academy=(
 SELECT CASE WHEN COUNT(DISTINCT mode)=1 THEN CASE MIN(mode) WHEN 'onsite' THEN 1 ELSE 0 END ELSE NULL END
 FROM (SELECT teaching_type_id,mode FROM class_offerings UNION ALL SELECT teaching_type_id,mode FROM student_education_preferences) usage
 WHERE usage.teaching_type_id=teaching_types.id
);
-- Unused, explicitly named physical/online methods are unambiguous.
UPDATE teaching_types SET requires_academy=1 WHERE requires_academy IS NULL
 AND name_key IN ('حضوری','آموزشگاه های دیگر','آموزشگاه‌های دیگر')
 AND NOT EXISTS (SELECT 1 FROM class_offerings WHERE teaching_type_id=teaching_types.id)
 AND NOT EXISTS (SELECT 1 FROM student_education_preferences WHERE teaching_type_id=teaching_types.id);
UPDATE teaching_types SET requires_academy=0 WHERE requires_academy IS NULL
 AND name_key IN ('آنلاین','غیرحضوری','غیر حضوری','غیر حضوری - داخلی')
 AND NOT EXISTS (SELECT 1 FROM class_offerings WHERE teaching_type_id=teaching_types.id)
 AND NOT EXISTS (SELECT 1 FROM student_education_preferences WHERE teaching_type_id=teaching_types.id);
UPDATE teaching_types SET version=version+1 WHERE requires_academy IS NOT NULL;
