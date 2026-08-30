CREATE INDEX IF NOT EXISTS idx_timetable_periods_teacher_timetable
    ON timetable_periods (teacher_id, timetable_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher_dashboard
    ON attendance_sessions (institute_id, academic_session_id, attendance_date, period_number, class_id, section_id);

CREATE INDEX IF NOT EXISTS idx_teacher_payroll_periods_teacher_month
    ON teacher_payroll_periods (institute_id, teacher_id, month_key);
