create or replace function sync_cashfree_platform_gateway()
returns trigger language plpgsql as $$
begin
    if TG_OP = 'DELETE' then
        delete from institute_payment_gateway_accounts
        where institute_id = OLD.institute_id and provider = 'CASHFREE';
        return OLD;
    end if;
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

create trigger cashfree_platform_gateway_sync
after insert or update or delete on cashfree_merchant_accounts
for each row execute function sync_cashfree_platform_gateway();

-- Refresh accounts changed since the original platform directory backfill.
update cashfree_merchant_accounts set updated_at = updated_at;
