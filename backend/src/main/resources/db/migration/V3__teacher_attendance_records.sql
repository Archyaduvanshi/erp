CREATE TABLE IF NOT EXISTS teacher_attendance_records (
    id BIGSERIAL PRIMARY KEY,
    institute_id BIGINT NOT NULL REFERENCES institutes(id),
    teacher_id BIGINT NOT NULL REFERENCES teachers(id),
    attendance_date DATE NOT NULL,
    status VARCHAR(255) NOT NULL,
    marked_by VARCHAR(255) NOT NULL,
    marked_by_user_id BIGINT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    CONSTRAINT uk_teacher_attendance_institute_teacher_date UNIQUE (institute_id, teacher_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_institute_date
    ON teacher_attendance_records (institute_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_date
    ON teacher_attendance_records (teacher_id, attendance_date);
