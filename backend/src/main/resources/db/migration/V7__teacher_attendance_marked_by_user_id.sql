ALTER TABLE teacher_attendance_records
    ADD COLUMN IF NOT EXISTS marked_by_user_id BIGINT;
