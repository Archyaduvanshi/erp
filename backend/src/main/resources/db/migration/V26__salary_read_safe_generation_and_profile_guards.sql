update teacher_salary_profiles
set effective_to = null,
    updated_at = now()
where effective_to is not null
  and effective_to < effective_from;

with duplicate_open_profiles as (
    select id,
           row_number() over (
               partition by institute_id, teacher_id
               order by effective_from desc, id desc
           ) as duplicate_rank
    from teacher_salary_profiles
    where status = 'ACTIVE'
      and effective_to is null
)
update teacher_salary_profiles p
set status = 'ARCHIVED',
    updated_at = now()
from duplicate_open_profiles d
where p.id = d.id
  and d.duplicate_rank > 1;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_teacher_salary_profile_date_range'
    ) then
        alter table teacher_salary_profiles
            add constraint chk_teacher_salary_profile_date_range
            check (effective_to is null or effective_to >= effective_from);
    end if;
end $$;

create unique index if not exists uk_teacher_salary_profiles_one_open_active
    on teacher_salary_profiles (institute_id, teacher_id)
    where status = 'ACTIVE'
      and effective_to is null;

create index if not exists idx_salary_allocations_period_completed
    on salary_payment_allocations (institute_id, payroll_period_id, salary_payment_id);
