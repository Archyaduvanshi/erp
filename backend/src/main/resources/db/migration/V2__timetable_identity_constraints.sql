CREATE TEMP TABLE timetable_duplicate_map ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        id,
        first_value(id) OVER (
            PARTITION BY institute_id, academic_session_id, class_id, section_id
            ORDER BY
                CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END,
                COALESCE(updated_at, published_at, created_at) DESC NULLS LAST,
                id DESC
        ) AS keep_id,
        row_number() OVER (
            PARTITION BY institute_id, academic_session_id, class_id, section_id
            ORDER BY
                CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END,
                COALESCE(updated_at, published_at, created_at) DESC NULLS LAST,
                id DESC
        ) AS row_number
    FROM class_timetables
    WHERE institute_id IS NOT NULL
      AND academic_session_id IS NOT NULL
      AND class_id IS NOT NULL
      AND section_id IS NOT NULL
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE row_number > 1;

INSERT INTO timetable_duplicate_map (duplicate_id, keep_id)
WITH ranked AS (
    SELECT
        id,
        first_value(id) OVER (
            PARTITION BY institute_id, academic_session_id, class_id
            ORDER BY
                CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END,
                COALESCE(updated_at, published_at, created_at) DESC NULLS LAST,
                id DESC
        ) AS keep_id,
        row_number() OVER (
            PARTITION BY institute_id, academic_session_id, class_id
            ORDER BY
                CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END,
                COALESCE(updated_at, published_at, created_at) DESC NULLS LAST,
                id DESC
        ) AS row_number
    FROM class_timetables
    WHERE institute_id IS NOT NULL
      AND academic_session_id IS NOT NULL
      AND class_id IS NOT NULL
      AND section_id IS NULL
)
SELECT id AS duplicate_id, keep_id
FROM ranked
WHERE row_number > 1;

UPDATE timetable_periods p
SET timetable_id = m.keep_id
FROM timetable_duplicate_map m
WHERE p.timetable_id = m.duplicate_id
  AND NOT EXISTS (
      SELECT 1
      FROM timetable_periods existing
      WHERE existing.timetable_id = m.keep_id
        AND existing.day_of_week = p.day_of_week
        AND existing.period_number = p.period_number
  );

DELETE FROM timetable_periods p
USING timetable_duplicate_map m
WHERE p.timetable_id = m.duplicate_id;

DELETE FROM class_timetables t
USING timetable_duplicate_map m
WHERE t.id = m.duplicate_id;

CREATE TEMP TABLE timetable_draft_duplicate_map ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY institute_id, academic_session_id, class_id, section_id
            ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
        ) AS row_number
    FROM timetable_template_drafts
    WHERE institute_id IS NOT NULL
      AND academic_session_id IS NOT NULL
      AND class_id IS NOT NULL
      AND section_id IS NOT NULL
)
SELECT id AS duplicate_id
FROM ranked
WHERE row_number > 1;

INSERT INTO timetable_draft_duplicate_map (duplicate_id)
WITH ranked AS (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY institute_id, academic_session_id, class_id
            ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
        ) AS row_number
    FROM timetable_template_drafts
    WHERE institute_id IS NOT NULL
      AND academic_session_id IS NOT NULL
      AND class_id IS NOT NULL
      AND section_id IS NULL
)
SELECT id AS duplicate_id
FROM ranked
WHERE row_number > 1;

DELETE FROM timetable_template_drafts d
USING timetable_draft_duplicate_map m
WHERE d.id = m.duplicate_id;

UPDATE class_timetables t
SET academic_session_id = s.id
FROM academic_sessions s
WHERE t.academic_session_id IS NULL
  AND s.institute_id = t.institute_id
  AND s.current = true;

UPDATE timetable_template_drafts d
SET academic_session_id = s.id
FROM academic_sessions s
WHERE d.academic_session_id IS NULL
  AND s.institute_id = d.institute_id
  AND s.current = true;

UPDATE class_timetables t
SET class_id = c.id
FROM school_classes c
WHERE t.class_id IS NULL
  AND c.institute_id = t.institute_id
  AND c.status <> 'ARCHIVED'
  AND c.normalized_name = lower(regexp_replace(trim(split_part(replace(t.class_name, '-', '/'), '/', 1)), '\s+', ' ', 'g'));

UPDATE timetable_template_drafts d
SET class_id = c.id
FROM school_classes c
WHERE d.class_id IS NULL
  AND c.institute_id = d.institute_id
  AND c.status <> 'ARCHIVED'
  AND c.normalized_name = lower(regexp_replace(trim(split_part(replace(d.class_name, '-', '/'), '/', 1)), '\s+', ' ', 'g'));

UPDATE class_timetables t
SET section_id = s.id
FROM class_sections s
WHERE t.class_id IS NOT NULL
  AND t.section_id IS NULL
  AND s.institute_id = t.institute_id
  AND s.class_id = t.class_id
  AND s.status <> 'ARCHIVED'
  AND s.normalized_name = lower(regexp_replace(trim(split_part(replace(t.class_name, '-', '/'), '/', 2)), '\s+', ' ', 'g'))
  AND position('/' IN replace(t.class_name, '-', '/')) > 0;

UPDATE timetable_template_drafts d
SET section_id = s.id
FROM class_sections s
WHERE d.class_id IS NOT NULL
  AND d.section_id IS NULL
  AND s.institute_id = d.institute_id
  AND s.class_id = d.class_id
  AND s.status <> 'ARCHIVED'
  AND s.normalized_name = lower(regexp_replace(trim(split_part(replace(d.class_name, '-', '/'), '/', 2)), '\s+', ' ', 'g'))
  AND position('/' IN replace(d.class_name, '-', '/')) > 0;

CREATE TABLE IF NOT EXISTS timetable_legacy_migration_report (
    id BIGSERIAL PRIMARY KEY,
    source_table VARCHAR(80) NOT NULL,
    source_id BIGINT NOT NULL,
    class_name VARCHAR(255),
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO timetable_legacy_migration_report (source_table, source_id, class_name, reason)
SELECT 'class_timetables', t.id, t.class_name, 'Missing academic_session_id or class_id after legacy className migration'
FROM class_timetables t
WHERE t.academic_session_id IS NULL OR t.class_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO timetable_legacy_migration_report (source_table, source_id, class_name, reason)
SELECT 'timetable_template_drafts', d.id, d.class_name, 'Missing academic_session_id or class_id after legacy className migration'
FROM timetable_template_drafts d
WHERE d.academic_session_id IS NULL OR d.class_id IS NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS uk_class_timetable_with_section
    ON class_timetables (institute_id, academic_session_id, class_id, section_id)
    WHERE section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_class_timetable_without_section
    ON class_timetables (institute_id, academic_session_id, class_id)
    WHERE section_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_timetable_draft_with_section
    ON timetable_template_drafts (institute_id, academic_session_id, class_id, section_id)
    WHERE section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_timetable_draft_without_section
    ON timetable_template_drafts (institute_id, academic_session_id, class_id)
    WHERE section_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_timetable_periods_timetable_day_period
    ON timetable_periods (timetable_id, day_of_week, period_number);

CREATE INDEX IF NOT EXISTS idx_timetable_periods_teacher_day_overlap
    ON timetable_periods (teacher_id, day_of_week, start_time, end_time);
