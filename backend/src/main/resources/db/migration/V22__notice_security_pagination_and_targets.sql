ALTER TABLE notices
    ADD COLUMN IF NOT EXISTS created_by_account_id BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by_account_id BIGINT,
    ADD COLUMN IF NOT EXISTS published_by_account_id BIGINT,
    ADD COLUMN IF NOT EXISTS archived_by_account_id BIGINT,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

UPDATE notices
SET published_at = coalesce(published_at, created_at)
WHERE upper(coalesce(status, '')) = 'PUBLISHED';

UPDATE notices
SET archived_at = coalesce(archived_at, updated_at, created_at)
WHERE upper(coalesce(status, '')) = 'ARCHIVED';

CREATE TABLE IF NOT EXISTS notice_target_classes (
    id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    class_id BIGINT NOT NULL REFERENCES school_classes(id),
    CONSTRAINT uk_notice_target_classes_notice_class UNIQUE (notice_id, class_id)
);

CREATE TABLE IF NOT EXISTS notice_legacy_target_migration_report (
    id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL,
    token TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notice_legacy_audience_migration_report (
    id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL,
    audience TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH tokens AS (
    SELECT n.id AS notice_id,
           n.institute_id,
           trim(token.value) AS token
    FROM notices n
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(n.target_classes, ''), ',') AS token(value)
    WHERE upper(coalesce(n.audience, '')) in ('STUDENT', 'STUDENTS')
      AND trim(token.value) <> ''
      AND lower(trim(token.value)) <> 'all'
),
resolved AS (
    SELECT DISTINCT t.notice_id,
           c.id AS class_id
    FROM tokens t
    JOIN school_classes c
      ON c.institute_id = t.institute_id
     AND upper(coalesce(c.status, 'ACTIVE')) <> 'ARCHIVED'
     AND (
          c.normalized_name = lower(regexp_replace(t.token, '\s+', ' ', 'g'))
          OR lower(c.name) = lower(t.token)
          OR (t.token ~ '^\d+$' AND c.id = t.token::bigint)
     )
)
INSERT INTO notice_target_classes (notice_id, class_id)
SELECT notice_id, class_id
FROM resolved
ON CONFLICT DO NOTHING;

WITH tokens AS (
    SELECT n.id AS notice_id,
           n.institute_id,
           trim(token.value) AS token
    FROM notices n
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(n.target_classes, ''), ',') AS token(value)
    WHERE upper(coalesce(n.audience, '')) in ('STUDENT', 'STUDENTS')
      AND trim(token.value) <> ''
      AND lower(trim(token.value)) <> 'all'
),
unresolved AS (
    SELECT t.notice_id,
           t.token
    FROM tokens t
    WHERE NOT EXISTS (
        SELECT 1
        FROM school_classes c
        WHERE c.institute_id = t.institute_id
          AND upper(coalesce(c.status, 'ACTIVE')) <> 'ARCHIVED'
          AND (
               c.normalized_name = lower(regexp_replace(t.token, '\s+', ' ', 'g'))
               OR lower(c.name) = lower(t.token)
               OR (t.token ~ '^\d+$' AND c.id = t.token::bigint)
          )
    )
)
INSERT INTO notice_legacy_target_migration_report (notice_id, token, reason)
SELECT notice_id, token, 'Unable to resolve legacy notice target class'
FROM unresolved;

INSERT INTO notice_legacy_audience_migration_report (notice_id, audience, reason)
SELECT id, audience, 'Unsupported legacy notice audience; future writes are rejected by application validation'
FROM notices
WHERE upper(coalesce(audience, '')) NOT IN ('ALL', 'STUDENT', 'STUDENTS', 'TEACHER', 'TEACHERS')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notices_institute_status_publish
    ON notices (institute_id, status, publish_date);

CREATE INDEX IF NOT EXISTS idx_notices_institute_audience_status_publish
    ON notices (institute_id, audience, status, publish_date);

CREATE INDEX IF NOT EXISTS idx_notices_institute_target_student_status
    ON notices (institute_id, target_student_id, status);

CREATE INDEX IF NOT EXISTS idx_notices_institute_target_teacher_status
    ON notices (institute_id, target_teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_notices_institute_expire
    ON notices (institute_id, expire_date);

CREATE INDEX IF NOT EXISTS idx_notices_institute_created
    ON notices (institute_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notice_target_classes_notice
    ON notice_target_classes (notice_id);

CREATE INDEX IF NOT EXISTS idx_notice_target_classes_class_notice
    ON notice_target_classes (class_id, notice_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notices_audience_supported') THEN
        ALTER TABLE notices
            ADD CONSTRAINT ck_notices_audience_supported
            CHECK (upper(audience) IN ('ALL', 'STUDENTS', 'TEACHERS'))
            NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notices_status_supported') THEN
        ALTER TABLE notices
            ADD CONSTRAINT ck_notices_status_supported
            CHECK (upper(status) IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
            NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notices_priority_supported') THEN
        ALTER TABLE notices
            ADD CONSTRAINT ck_notices_priority_supported
            CHECK (upper(priority) IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
            NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notices_date_range') THEN
        ALTER TABLE notices
            ADD CONSTRAINT ck_notices_date_range
            CHECK (expire_date IS NULL OR publish_date IS NULL OR expire_date >= publish_date)
            NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notices_target_student') THEN
        ALTER TABLE notices
            ADD CONSTRAINT fk_notices_target_student
            FOREIGN KEY (target_student_id) REFERENCES students(id)
            NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notices_target_teacher') THEN
        ALTER TABLE notices
            ADD CONSTRAINT fk_notices_target_teacher
            FOREIGN KEY (target_teacher_id) REFERENCES teachers(id)
            NOT VALID;
    END IF;
END $$;
