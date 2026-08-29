create unique index if not exists uk_institutes_username_lower
    on institutes (lower(username));

create unique index if not exists uk_institutes_email_lower
    on institutes (lower(email));

create unique index if not exists uk_institutes_affiliation_no_lower
    on institutes (lower(affiliation_no));

create unique index if not exists uk_teachers_institute_employee_id_lower
    on teachers (institute_id, lower(employee_id))
    where employee_id is not null;

create unique index if not exists uk_teachers_institute_personal_email_lower
    on teachers (institute_id, lower(personal_email))
    where personal_email is not null;

create unique index if not exists uk_students_institute_enrollment_no_lower
    on students (institute_id, lower(enrollment_no))
    where enrollment_no is not null;

create unique index if not exists uk_students_institute_email_lower
    on students (institute_id, lower(email))
    where email is not null;

create unique index if not exists uk_user_accounts_institute_identifier_lower
    on user_accounts (institute_id, lower(normalized_login_identifier));
