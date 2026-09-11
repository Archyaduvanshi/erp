alter table cashfree_merchant_accounts add column is_current boolean not null default true;
alter table cashfree_merchant_accounts add column version bigint not null default 0;
-- Older Hibernate-created databases may not have the V37 named constraint.
alter table cashfree_merchant_accounts drop constraint if exists uk_cashfree_merchant_institute;
create unique index uk_cashfree_merchant_current on cashfree_merchant_accounts(institute_id) where is_current;
create unique index if not exists uk_cashfree_merchant_id on cashfree_merchant_accounts(merchant_id);
-- Merchant IDs stay unique across current and historical accounts, so old orders cannot be reassigned to another institute.
create or replace function sync_cashfree_platform_gateway()
returns trigger language plpgsql as $$
begin
    if TG_OP = 'DELETE' then
        if OLD.is_current then
        delete from institute_payment_gateway_accounts
        where institute_id = OLD.institute_id and provider = 'CASHFREE';
        end if;
        return OLD;
    end if;
    if not NEW.is_current then return NEW; end if;
    insert into institute_payment_gateway_accounts (
        institute_id, provider, external_account_id, onboarding_status,
        product_status, payments_enabled, last_sync_at, created_at, updated_at
    ) values (
        NEW.institute_id, 'CASHFREE', NEW.merchant_id, NEW.onboarding_status,
        NEW.product_status, NEW.payments_enabled, NEW.updated_at, NEW.created_at, NEW.updated_at
    ) on conflict (institute_id, provider) do update set
        external_account_id = excluded.external_account_id,
        onboarding_status = excluded.onboarding_status,
        product_status = excluded.product_status,
        payments_enabled = excluded.payments_enabled,
        last_sync_at = excluded.last_sync_at,
        updated_at = excluded.updated_at,
        version = institute_payment_gateway_accounts.version + 1;
    return NEW;
end;
$$;

