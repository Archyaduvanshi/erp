alter table teachers
    add column if not exists salary_amount numeric(12,2);

update teachers
set salary_amount = case
    when salary_amount is not null then salary_amount
    when salary is not null and salary ~ '^[0-9]+(\.[0-9]+)?$' then salary::numeric(12,2)
    else 0
end;

alter table teacher_salary_payments
    add column if not exists status varchar(32) not null default 'COMPLETED',
    add column if not exists idempotency_key varchar(120);

alter table teacher_salary_payments
    alter column base_salary type numeric(12,2) using coalesce(base_salary, 0)::numeric(12,2),
    alter column previous_pending_amount type numeric(12,2) using coalesce(previous_pending_amount, 0)::numeric(12,2),
    alter column bonus_amount type numeric(12,2) using coalesce(bonus_amount, 0)::numeric(12,2),
    alter column leave_deduction_amount type numeric(12,2) using coalesce(leave_deduction_amount, 0)::numeric(12,2),
    alter column total_amount type numeric(12,2) using coalesce(total_amount, 0)::numeric(12,2),
    alter column per_day_salary type numeric(12,2) using coalesce(per_day_salary, 0)::numeric(12,2),
    alter column paid_on type date using case
        when paid_on is null then null
        when paid_on::text ~ '^\d{4}-\d{2}-\d{2}$' then paid_on::text::date
        else null
    end;

create table if not exists teacher_payroll_periods (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    teacher_id bigint not null references teachers(id),
    month_key varchar(7) not null,
    base_salary numeric(12,2) not null default 0,
    bonus_amount numeric(12,2) not null default 0,
    leave_deduction_amount numeric(12,2) not null default 0,
    gross_amount numeric(12,2) not null default 0,
    net_payable_amount numeric(12,2) not null default 0,
    paid_amount numeric(12,2) not null default 0,
    outstanding_amount numeric(12,2) not null default 0,
    open_school_days integer not null default 0,
    present_days integer not null default 0,
    absent_days integer not null default 0,
    allowed_leaves integer not null default 0,
    extra_leave_days integer not null default 0,
    per_day_salary numeric(12,2) not null default 0,
    status varchar(32) not null default 'OPEN',
    note varchar(2000),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create table if not exists salary_payment_allocations (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    teacher_id bigint not null references teachers(id),
    salary_payment_id bigint not null references teacher_salary_payments(id),
    payroll_period_id bigint not null references teacher_payroll_periods(id),
    allocated_amount numeric(12,2) not null,
    created_at timestamp not null default now()
);

create unique index if not exists uk_teacher_payroll_period_teacher_month
    on teacher_payroll_periods (institute_id, teacher_id, month_key);

create unique index if not exists uk_salary_payments_institute_idempotency
    on teacher_salary_payments (institute_id, idempotency_key)
    where idempotency_key is not null and idempotency_key <> '';

create index if not exists idx_teacher_payroll_periods_month_status
    on teacher_payroll_periods (institute_id, month_key, status);

create index if not exists idx_teacher_payroll_periods_teacher_month
    on teacher_payroll_periods (institute_id, teacher_id, month_key);

create index if not exists idx_salary_payments_month_status
    on teacher_salary_payments (institute_id, month_key, status);

create index if not exists idx_salary_payment_allocations_period
    on salary_payment_allocations (payroll_period_id);

create index if not exists idx_salary_payment_allocations_teacher
    on salary_payment_allocations (institute_id, teacher_id);
