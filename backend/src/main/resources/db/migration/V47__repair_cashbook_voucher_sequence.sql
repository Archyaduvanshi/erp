-- Databases baselined after V31 may contain cashbook tables without this sequence.
create sequence if not exists cashbook_voucher_sequence start with 1 increment by 1;

-- Preserve an existing sequence and advance beyond vouchers already issued.
select setval('cashbook_voucher_sequence', greatest(
    (select last_value from cashbook_voucher_sequence),
    coalesce((select max(substring(voucher_number from '^[A-Z]{3}-[0-9]{4}-([0-9]+)$')::bigint)
              from cashbook_entries where voucher_number ~ '^[A-Z]{3}-[0-9]{4}-[0-9]+$'), 0),
    1
), true);
