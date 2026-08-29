update teachers
set teacher_portal_password = null
where teacher_portal_password is not null;

update students
set student_portal_password = null
where student_portal_password is not null;

update feature_access
set password_hash = ''
where password_hash is not null and password_hash <> '';
