-- Databases baselined after V19 may contain Hibernate tables without this sequence.
create sequence if not exists fee_receipt_seq start with 1 increment by 1;
-- Preserve an existing sequence and advance beyond receipts already issued.
select setval('fee_receipt_seq', greatest(
    (select last_value from fee_receipt_seq),
    coalesce((select max(substring(receipt_number from '^FEE-[0-9]{4}-([0-9]+)$')::bigint)
              from fee_payments where receipt_number ~ '^FEE-[0-9]{4}-[0-9]+$'), 0),
    1
), true);
