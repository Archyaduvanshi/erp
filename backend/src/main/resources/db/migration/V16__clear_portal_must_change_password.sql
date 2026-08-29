update user_accounts
set must_change_password = false
where role in ('TEACHER', 'STUDENT')
  and must_change_password = true;
