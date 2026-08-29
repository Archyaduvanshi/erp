create extension if not exists btree_gist;

update transport_route_operations
set status = upper(coalesce(status, 'ACTIVE'));

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select institute_id,
       'DUPLICATE_ACTIVE_ROUTE_OPERATION',
       'transport_route_operations',
       id,
       'Multiple active operations existed for the same route; older duplicate was marked INACTIVE before overlap constraint.'
from (
    select id,
           institute_id,
           row_number() over (
               partition by institute_id, route_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation_rank > 1;

update transport_route_operations operation
set status = 'INACTIVE',
    effective_to = coalesce(operation.effective_from, current_date)
from (
    select id,
           row_number() over (
               partition by institute_id, route_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation.id = ranked.id
  and ranked.operation_rank > 1;

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select institute_id,
       'DUPLICATE_ACTIVE_DRIVER_OPERATION',
       'transport_route_operations',
       id,
       'Multiple active operations existed for the same driver; older duplicate was marked INACTIVE before overlap constraint.'
from (
    select id,
           institute_id,
           row_number() over (
               partition by institute_id, driver_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation_rank > 1;

update transport_route_operations operation
set status = 'INACTIVE',
    effective_to = coalesce(operation.effective_from, current_date)
from (
    select id,
           row_number() over (
               partition by institute_id, driver_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation.id = ranked.id
  and ranked.operation_rank > 1;

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select institute_id,
       'DUPLICATE_ACTIVE_VEHICLE_OPERATION',
       'transport_route_operations',
       id,
       'Multiple active operations existed for the same vehicle; older duplicate was marked INACTIVE before overlap constraint.'
from (
    select id,
           institute_id,
           row_number() over (
               partition by institute_id, vehicle_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation_rank > 1;

update transport_route_operations operation
set status = 'INACTIVE',
    effective_to = coalesce(operation.effective_from, current_date)
from (
    select id,
           row_number() over (
               partition by institute_id, vehicle_id
               order by effective_from desc nulls last, updated_at desc nulls last, id desc
           ) as operation_rank
    from transport_route_operations
    where upper(coalesce(status, 'ACTIVE')) = 'ACTIVE'
      and effective_to is null
) ranked
where operation.id = ranked.id
  and ranked.operation_rank > 1;

alter table if exists transport_route_operations
    add constraint chk_transport_route_operations_status
    check (upper(status) in ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

alter table if exists transport_route_operations
    add constraint chk_transport_route_operations_dates
    check (effective_to is null or effective_from is null or effective_to >= effective_from);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ex_transport_route_operations_route_overlap'
    ) then
        alter table transport_route_operations
            add constraint ex_transport_route_operations_route_overlap
            exclude using gist (
                institute_id with =,
                route_id with =,
                daterange(coalesce(effective_from, '-infinity'::date), coalesce(effective_to, 'infinity'::date), '[]') with &&
            )
            where (upper(status) = 'ACTIVE');
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'ex_transport_route_operations_driver_overlap'
    ) then
        alter table transport_route_operations
            add constraint ex_transport_route_operations_driver_overlap
            exclude using gist (
                institute_id with =,
                driver_id with =,
                daterange(coalesce(effective_from, '-infinity'::date), coalesce(effective_to, 'infinity'::date), '[]') with &&
            )
            where (upper(status) = 'ACTIVE');
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'ex_transport_route_operations_vehicle_overlap'
    ) then
        alter table transport_route_operations
            add constraint ex_transport_route_operations_vehicle_overlap
            exclude using gist (
                institute_id with =,
                vehicle_id with =,
                daterange(coalesce(effective_from, '-infinity'::date), coalesce(effective_to, 'infinity'::date), '[]') with &&
            )
            where (upper(status) = 'ACTIVE');
    end if;
end $$;
