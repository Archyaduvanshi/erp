alter table fee_payments
    add column if not exists payment_origin varchar(32) not null default 'MANUAL',
    add column if not exists gateway_attempt_id bigint;

create table if not exists cashfree_merchant_accounts (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    merchant_id varchar(40) not null,
    onboarding_status varchar(64) not null default 'PENDING',
    product_status varchar(64),
    payments_enabled boolean not null default false,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uk_cashfree_merchant_institute unique (institute_id),
    constraint uk_cashfree_merchant_id unique (merchant_id)
);

create table if not exists cashfree_payment_attempts (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    student_id bigint not null references students(id),
    academic_session_id bigint references academic_sessions(id),
    merchant_account_id bigint not null references cashfree_merchant_accounts(id),
    order_id varchar(120) not null,
    cf_order_id varchar(120),
    cf_payment_id varchar(120),
    payment_session_id text,
    idempotency_key varchar(120) not null,
    amount numeric(12,2) not null,
    currency varchar(8) not null default 'INR',
    status varchar(32) not null default 'CREATED',
    payment_mode varchar(64),
    bank_reference varchar(160),
    failure_reason varchar(1000),
    fee_payment_id bigint references fee_payments(id),
    paid_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint chk_cashfree_attempt_amount check (amount > 0),
    constraint chk_cashfree_attempt_currency check (currency = 'INR'),
    constraint chk_cashfree_attempt_status check (status in ('CREATED','ACTIVE','PENDING','SUCCESS','FAILED','USER_DROPPED','EXPIRED')),
    constraint uk_cashfree_attempt_order unique (order_id),
    constraint uk_cashfree_attempt_idempotency unique (institute_id, idempotency_key)
);

create unique index if not exists uk_cashfree_attempt_payment
    on cashfree_payment_attempts (cf_payment_id)
    where cf_payment_id is not null;

create table if not exists cashfree_webhook_events (
    id bigserial primary key,
    event_key varchar(220) not null,
    event_type varchar(120) not null,
    merchant_id varchar(40),
    order_id varchar(120),
    cf_payment_id varchar(120),
    payload_hash varchar(64) not null,
    status varchar(32) not null default 'RECEIVED',
    failure_reason varchar(1000),
    received_at timestamp not null default now(),
    processed_at timestamp,
    constraint uk_cashfree_webhook_event unique (event_key),
    constraint chk_cashfree_webhook_status check (status in ('RECEIVED','PROCESSED','IGNORED','FAILED'))
);

create index if not exists idx_cashfree_attempt_student_created
    on cashfree_payment_attempts (institute_id, student_id, created_at desc);

create index if not exists idx_cashfree_attempt_status_created
    on cashfree_payment_attempts (institute_id, status, created_at desc);

create index if not exists idx_cashfree_webhook_order
    on cashfree_webhook_events (merchant_id, order_id, received_at desc);
