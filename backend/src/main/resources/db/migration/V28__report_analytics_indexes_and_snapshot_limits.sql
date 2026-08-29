create index if not exists idx_report_snapshots_page
    on report_snapshots(institute_id, generated_at desc);

create index if not exists idx_attendance_sessions_report
    on attendance_sessions(institute_id, academic_session_id, class_id, section_id, attendance_date);

create index if not exists idx_attendance_entries_report
    on attendance_entries(attendance_session_id, student_id, status);

create index if not exists idx_student_marks_report
    on student_marks(institute_id, academic_session_id, exam_id, class_id, subject_id, student_id);

create index if not exists idx_students_report
    on students(institute_id, assigned_class, section, status);

create index if not exists idx_teachers_report
    on teachers(institute_id, specialization, status);
