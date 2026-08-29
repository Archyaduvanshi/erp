create table if not exists exam_definitions (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint not null references academic_sessions(id),
    class_id bigint not null references school_classes(id),
    title varchar(255) not null,
    normalized_title varchar(255) not null,
    exam_date date not null default date '1970-01-01',
    status varchar(32) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uk_exam_definitions_institute_session_class_title_date
        unique (institute_id, academic_session_id, class_id, normalized_title, exam_date)
);

create table if not exists marks_registers (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint not null references academic_sessions(id),
    class_id bigint not null references school_classes(id),
    subject_id bigint not null references subjects(id),
    exam_id bigint not null references exam_definitions(id),
    status varchar(32) not null default 'DRAFT',
    created_by_account_id bigint,
    updated_by_account_id bigint,
    version bigint not null default 0,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uk_marks_registers_institute_session_class_subject_exam
        unique (institute_id, academic_session_id, class_id, subject_id, exam_id)
);

create table if not exists result_publications (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint not null references academic_sessions(id),
    class_id bigint not null references school_classes(id),
    exam_id bigint not null references exam_definitions(id),
    status varchar(32) not null default 'DRAFT',
    published_by_account_id bigint,
    published_at timestamp,
    reopened_by_account_id bigint,
    reopened_at timestamp,
    reopen_reason varchar(1000),
    locked_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uk_result_publications_institute_session_class_exam
        unique (institute_id, academic_session_id, class_id, exam_id)
);

alter table student_marks add column if not exists academic_session_id bigint;
alter table student_marks add column if not exists class_id bigint;
alter table student_marks add column if not exists subject_id bigint;
alter table student_marks add column if not exists exam_id bigint;
alter table student_marks add column if not exists marks_register_id bigint;
alter table student_marks add column if not exists status varchar(32) not null default 'PRESENT';
alter table student_marks add column if not exists remarks varchar(1000);
alter table student_marks add column if not exists entered_by_account_id bigint;
alter table student_marks add column if not exists updated_by_account_id bigint;
alter table student_marks add column if not exists version bigint not null default 0;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'fk_student_marks_academic_session') then
        alter table student_marks
            add constraint fk_student_marks_academic_session
            foreign key (academic_session_id) references academic_sessions(id) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'fk_student_marks_school_class') then
        alter table student_marks
            add constraint fk_student_marks_school_class
            foreign key (class_id) references school_classes(id) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'fk_student_marks_subject') then
        alter table student_marks
            add constraint fk_student_marks_subject
            foreign key (subject_id) references subjects(id) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'fk_student_marks_exam') then
        alter table student_marks
            add constraint fk_student_marks_exam
            foreign key (exam_id) references exam_definitions(id) not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'fk_student_marks_register') then
        alter table student_marks
            add constraint fk_student_marks_register
            foreign key (marks_register_id) references marks_registers(id) not valid;
    end if;
end $$;

create index if not exists idx_exam_definitions_session_class
    on exam_definitions(institute_id, academic_session_id, class_id);

create index if not exists idx_marks_registers_session_class_exam
    on marks_registers(institute_id, academic_session_id, class_id, exam_id);

create index if not exists idx_result_publications_session_class_exam
    on result_publications(institute_id, academic_session_id, class_id, exam_id);

create index if not exists idx_student_marks_session_class_exam
    on student_marks(institute_id, academic_session_id, class_id, exam_id);

create index if not exists idx_student_marks_session_student_exam
    on student_marks(institute_id, academic_session_id, student_id, exam_id);

create index if not exists idx_student_marks_session_subject_exam
    on student_marks(institute_id, academic_session_id, subject_id, exam_id);

create index if not exists idx_student_marks_register_student
    on student_marks(marks_register_id, student_id);

create unique index if not exists uk_student_marks_normalized_identity
    on student_marks(institute_id, academic_session_id, exam_id, subject_id, student_id)
    where academic_session_id is not null
      and exam_id is not null
      and subject_id is not null;
