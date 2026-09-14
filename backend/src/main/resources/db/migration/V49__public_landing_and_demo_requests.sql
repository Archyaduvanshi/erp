-- Public enquiries remain platform-owned; no tenant records are exposed.
create table public_demo_requests (
    id bigserial primary key,
    name varchar(100) not null,
    institute_name varchar(160) not null,
    email varchar(254) not null,
    phone varchar(24) not null,
    institute_type varchar(20) not null check (institute_type in ('School','College','Other')),
    city varchar(100) not null default '',
    approximate_students integer not null check (approximate_students between 1 and 1000000),
    message varchar(2000) not null default '',
    status varchar(20) not null default 'NEW' check (status in ('NEW','CONTACTED','CLOSED')),
    created_at timestamptz not null default now(),
    notification_status varchar(20) not null default 'PENDING' check (notification_status in ('PENDING','SENT','FAILED')),
    notification_attempts integer not null default 0,
    next_notification_at timestamptz not null default now()
);
create index idx_demo_notification_pending on public_demo_requests(next_notification_at) where notification_status='PENDING';
create index idx_demo_request_status on public_demo_requests(status,created_at desc);

-- Atomic, shared rate buckets work across backend replicas and restarts.
create table public_request_limits (
    bucket_key varchar(100) not null,
    window_start bigint not null,
    attempts integer not null,
    expires_at timestamptz not null,
    primary key(bucket_key,window_start)
);
create index idx_public_request_limits_expiry on public_request_limits(expires_at);
