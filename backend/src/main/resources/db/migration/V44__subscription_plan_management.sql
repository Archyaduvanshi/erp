alter table subscription_plans drop constraint ck_subscription_plan_limits;
alter table subscription_plans add constraint ck_subscription_plan_limits check (
    (max_students is null or max_students >= 0) and
    (max_teachers is null or max_teachers >= 0) and
    (max_users is null or max_users >= 0) and
    (max_storage_mb is null or max_storage_mb >= 0) and trial_days between 0 and 365
);
update subscription_plans set status='INACTIVE' where status='ARCHIVED';
update subscription_plans set code=upper(trim(code));
update platform_settings set setting_value=upper(trim(setting_value)) where setting_key='defaultPlan';
-- The existing unique(code) constraint now also guarantees normalized uniqueness.
alter table subscription_plans add constraint ck_subscription_plan_code check (code=upper(trim(code)) and code ~ '^[A-Z0-9_]{1,40}$');
alter table subscription_plans add constraint ck_subscription_plan_status check (status in ('ACTIVE','INACTIVE'));
alter table institute_subscriptions add constraint ck_subscription_status check (status in ('TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED'));
alter table institute_subscriptions add constraint ck_subscription_cycle check (billing_cycle in ('MONTHLY','YEARLY','CUSTOM'));
create index idx_subscription_plan_status_price on subscription_plans(status,monthly_price,id);
create index idx_subscriptions_plan on institute_subscriptions(plan_id);
-- System registration and scheduled expiry have no authenticated platform user.
alter table platform_audit_logs alter column platform_user_id drop not null;
