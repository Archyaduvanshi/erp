create sequence if not exists cashbook_voucher_sequence start with 1 increment by 1;

create table if not exists financial_accounts (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    name varchar(160) not null,
    type varchar(32) not null default 'CASH',
    bank_name varchar(160),
    account_number_last4 varchar(4),
    opening_balance numeric(14,2) not null default 0,
    opening_date date,
    status varchar(32) not null default 'ACTIVE',
    created_by_account_id bigint,
    created_at timestamp not null default now(),
    updated_at timestamp,
    constraint chk_financial_account_type check (type in ('CASH','BANK','UPI','WALLET','OTHER')),
    constraint chk_financial_account_status check (status in ('ACTIVE','ARCHIVED'))
);

create table if not exists financial_categories (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    type varchar(32) not null,
    code varchar(80) not null,
    name varchar(160) not null,
    status varchar(32) not null default 'ACTIVE',
    system_category boolean not null default false,
    created_at timestamp not null default now(),
    updated_at timestamp,
    constraint chk_financial_category_type check (type in ('INCOME','EXPENSE')),
    constraint chk_financial_category_status check (status in ('ACTIVE','ARCHIVED')),
    constraint uq_financial_category_code unique (institute_id, type, code)
);

create table if not exists cashbook_entries (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    academic_session_id bigint references academic_sessions(id) on delete set null,
    transaction_date date not null,
    entry_type varchar(32) not null,
    category_id bigint references financial_categories(id) on delete set null,
    category_code varchar(80) not null,
    category_label varchar(160) not null,
    amount numeric(14,2) not null,
    account_id bigint not null references financial_accounts(id),
    payment_mode varchar(40) not null default 'Cash',
    payer_payee_name varchar(220),
    description varchar(2000),
    source_type varchar(40) not null,
    source_id bigint,
    voucher_number varchar(40) not null,
    reference_number varchar(160),
    status varchar(32) not null default 'POSTED',
    reversal_of_entry_id bigint references cashbook_entries(id),
    transfer_reference_id varchar(80),
    attachment_url varchar(1000),
    attachment_name varchar(255),
    attachment_content_type varchar(120),
    idempotency_key varchar(120),
    created_by_account_id bigint,
    created_at timestamp not null default now(),
    updated_at timestamp,
    voided_at timestamp,
    voided_by_account_id bigint,
    void_reason varchar(1000),
    constraint chk_cashbook_entry_amount check (amount > 0),
    constraint chk_cashbook_entry_type check (entry_type in ('INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','REFUND_IN','REFUND_OUT','ADJUSTMENT')),
    constraint chk_cashbook_entry_status check (status in ('POSTED','VOIDED')),
    constraint uq_cashbook_voucher unique (institute_id, voucher_number)
);

create unique index if not exists uq_cashbook_source_entry
    on cashbook_entries(institute_id, source_type, source_id)
    where source_id is not null
      and reversal_of_entry_id is null
      and source_type in ('FEE_PAYMENT','SALARY_PAYMENT','FEE_PAYMENT_VOID','SALARY_PAYMENT_VOID');

create unique index if not exists uq_cashbook_idempotency
    on cashbook_entries(institute_id, idempotency_key)
    where idempotency_key is not null and length(trim(idempotency_key)) > 0;

create index if not exists idx_cashbook_institute_date on cashbook_entries(institute_id, transaction_date desc);
create index if not exists idx_cashbook_institute_type_date on cashbook_entries(institute_id, entry_type, transaction_date desc);
create index if not exists idx_cashbook_institute_account_date on cashbook_entries(institute_id, account_id, transaction_date desc);
create index if not exists idx_cashbook_institute_category_date on cashbook_entries(institute_id, category_id, transaction_date desc);
create index if not exists idx_cashbook_institute_source on cashbook_entries(institute_id, source_type, source_id);
create index if not exists idx_cashbook_institute_status_date on cashbook_entries(institute_id, status, transaction_date desc);
create index if not exists idx_cashbook_institute_mode_date on cashbook_entries(institute_id, payment_mode, transaction_date desc);
create index if not exists idx_financial_accounts_institute_status on financial_accounts(institute_id, status, type);
create index if not exists idx_financial_categories_institute_type on financial_categories(institute_id, type, status);
