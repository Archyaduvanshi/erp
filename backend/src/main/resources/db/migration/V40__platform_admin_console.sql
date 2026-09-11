alter table institutes add column if not exists status varchar(20) not null default 'ACTIVE';
alter table institutes add column if not exists status_reason varchar(500);
alter table institutes add column if not exists suspended_at timestamp;
alter table institutes add column if not exists updated_at timestamp not null default now();
alter table institutes add column if not exists version bigint not null default 0;

create table if not exists platform_users (
    id bigserial primary key,
    normalized_username varchar(160) not null,
    display_name varchar(160) not null,
    password_hash varchar(255) not null,
    role varchar(30) not null default 'SUPER_ADMIN',
    status varchar(20) not null default 'ACTIVE',
    failed_login_count integer not null default 0,
    last_failed_login_at timestamp,
    locked_until timestamp,
    last_login_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint uk_platform_users_username unique (normalized_username)
);

create table if not exists platform_auth_sessions (
    id bigserial primary key,
    platform_user_id bigint not null references platform_users(id),
    refresh_token_hash varchar(128) not null,
    created_at timestamp not null default now(),
    expires_at timestamp not null,
    last_used_at timestamp,
    revoked_at timestamp,
    replaced_by_session_id bigint,
    constraint uk_platform_auth_sessions_hash unique (refresh_token_hash)
);

create table if not exists subscription_plans (
    id bigserial primary key,
    code varchar(40) not null,
    name varchar(100) not null,
    monthly_price numeric(14,2) not null default 0,
    yearly_price numeric(14,2) not null default 0,
    max_students integer,
    max_teachers integer,
    max_users integer,
    max_storage_mb integer,
    trial_days integer not null default 14,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint uk_subscription_plans_code unique (code),
    constraint ck_subscription_plan_prices check (monthly_price >= 0 and yearly_price >= 0),
    constraint ck_subscription_plan_limits check (
        (max_students is null or max_students > 0) and
        (max_teachers is null or max_teachers > 0) and
        (max_users is null or max_users > 0) and
        (max_storage_mb is null or max_storage_mb > 0) and
        trial_days >= 0
    )
);

create table if not exists subscription_plan_features (
    plan_id bigint not null references subscription_plans(id) on delete cascade,
    feature_code varchar(60) not null,
    primary key (plan_id, feature_code)
);

