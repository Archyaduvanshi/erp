ALTER TABLE students
    ADD COLUMN IF NOT EXISTS class_id BIGINT;

CREATE TABLE IF NOT EXISTS student_class_id_migration_report (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT,
    institute_id BIGINT,
    class_label TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

WITH resolved AS (
    SELECT s.id AS student_id,
           sc.id AS class_id
    FROM students s
    JOIN school_classes sc
      ON sc.institute_id = s.institute_id
     AND sc.normalized_name = lower(regexp_replace(trim(split_part(coalesce(s.assigned_class, s.class_name, ''), '/', 1)), '\s+', ' ', 'g'))
    WHERE s.class_id IS NULL
      AND coalesce(s.assigned_class, s.class_name, '') <> ''
      AND upper(coalesce(sc.status, 'ACTIVE')) <> 'ARCHIVED'
)
UPDATE students s
SET class_id = resolved.class_id
FROM resolved
WHERE s.id = resolved.student_id;

INSERT INTO student_class_id_migration_report (student_id, institute_id, class_label, reason)
SELECT s.id,
       s.institute_id,
       coalesce(s.assigned_class, s.class_name, ''),
       'Unable to resolve legacy Student class text to school_classes.id'
FROM students s
WHERE s.class_id IS NULL
  AND coalesce(s.assigned_class, s.class_name, '') <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM student_class_id_migration_report existing
      WHERE existing.student_id = s.id
        AND existing.reason = 'Unable to resolve legacy Student class text to school_classes.id'
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_students_class_id'
    ) THEN
        ALTER TABLE students
            ADD CONSTRAINT fk_students_class_id
            FOREIGN KEY (class_id) REFERENCES school_classes(id) NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_institute_class_id_status
    ON students (institute_id, class_id, status);
