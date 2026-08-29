CREATE TABLE IF NOT EXISTS holiday_notice_target_repair_report (
    id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL,
    holiday_id BIGINT NOT NULL,
    old_target_classes TEXT,
    new_target_classes TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH normalized_targets AS (
    SELECT h.id AS holiday_id,
           h.institute_id,
           CASE
               WHEN lower(coalesce(h.audience, '')) = 'students'
                    THEN coalesce(nullif(string_agg(sc.name, ',' ORDER BY sc.name), ''), 'All')
               ELSE 'All'
           END AS target_classes
    FROM holidays h
    LEFT JOIN holiday_target_classes htc ON htc.holiday_id = h.id
    LEFT JOIN school_classes sc ON sc.id = htc.class_id
    GROUP BY h.id, h.institute_id, h.audience
),
changed_notices AS (
    SELECT n.id AS notice_id,
           h.id AS holiday_id,
           n.target_classes AS old_target_classes,
           nt.target_classes AS new_target_classes
    FROM notices n
    JOIN holidays h
      ON h.institute_id = n.institute_id
     AND n.source_type = 'HOLIDAY'
     AND n.source_id = h.id
    JOIN normalized_targets nt
      ON nt.institute_id = h.institute_id
     AND nt.holiday_id = h.id
    WHERE n.target_classes IS DISTINCT FROM nt.target_classes
)
INSERT INTO holiday_notice_target_repair_report (
    notice_id,
    holiday_id,
    old_target_classes,
    new_target_classes,
    reason
)
SELECT notice_id,
       holiday_id,
       old_target_classes,
       new_target_classes,
       'Repaired generated Holiday Notice target_classes from normalized holiday_target_classes'
FROM changed_notices;

WITH normalized_targets AS (
    SELECT h.id AS holiday_id,
           h.institute_id,
           h.title,
           h.holiday_date,
           h.holiday_type,
           h.audience,
           h.notes,
           CASE
               WHEN lower(coalesce(h.audience, '')) = 'students'
                    THEN coalesce(nullif(string_agg(sc.name, ',' ORDER BY sc.name), ''), 'All')
               ELSE 'All'
           END AS target_classes
    FROM holidays h
    LEFT JOIN holiday_target_classes htc ON htc.holiday_id = h.id
    LEFT JOIN school_classes sc ON sc.id = htc.class_id
    GROUP BY h.id, h.institute_id, h.title, h.holiday_date, h.holiday_type, h.audience, h.notes
)
UPDATE notices n
SET target_classes = nt.target_classes,
    details = 'The college has declared ' || nt.title
        || ' on ' || nt.holiday_date
        || E'.\n\nType: ' || nt.holiday_type
        || E'\nAudience: ' || nt.audience
        || CASE WHEN lower(coalesce(nt.audience, '')) = 'students' THEN E'\nClasses: ' || nt.target_classes ELSE '' END
        || CASE WHEN nt.notes IS NOT NULL AND trim(nt.notes) <> '' THEN E'\n\nNotes: ' || nt.notes ELSE '' END,
    updated_at = CURRENT_TIMESTAMP
FROM normalized_targets nt
WHERE n.institute_id = nt.institute_id
  AND n.source_type = 'HOLIDAY'
  AND n.source_id = nt.holiday_id
  AND n.target_classes IS DISTINCT FROM nt.target_classes;
