create table if not exists user_accounts (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    role varchar(20) not null,
    normalized_login_identifier varchar(120) not null,
    password_hash varchar(255) not null,
    status varchar(20) not null default 'ACTIVE',
    must_change_password boolean not null default false,
    failed_login_count integer not null default 0,
    last_failed_login_at timestamp,
    locked_until timestamp,
    password_changed_at timestamp,
    teacher_id bigint references teachers(id),
    student_id bigint references students(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists uk_user_accounts_institute_identifier
    on user_accounts (institute_id, normalized_login_identifier);

create index if not exists idx_user_accounts_teacher
    on user_accounts (institute_id, teacher_id)
    where teacher_id is not null;

create index if not exists idx_user_accounts_student
    on user_accounts (institute_id, student_id)
    where student_id is not null;

create table if not exists auth_sessions (
    id bigserial primary key,
    account_id bigint not null references user_accounts(id),
    refresh_token_hash varchar(128) not null,
    created_at timestamp not null default now(),
    expires_at timestamp not null,
    last_used_at timestamp,
    revoked_at timestamp,
    replaced_by_session_id bigint,
    user_agent_hash varchar(128)
);

create unique index if not exists uk_auth_sessions_refresh_hash
    on auth_sessions (refresh_token_hash);

create index if not exists idx_auth_sessions_account_active
    on auth_sessions (account_id, revoked_at);

create table if not exists password_reset_tokens (
    id bigserial primary key,
    account_id bigint not null references user_accounts(id),
    token_hash varchar(128) not null,
    created_at timestamp not null default now(),
    expires_at timestamp not null,
    used_at timestamp
);

create unique index if not exists uk_password_reset_tokens_hash
    on password_reset_tokens (token_hash);

create index if not exists idx_password_reset_tokens_account_expiry
    on password_reset_tokens (account_id, expires_at);
