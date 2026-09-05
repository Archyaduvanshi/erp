ALTER TABLE class_sections
    ADD COLUMN IF NOT EXISTS max_students INTEGER NOT NULL DEFAULT 30;

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS section_id BIGINT;

UPDATE class_sections
SET max_students = 30
WHERE max_students IS NULL OR max_students < 1;

UPDATE students s
SET section_id = sec.id
FROM class_sections sec
WHERE s.section_id IS NULL
  AND s.class_id IS NOT NULL
  AND sec.institute_id = s.institute_id
  AND sec.class_id = s.class_id
  AND upper(trim(sec.normalized_name)) = upper(trim(coalesce(s.section, '')))
  AND upper(coalesce(sec.status, 'ACTIVE')) <> 'ARCHIVED';

CREATE TABLE IF NOT EXISTS student_section_id_migration_report (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT,
    institute_id BIGINT,
    class_id BIGINT,
    section_label TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO student_section_id_migration_report (student_id, institute_id, class_id, section_label, reason)
SELECT s.id,
       s.institute_id,
       s.class_id,
       s.section,
       'Unable to resolve legacy Student section text to class_sections.id'
FROM students s
WHERE s.section_id IS NULL
  AND coalesce(s.section, '') <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM student_section_id_migration_report existing
      WHERE existing.student_id = s.id
        AND existing.reason = 'Unable to resolve legacy Student section text to class_sections.id'
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_sections_max_students_positive'
    ) THEN
        ALTER TABLE class_sections
            ADD CONSTRAINT chk_class_sections_max_students_positive CHECK (max_students > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_section_id'
    ) THEN
        ALTER TABLE students
            ADD CONSTRAINT fk_students_section_id
            FOREIGN KEY (section_id) REFERENCES class_sections(id) NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_institute_class_section_status
    ON students (institute_id, class_id, section_id, status);

CREATE INDEX IF NOT EXISTS idx_class_sections_institute_class_status_capacity
    ON class_sections (institute_id, class_id, status, max_students);