create table if not exists institute_feature_overrides (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    feature_code varchar(60) not null,
    enabled boolean not null,
    reason varchar(500),
    updated_by_platform_user_id bigint not null references platform_users(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint uk_institute_feature_override unique (institute_id, feature_code)
);

create table if not exists institute_subscriptions (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    plan_id bigint not null references subscription_plans(id),
    status varchar(20) not null,
    billing_cycle varchar(20) not null,
    start_date date not null,
    end_date date not null,
    amount numeric(14,2) not null default 0,
    currency varchar(3) not null default 'INR',
    auto_renew boolean not null default false,
    change_reason varchar(500),
    created_by_platform_user_id bigint references platform_users(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint ck_institute_subscription_dates check (end_date >= start_date),
    constraint ck_institute_subscription_amount check (amount >= 0)
);

create unique index if not exists uk_institute_subscription_current
    on institute_subscriptions (institute_id)
    where status in ('TRIAL', 'ACTIVE', 'PAST_DUE');

create table if not exists platform_invoices (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    subscription_id bigint references institute_subscriptions(id),
    invoice_number varchar(80) not null,
    amount numeric(14,2) not null,
    tax numeric(14,2) not null default 0,
    total_amount numeric(14,2) not null,
    due_date date not null,
    paid_at timestamp,
    status varchar(20) not null,
    payment_reference varchar(160),
    notes varchar(1000),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint uk_platform_invoices_number unique (invoice_number),
    constraint ck_platform_invoice_amounts check (amount >= 0 and tax >= 0 and total_amount >= 0)
);

create table if not exists institute_internal_notes (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    platform_user_id bigint not null references platform_users(id),
    note varchar(2000) not null,
    created_at timestamp not null default now()
);

create table if not exists platform_audit_logs (
    id bigserial primary key,
    platform_user_id bigint not null references platform_users(id),
    action varchar(80) not null,
    target_type varchar(80) not null,
    target_id varchar(120),
    target_institute_id bigint references institutes(id),
    old_value_json text,
    new_value_json text,
    reason varchar(500),
    ip_address varchar(80),
    user_agent varchar(500),
    created_at timestamp not null default now()
);

create table if not exists platform_settings (
    setting_key varchar(80) primary key,
    setting_value varchar(1000) not null,
    updated_by_platform_user_id bigint references platform_users(id),
    updated_at timestamp not null default now()
);

insert into platform_settings(setting_key, setting_value)
values ('defaultTrialDays', '14'), ('defaultPlan', 'BASIC'), ('registrationEnabled', 'true')
on conflict (setting_key) do nothing;

insert into subscription_plans(code, name, monthly_price, yearly_price, max_students, max_teachers, max_users, max_storage_mb, trial_days)
values
    ('BASIC', 'Basic', 999, 9990, 500, 50, 60, 2048, 14),
    ('STANDARD', 'Standard', 1999, 19990, 1500, 150, 180, 8192, 14),
    ('PRO', 'Pro', 3499, 34990, 5000, 500, 600, 25600, 21),
    ('ENTERPRISE', 'Enterprise', 0, 0, null, null, null, null, 30)
on conflict (code) do nothing;

insert into subscription_plan_features(plan_id, feature_code)
select p.id, f.code
from subscription_plans p
cross join (values
    ('STUDENT_MANAGEMENT'), ('TEACHER_MANAGEMENT'), ('COURSE_SUBJECT'), ('ATTENDANCE'),
    ('TIMETABLE'), ('EXAMINATION'), ('RESULT'), ('FEES'), ('NOTICES')
) as f(code)
where p.code = 'BASIC'
on conflict do nothing;

insert into subscription_plan_features(plan_id, feature_code)
select p.id, f.code
from subscription_plans p
cross join (values
    ('STUDENT_MANAGEMENT'), ('TEACHER_MANAGEMENT'), ('COURSE_SUBJECT'), ('ATTENDANCE'),
    ('TIMETABLE'), ('EXAMINATION'), ('RESULT'), ('FEES'), ('LIBRARY'), ('TRANSPORT'),
    ('SALARY'), ('REPORTS'), ('NOTICES'), ('CASHBOOK')
) as f(code)
where p.code in ('STANDARD', 'PRO', 'ENTERPRISE')
on conflict do nothing;

insert into subscription_plan_features(plan_id, feature_code)
select p.id, f.code
from subscription_plans p
cross join (values ('HOSTEL'), ('LIVE_TRANSPORT_TRACKING')) as f(code)
where p.code in ('PRO', 'ENTERPRISE')
on conflict do nothing;

insert into institute_subscriptions(institute_id, plan_id, status, billing_cycle, start_date, end_date, amount, change_reason)
select i.id, p.id, 'TRIAL', 'CUSTOM', current_date, current_date + p.trial_days, 0, 'Initial platform migration'
from institutes i
join subscription_plans p on p.code = 'BASIC'
where not exists (
    select 1 from institute_subscriptions s
    where s.institute_id = i.id and s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE')
);

create index if not exists idx_institutes_status_registered on institutes(status, registered_date desc);
create index if not exists idx_institutes_lower_name on institutes(lower(institute_name));
create index if not exists idx_institutes_type_state on institutes(type, state);
create index if not exists idx_platform_sessions_user_active on platform_auth_sessions(platform_user_id, revoked_at);
create index if not exists idx_subscriptions_status_end on institute_subscriptions(status, end_date);
create index if not exists idx_subscriptions_institute_created on institute_subscriptions(institute_id, created_at desc);
create index if not exists idx_feature_overrides_institute on institute_feature_overrides(institute_id, feature_code);
create index if not exists idx_platform_invoices_status_due on platform_invoices(status, due_date);
create index if not exists idx_platform_invoices_institute on platform_invoices(institute_id, created_at desc);
create index if not exists idx_internal_notes_institute_created on institute_internal_notes(institute_id, created_at desc);
create index if not exists idx_platform_audit_created on platform_audit_logs(created_at desc);
create index if not exists idx_platform_audit_institute_created on platform_audit_logs(target_institute_id, created_at desc);
create index if not exists idx_students_institute_platform_count on students(institute_id);
create index if not exists idx_teachers_institute_platform_count on teachers(institute_id);
