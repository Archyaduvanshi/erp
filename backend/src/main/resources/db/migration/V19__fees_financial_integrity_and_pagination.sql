create sequence if not exists fee_receipt_seq start with 1 increment by 1;

alter table fee_structures
    add column if not exists academic_session_id bigint,
    add column if not exists status varchar(32) not null default 'ACTIVE';

alter table fee_payments
    add column if not exists academic_session_id bigint,
    add column if not exists idempotency_key varchar(120),
    add column if not exists voided_at timestamp,
    add column if not exists voided_by_account_id bigint,
    add column if not exists void_reason varchar(1000);

alter table fee_structures
    alter column amount type numeric(12,2) using coalesce(amount, 0)::numeric(12,2),
    alter column amount set not null,
    alter column due_date type date using case
        when due_date is null then null
        when due_date::text ~ '^\d{4}-\d{2}-\d{2}$' then due_date::text::date
        else null
    end;

alter table fee_payments
    alter column paid_amount type numeric(12,2) using coalesce(paid_amount, 0)::numeric(12,2),
    alter column paid_amount set not null,
    alter column balance_remaining type numeric(12,2) using coalesce(balance_remaining, 0)::numeric(12,2),
    alter column payment_date type date using case
        when payment_date is null then null
        when payment_date::text ~ '^\d{4}-\d{2}-\d{2}$' then payment_date::text::date
        else null
    end;

update fee_payments
set payment_status = 'COMPLETED'
where lower(coalesce(payment_status, '')) = 'success';

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'fk_fee_structures_academic_session') then
        alter table fee_structures
            add constraint fk_fee_structures_academic_session
            foreign key (academic_session_id) references academic_sessions(id);
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'fk_fee_payments_academic_session') then
        alter table fee_payments
            add constraint fk_fee_payments_academic_session
            foreign key (academic_session_id) references academic_sessions(id);
    end if;
end $$;

create unique index if not exists uk_fee_payments_institute_receipt
    on fee_payments (institute_id, lower(receipt_number))
    where receipt_number is not null;

create unique index if not exists uk_fee_payments_institute_idempotency
    on fee_payments (institute_id, idempotency_key)
    where idempotency_key is not null and idempotency_key <> '';

create unique index if not exists uk_fee_payments_institute_transaction_online
    on fee_payments (institute_id, lower(transaction_id))
    where transaction_id is not null
      and transaction_id <> ''
      and lower(coalesce(mode, '')) <> 'cash'
      and lower(coalesce(payment_status, '')) in ('completed', 'pending_verification', 'success');

create index if not exists idx_fee_structures_institute_session_status
    on fee_structures (institute_id, academic_session_id, status);

create index if not exists idx_fee_structures_institute_session_class
    on fee_structures (institute_id, academic_session_id, course_id);

create index if not exists idx_fee_structures_institute_session_type
    on fee_structures (institute_id, academic_session_id, fee_type);

create index if not exists idx_fee_payments_institute_session_student_date
    on fee_payments (institute_id, academic_session_id, student_id, payment_date);

create index if not exists idx_fee_payments_institute_date
    on fee_payments (institute_id, payment_date);

create index if not exists idx_fee_payments_institute_mode
    on fee_payments (institute_id, mode);

create index if not exists idx_fee_payments_institute_status
    on fee_payments (institute_id, payment_status);

create table if not exists fee_payment_allocations (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint references academic_sessions(id),
    payment_id bigint not null references fee_payments(id),
    student_id bigint not null references students(id),
    fee_structure_id bigint references fee_structures(id),
    amount numeric(12,2) not null,
    month_key varchar(20),
    allocation_type varchar(40),
    fine_amount numeric(12,2) default 0,
    discount_amount numeric(12,2) default 0,
    created_at timestamp not null default now()
);

alter table fee_payment_allocations
    add column if not exists student_fee_charge_id bigint;

create index if not exists idx_fee_payment_allocations_payment
    on fee_payment_allocations (payment_id);

create index if not exists idx_fee_payment_allocations_student_session
    on fee_payment_allocations (institute_id, student_id, academic_session_id);

create index if not exists idx_fee_payment_allocations_structure
    on fee_payment_allocations (institute_id, fee_structure_id);

create index if not exists idx_fee_payment_allocations_charge
    on fee_payment_allocations (student_fee_charge_id);

create table if not exists student_fee_charges (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    academic_session_id bigint references academic_sessions(id),
    student_id bigint not null references students(id),
    fee_structure_id bigint references fee_structures(id),
    charge_type varchar(40) not null,
    amount numeric(12,2) not null,
    due_date date,
    period_key varchar(20),
    status varchar(32) not null default 'OPEN',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'fk_fee_payment_allocations_student_fee_charge') then
        alter table fee_payment_allocations
            add constraint fk_fee_payment_allocations_student_fee_charge
            foreign key (student_fee_charge_id) references student_fee_charges(id);
    end if;
end $$;

create index if not exists idx_student_fee_charges_student_session_status
    on student_fee_charges (institute_id, student_id, academic_session_id, status);

create index if not exists idx_student_fee_charges_due_status
    on student_fee_charges (institute_id, due_date, status);
