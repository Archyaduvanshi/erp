CREATE TABLE IF NOT EXISTS holiday_target_classes (
    id BIGSERIAL PRIMARY KEY,
    holiday_id BIGINT NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
    class_id BIGINT NOT NULL REFERENCES school_classes(id),
    CONSTRAINT uk_holiday_target_classes_holiday_class UNIQUE (holiday_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_holidays_institute_date
    ON holidays (institute_id, holiday_date);

CREATE INDEX IF NOT EXISTS idx_holiday_target_classes_holiday
    ON holiday_target_classes (holiday_id);

CREATE INDEX IF NOT EXISTS idx_holiday_target_classes_class
    ON holiday_target_classes (class_id);

CREATE TABLE IF NOT EXISTS holiday_legacy_target_migration_report (
    id BIGSERIAL PRIMARY KEY,
    holiday_id BIGINT NOT NULL,
    token TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH tokens AS (
    SELECT h.id AS holiday_id,
           h.institute_id,
           trim(token.value) AS token
    FROM holidays h
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(h.target_classes, ''), ',') AS token(value)
    WHERE lower(coalesce(h.audience, '')) = 'students'
      AND trim(token.value) <> ''
      AND lower(trim(token.value)) <> 'all'
),
resolved AS (
    SELECT DISTINCT t.holiday_id,
           c.id AS class_id
    FROM tokens t
    JOIN school_classes c
      ON c.institute_id = t.institute_id
     AND c.status <> 'ARCHIVED'
     AND (
          c.normalized_name = lower(regexp_replace(t.token, '\s+', ' ', 'g'))
          OR c.name = t.token
          OR (t.token ~ '^\d+$' AND c.id = t.token::bigint)
     )
)
INSERT INTO holiday_target_classes (holiday_id, class_id)
SELECT holiday_id, class_id
FROM resolved
ON CONFLICT DO NOTHING;

WITH tokens AS (
    SELECT h.id AS holiday_id,
           h.institute_id,
           trim(token.value) AS token
    FROM holidays h
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(h.target_classes, ''), ',') AS token(value)
    WHERE lower(coalesce(h.audience, '')) = 'students'
      AND trim(token.value) <> ''
      AND lower(trim(token.value)) <> 'all'
),
unresolved AS (
    SELECT t.holiday_id,
           t.token
    FROM tokens t
    WHERE NOT EXISTS (
        SELECT 1
        FROM school_classes c
        WHERE c.institute_id = t.institute_id
          AND c.status <> 'ARCHIVED'
          AND (
               c.normalized_name = lower(regexp_replace(t.token, '\s+', ' ', 'g'))
               OR c.name = t.token
               OR (t.token ~ '^\d+$' AND c.id = t.token::bigint)
          )
    )
)
INSERT INTO holiday_legacy_target_migration_report (holiday_id, token, reason)
SELECT holiday_id, token, 'Unable to resolve legacy holiday target class'
FROM unresolved;

WITH ranked_notices AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY institute_id, source_type, source_id
               ORDER BY coalesce(updated_at, created_at) DESC, id DESC
           ) AS rn
    FROM notices
    WHERE source_type IS NOT NULL
      AND source_id IS NOT NULL
)
DELETE FROM notices n
USING ranked_notices r
WHERE n.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uk_notices_institute_source
    ON notices (institute_id, source_type, source_id)
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

INSERT INTO notices (
    institute_id,
    title,
    category,
    audience,
    target_classes,
    priority,
    publish_date,
    expire_date,
    status,
    pinned,
    summary,
    details,
    source_type,
    source_id,
    created_at,
    updated_at
)
SELECT h.institute_id,
       'Holiday: ' || h.title,
       'Holiday',
       h.audience,
       coalesce(nullif(h.target_classes, ''), 'All'),
       'Normal',
       CURRENT_DATE,
       NULL,
       'Published',
       FALSE,
       h.title || ' has been added to the college holiday calendar.',
       'The college has declared ' || h.title
           || ' on ' || h.holiday_date
           || E'.\n\nType: ' || h.holiday_type
           || E'\nAudience: ' || h.audience
           || CASE WHEN lower(h.audience) = 'students' THEN E'\nClasses: ' || coalesce(nullif(h.target_classes, ''), 'All') ELSE '' END
           || CASE WHEN h.notes IS NOT NULL AND trim(h.notes) <> '' THEN E'\n\nNotes: ' || h.notes ELSE '' END,
       'HOLIDAY',
       h.id,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM holidays h
WHERE NOT EXISTS (
    SELECT 1
    FROM notices n
    WHERE n.institute_id = h.institute_id
      AND n.source_type = 'HOLIDAY'
      AND n.source_id = h.id
);
