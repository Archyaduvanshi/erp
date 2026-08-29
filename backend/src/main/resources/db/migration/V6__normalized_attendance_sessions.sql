CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGSERIAL PRIMARY KEY,
    institute_id BIGINT NOT NULL REFERENCES institutes(id),
    academic_session_id BIGINT NOT NULL REFERENCES academic_sessions(id),
    class_id BIGINT NOT NULL REFERENCES school_classes(id),
    section_id BIGINT REFERENCES class_sections(id),
    attendance_date DATE NOT NULL,
    period_number INTEGER NOT NULL DEFAULT 1,
    class_subject_id BIGINT REFERENCES class_subjects(id),
    marked_by_teacher_id BIGINT REFERENCES teachers(id),
    marked_by_user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_attendance_sessions_period_positive CHECK (period_number > 0)
);

CREATE TABLE IF NOT EXISTS attendance_entries (
    id BIGSERIAL PRIMARY KEY,
    attendance_session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_attendance_entries_status CHECK (status IN ('Present', 'Absent', 'Leave', 'Late'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_attendance_sessions_with_section
    ON attendance_sessions (institute_id, academic_session_id, class_id, section_id, attendance_date, period_number)
    WHERE section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_attendance_sessions_without_section
    ON attendance_sessions (institute_id, academic_session_id, class_id, attendance_date, period_number)
    WHERE section_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_attendance_entries_session_student
    ON attendance_entries (attendance_session_id, student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_lookup
    ON attendance_sessions (institute_id, academic_session_id, class_id, section_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_month
    ON attendance_sessions (institute_id, academic_session_id, class_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_entries_session_student
    ON attendance_entries (attendance_session_id, student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_entries_student_session
    ON attendance_entries (student_id, attendance_session_id);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_institute_month
    ON teacher_attendance_records (institute_id, attendance_date, teacher_id);

CREATE TABLE IF NOT EXISTS attendance_legacy_migration_report (
    id BIGSERIAL PRIMARY KEY,
    legacy_attendance_record_id BIGINT,
    reason TEXT NOT NULL,
    legacy_class_name TEXT,
    legacy_subject TEXT,
    legacy_marked_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF to_regclass('public.attendance_records') IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO attendance_legacy_migration_report (
        legacy_attendance_record_id,
        reason,
        legacy_class_name,
        legacy_subject,
        legacy_marked_by
    )
    SELECT ar.id,
           concat_ws(', ',
               CASE WHEN aus.id IS NULL THEN 'academic session unresolved' END,
               CASE WHEN sc.id IS NULL THEN 'class unresolved' END,
               CASE WHEN position('/' in coalesce(ar.class_name, '')) > 0 AND csec.id IS NULL THEN 'section unresolved' END,
               CASE WHEN ar.subject IS NOT NULL AND cs.id IS NULL THEN 'subject unresolved' END,
               CASE WHEN ar.marked_by IS NOT NULL AND mt.id IS NULL THEN 'marked-by teacher unresolved' END
           ),
           ar.class_name,
           ar.subject,
           ar.marked_by
    FROM attendance_records ar
    JOIN students st ON st.id = ar.student_id
    LEFT JOIN academic_sessions aus
           ON aus.institute_id = ar.institute_id
          AND lower(aus.name) = lower(coalesce(st.academic_year, ''))
    LEFT JOIN academic_sessions current_aus
           ON current_aus.institute_id = ar.institute_id
          AND current_aus.is_current = true
    LEFT JOIN school_classes sc
           ON sc.institute_id = ar.institute_id
          AND sc.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 1)), '\s+', ' ', 'g'))
    LEFT JOIN class_sections csec
           ON csec.institute_id = ar.institute_id
          AND csec.class_id = sc.id
          AND csec.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 2)), '\s+', ' ', 'g'))
          AND position('/' in coalesce(ar.class_name, '')) > 0
    LEFT JOIN class_subjects cs
           ON cs.institute_id = ar.institute_id
          AND cs.academic_session_id = coalesce(aus.id, current_aus.id)
          AND cs.class_id = sc.id
          AND EXISTS (
              SELECT 1
              FROM subjects sub
              WHERE sub.id = cs.subject_id
                AND lower(sub.name) = lower(coalesce(ar.subject, ''))
          )
    LEFT JOIN teachers mt
           ON mt.institute_id = ar.institute_id
          AND lower(coalesce(nullif(trim(concat(coalesce(mt.first_name, ''), ' ', coalesce(mt.last_name, ''))), ''), mt.name, mt.employee_id, '')) = lower(coalesce(ar.marked_by, ''))
    WHERE coalesce(aus.id, current_aus.id) IS NULL
       OR sc.id IS NULL
       OR (position('/' in coalesce(ar.class_name, '')) > 0 AND csec.id IS NULL)
       OR (ar.subject IS NOT NULL AND cs.id IS NULL)
       OR (ar.marked_by IS NOT NULL AND mt.id IS NULL);

    INSERT INTO attendance_sessions (
        institute_id,
        academic_session_id,
        class_id,
        section_id,
        attendance_date,
        period_number,
        class_subject_id,
        marked_by_teacher_id,
        created_at,
        updated_at
    )
    SELECT DISTINCT ON (
        ar.institute_id,
        coalesce(aus.id, current_aus.id),
        sc.id,
        csec.id,
        ar.attendance_date,
        coalesce(nullif(regexp_replace(coalesce(ar.lecture_number, '1'), '\D', '', 'g'), '')::integer, 1)
    )
        ar.institute_id,
        coalesce(aus.id, current_aus.id),
        sc.id,
        csec.id,
        ar.attendance_date,
        coalesce(nullif(regexp_replace(coalesce(ar.lecture_number, '1'), '\D', '', 'g'), '')::integer, 1),
        cs.id,
        mt.id,
        min(ar.created_at),
        max(coalesce(ar.updated_at, ar.created_at))
    FROM attendance_records ar
    JOIN students st ON st.id = ar.student_id
    LEFT JOIN academic_sessions aus
           ON aus.institute_id = ar.institute_id
          AND lower(aus.name) = lower(coalesce(st.academic_year, ''))
    LEFT JOIN academic_sessions current_aus
           ON current_aus.institute_id = ar.institute_id
          AND current_aus.is_current = true
    JOIN school_classes sc
           ON sc.institute_id = ar.institute_id
          AND sc.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 1)), '\s+', ' ', 'g'))
    LEFT JOIN class_sections csec
           ON csec.institute_id = ar.institute_id
          AND csec.class_id = sc.id
          AND csec.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 2)), '\s+', ' ', 'g'))
          AND position('/' in coalesce(ar.class_name, '')) > 0
    LEFT JOIN class_subjects cs
           ON cs.institute_id = ar.institute_id
          AND cs.academic_session_id = coalesce(aus.id, current_aus.id)
          AND cs.class_id = sc.id
          AND EXISTS (
              SELECT 1
              FROM subjects sub
              WHERE sub.id = cs.subject_id
                AND lower(sub.name) = lower(coalesce(ar.subject, ''))
          )
    LEFT JOIN teachers mt
           ON mt.institute_id = ar.institute_id
          AND lower(coalesce(nullif(trim(concat(coalesce(mt.first_name, ''), ' ', coalesce(mt.last_name, ''))), ''), mt.name, mt.employee_id, '')) = lower(coalesce(ar.marked_by, ''))
    WHERE coalesce(aus.id, current_aus.id) IS NOT NULL
      AND sc.id IS NOT NULL
      AND (position('/' in coalesce(ar.class_name, '')) = 0 OR csec.id IS NOT NULL)
    GROUP BY ar.institute_id, coalesce(aus.id, current_aus.id), sc.id, csec.id, ar.attendance_date, ar.lecture_number, cs.id, mt.id
    ON CONFLICT DO NOTHING;

    INSERT INTO attendance_entries (
        attendance_session_id,
        student_id,
        status,
        created_at,
        updated_at
    )
    SELECT s.id,
           ar.student_id,
           CASE
               WHEN lower(coalesce(ar.status, '')) IN ('present', 'p') THEN 'Present'
               WHEN lower(coalesce(ar.status, '')) IN ('absent', 'a') THEN 'Absent'
               WHEN lower(coalesce(ar.status, '')) = 'leave' THEN 'Leave'
               WHEN lower(coalesce(ar.status, '')) = 'late' THEN 'Late'
               ELSE 'Absent'
           END,
           ar.created_at,
           coalesce(ar.updated_at, ar.created_at)
    FROM attendance_records ar
    JOIN students st ON st.id = ar.student_id
    LEFT JOIN academic_sessions aus
           ON aus.institute_id = ar.institute_id
          AND lower(aus.name) = lower(coalesce(st.academic_year, ''))
    LEFT JOIN academic_sessions current_aus
           ON current_aus.institute_id = ar.institute_id
          AND current_aus.is_current = true
    JOIN school_classes sc
           ON sc.institute_id = ar.institute_id
          AND sc.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 1)), '\s+', ' ', 'g'))
    LEFT JOIN class_sections csec
           ON csec.institute_id = ar.institute_id
          AND csec.class_id = sc.id
          AND csec.normalized_name = upper(regexp_replace(trim(split_part(coalesce(ar.class_name, ''), '/', 2)), '\s+', ' ', 'g'))
          AND position('/' in coalesce(ar.class_name, '')) > 0
    JOIN attendance_sessions s
           ON s.institute_id = ar.institute_id
          AND s.academic_session_id = coalesce(aus.id, current_aus.id)
          AND s.class_id = sc.id
          AND ((s.section_id IS NULL AND csec.id IS NULL) OR s.section_id = csec.id)
          AND s.attendance_date = ar.attendance_date
          AND s.period_number = coalesce(nullif(regexp_replace(coalesce(ar.lecture_number, '1'), '\D', '', 'g'), '')::integer, 1)
    WHERE coalesce(aus.id, current_aus.id) IS NOT NULL
      AND (position('/' in coalesce(ar.class_name, '')) = 0 OR csec.id IS NOT NULL)
    ON CONFLICT DO NOTHING;
END $$;
