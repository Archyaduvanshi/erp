create table if not exists teacher_salary_profiles (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    teacher_id bigint not null references teachers(id),
    base_salary numeric(12,2) not null default 0,
    effective_from date not null,
    effective_to date,
    status varchar(32) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

insert into teacher_salary_profiles (
    institute_id,
    teacher_id,
    base_salary,
    effective_from,
    status,
    created_at,
    updated_at
)
select
    t.institute_id,
    t.id,
    coalesce(t.salary_amount, 0)::numeric(12,2),
    case
        when t.joining_date is not null and t.joining_date ~ '^\d{4}-\d{2}-\d{2}$' then t.joining_date::date
        else date '1970-01-01'
    end,
    'ACTIVE',
    now(),
    now()
from teachers t
where coalesce(t.salary_amount, 0) > 0
  and not exists (
      select 1
      from teacher_salary_profiles p
      where p.institute_id = t.institute_id
        and p.teacher_id = t.id
        and p.status = 'ACTIVE'
  );

alter table teacher_payroll_periods
    add column if not exists academic_session_id bigint references academic_sessions(id),
    add column if not exists paid_leave_days integer not null default 0,
    add column if not exists unpaid_leave_days integer not null default 0,
    add column if not exists half_days integer not null default 0,
    add column if not exists missing_attendance_days integer not null default 0,
    add column if not exists generated_at timestamp,
    add column if not exists generated_by_account_id bigint;

alter table teacher_salary_payments
    add column if not exists payment_reference varchar(40),
    add column if not exists payment_mode varchar(60),
    add column if not exists transaction_reference varchar(120),
    add column if not exists created_by_account_id bigint,
    add column if not exists voided_by_account_id bigint,
    add column if not exists voided_at timestamp,
    add column if not exists void_reason varchar(2000);

alter table salary_payment_allocations
    add column if not exists allocated_amount numeric(12,2);

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_name = 'salary_payment_allocations'
          and column_name = 'amount'
    ) then
        execute 'update salary_payment_allocations set allocated_amount = amount where allocated_amount is null';
    end if;
end $$;

alter table salary_payment_allocations
    alter column allocated_amount set not null;

update teacher_salary_payments
set payment_reference = concat('SAL-', extract(year from coalesce(paid_on, created_at::date))::int, '-', lpad(id::text, 6, '0'))
where payment_reference is null or payment_reference = '';

create index if not exists idx_teacher_salary_profiles_teacher_effective
    on teacher_salary_profiles (institute_id, teacher_id, effective_from);

create index if not exists idx_teacher_salary_profiles_status
    on teacher_salary_profiles (institute_id, status);

create index if not exists idx_teacher_payroll_periods_session
    on teacher_payroll_periods (institute_id, academic_session_id);

create unique index if not exists uk_salary_payments_institute_reference
    on teacher_salary_payments (institute_id, payment_reference)
    where payment_reference is not null and payment_reference <> '';

create unique index if not exists uk_salary_payments_institute_transaction
    on teacher_salary_payments (institute_id, lower(transaction_reference))
    where transaction_reference is not null and transaction_reference <> '' and status <> 'VOIDED';

create index if not exists idx_salary_payments_teacher_date
    on teacher_salary_payments (institute_id, teacher_id, paid_on);

create index if not exists idx_salary_payments_date
    on teacher_salary_payments (institute_id, paid_on);

create index if not exists idx_salary_payments_status
    on teacher_salary_payments (institute_id, status);

create index if not exists idx_salary_payment_allocations_payment
    on salary_payment_allocations (salary_payment_id);

create index if not exists idx_salary_payment_allocations_institute_period
    on salary_payment_allocations (institute_id, payroll_period_id);
