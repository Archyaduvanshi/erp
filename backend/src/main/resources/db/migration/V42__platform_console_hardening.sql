create or replace view platform_current_subscriptions as
select ranked.*,
       case
           when ranked.status in ('TRIAL', 'ACTIVE', 'PAST_DUE') and ranked.end_date < current_date then 'EXPIRED'
           else ranked.status
       end as effective_status
from (
    select s.*,
           row_number() over (
               partition by s.institute_id
               order by case when s.status in ('TRIAL', 'ACTIVE', 'PAST_DUE') then 0 else 1 end,
                        s.created_at desc,
                        s.id desc
           ) as current_rank
    from institute_subscriptions s
) ranked
where ranked.current_rank = 1;

create sequence if not exists platform_invoice_number_seq start with 1000;

create table if not exists institute_payment_gateway_accounts (
    id bigserial primary key,
    institute_id bigint not null references institutes(id) on delete cascade,
    provider varchar(32) not null,
    external_account_id varchar(160),
    onboarding_status varchar(64) not null default 'NOT_CONFIGURED',
    product_status varchar(64),
    payments_enabled boolean not null default false,
    last_sync_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    version bigint not null default 0,
    constraint uk_institute_gateway_provider unique (institute_id, provider),
    constraint ck_institute_gateway_provider check (provider in ('CASHFREE', 'RAZORPAY'))
);

insert into institute_payment_gateway_accounts(
    institute_id, provider, external_account_id, onboarding_status, product_status,
    payments_enabled, last_sync_at, created_at, updated_at
)
select institute_id, 'CASHFREE', merchant_id, onboarding_status, product_status,
       payments_enabled, updated_at, created_at, updated_at
from cashfree_merchant_accounts
on conflict (institute_id, provider) do update
set external_account_id = excluded.external_account_id,
    onboarding_status = excluded.onboarding_status,
    product_status = excluded.product_status,
    payments_enabled = excluded.payments_enabled,
    last_sync_at = excluded.last_sync_at,
    updated_at = excluded.updated_at;

create index if not exists idx_institutes_lower_code on institutes(lower(username));
create index if not exists idx_institutes_lower_email on institutes(lower(email));
create index if not exists idx_institutes_state_city on institutes(state, city);
create index if not exists idx_subscriptions_institute_status_created
    on institute_subscriptions(institute_id, status, created_at desc, id desc);
create index if not exists idx_gateway_provider_status
    on institute_payment_gateway_accounts(provider, onboarding_status, institute_id);
create index if not exists idx_platform_invoices_created
    on platform_invoices(created_at desc, id desc);
create index if not exists idx_platform_audit_action_created
    on platform_audit_logs(action, created_at desc);
create index if not exists idx_platform_audit_actor_created
    on platform_audit_logs(platform_user_id, created_at desc);
