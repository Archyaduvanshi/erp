create table if not exists exams (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint not null references academic_sessions(id),
    name varchar(255) not null,
    normalized_name varchar(255) not null,
    exam_type varchar(255) not null,
    start_date date,
    end_date date,
    status varchar(32) not null default 'SCHEDULED',
    created_by_account_id bigint,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uk_exams_institute_session_name_type_start
        unique (institute_id, academic_session_id, normalized_name, exam_type, start_date)
);

create table if not exists exam_schedules (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint not null references academic_sessions(id),
    exam_id bigint not null references exams(id),
    class_id bigint not null references school_classes(id),
    section_id bigint references class_sections(id),
    subject_id bigint references subjects(id),
    exam_date date,
    shift_number integer,
    start_time time,
    duration_minutes integer,
    room_or_center varchar(255),
    max_marks numeric(10,2),
    status varchar(32) not null default 'PUBLISHED',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

alter table exam_date_sheets add column if not exists academic_session_id bigint references academic_sessions(id);
alter table exam_date_sheets add column if not exists exam_id bigint references exams(id);
alter table exam_date_sheets add column if not exists class_id bigint references school_classes(id);
alter table exam_date_sheets add column if not exists section_id bigint references class_sections(id);
alter table exam_date_sheets add column if not exists status varchar(32) not null default 'PUBLISHED';
alter table exam_date_sheets add column if not exists created_by_account_id bigint;

alter table exam_question_papers add column if not exists academic_session_id bigint references academic_sessions(id);
alter table exam_question_papers add column if not exists exam_id bigint references exams(id);
alter table exam_question_papers add column if not exists class_id bigint references school_classes(id);
alter table exam_question_papers add column if not exists subject_id bigint references subjects(id);
alter table exam_question_papers add column if not exists uploaded_by_account_id bigint;
alter table exam_question_papers add column if not exists uploaded_by_teacher_id bigint references teachers(id);
alter table exam_question_papers add column if not exists status varchar(32) not null default 'DRAFT';
alter table exam_question_papers add column if not exists release_at timestamp;

alter table exam_admit_cards add column if not exists academic_session_id bigint references academic_sessions(id);
alter table exam_admit_cards add column if not exists exam_id bigint references exams(id);
alter table exam_admit_cards add column if not exists real_student_id bigint references students(id);
alter table exam_admit_cards add column if not exists class_id bigint references school_classes(id);
alter table exam_admit_cards add column if not exists section_id bigint references class_sections(id);
alter table exam_admit_cards add column if not exists status varchar(32) not null default 'GENERATED';
alter table exam_admit_cards add column if not exists generated_by_account_id bigint;
alter table exam_admit_cards add column if not exists generated_at timestamp;
alter table exam_admit_cards add column if not exists published_at timestamp;

create index if not exists idx_exams_session_status
    on exams(institute_id, academic_session_id, status);

create index if not exists idx_exams_session_start_date
    on exams(institute_id, academic_session_id, start_date);

create index if not exists idx_exam_schedules_exam_class
    on exam_schedules(institute_id, academic_session_id, exam_id, class_id);

create index if not exists idx_exam_schedules_subject
    on exam_schedules(exam_id, class_id, subject_id);

create unique index if not exists uk_exam_schedules_slot
    on exam_schedules(institute_id, academic_session_id, exam_id, class_id, coalesce(section_id, 0), coalesce(subject_id, 0), coalesce(exam_date, date '1970-01-01'), coalesce(shift_number, 0));

create index if not exists idx_exam_date_sheets_filters
    on exam_date_sheets(institute_id, academic_session_id, exam_id, class_id, status);

create index if not exists idx_exam_question_papers_filters
    on exam_question_papers(institute_id, academic_session_id, exam_id, class_id, subject_id, status);

create index if not exists idx_exam_question_papers_release
    on exam_question_papers(institute_id, release_at, status);

create unique index if not exists uk_exam_question_papers_active_identity
    on exam_question_papers(institute_id, academic_session_id, exam_id, class_id, subject_id)
    where academic_session_id is not null
      and exam_id is not null
      and class_id is not null
      and subject_id is not null
      and status <> 'ARCHIVED';

create index if not exists idx_exam_admit_cards_filters
    on exam_admit_cards(institute_id, academic_session_id, exam_id, class_id, status);

create index if not exists idx_exam_admit_cards_student_status
    on exam_admit_cards(institute_id, real_student_id, status);

create unique index if not exists uk_exam_admit_cards_student_exam
    on exam_admit_cards(institute_id, academic_session_id, exam_id, real_student_id)
    where academic_session_id is not null
      and exam_id is not null
      and real_student_id is not null;
