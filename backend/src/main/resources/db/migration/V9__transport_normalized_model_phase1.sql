create table if not exists transport_migration_reports (
    id bigserial primary key,
    institute_id bigint,
    report_type varchar(100) not null,
    legacy_table varchar(100) not null,
    legacy_id bigint,
    message text not null,
    created_at timestamp not null default now()
);

create table if not exists transport_vehicles (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    bus_number varchar(255) not null,
    vehicle_type varchar(255),
    seat_capacity integer,
    status varchar(30) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists ux_transport_vehicles_institute_bus
    on transport_vehicles (institute_id, lower(bus_number));

create table if not exists transport_routes (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    route_name varchar(255) not null,
    route_code varchar(255),
    status varchar(30) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists ux_transport_routes_institute_code
    on transport_routes (institute_id, lower(route_code))
    where route_code is not null;

create table if not exists transport_route_stops (
    id bigserial primary key,
    route_id bigint not null references transport_routes(id),
    stop_name varchar(255) not null,
    stop_order integer not null,
    status varchar(30) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create unique index if not exists ux_transport_route_stops_route_stop
    on transport_route_stops (route_id, lower(stop_name));

create index if not exists idx_transport_route_stops_route_order
    on transport_route_stops (route_id, stop_order);

create table if not exists transport_route_operations (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    route_id bigint not null references transport_routes(id),
    driver_id bigint not null references transport_drivers(id),
    vehicle_id bigint not null references transport_vehicles(id),
    effective_from date,
    effective_to date,
    status varchar(30) not null default 'ACTIVE',
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create index if not exists idx_transport_route_operations_driver_active
    on transport_route_operations (institute_id, driver_id, status, effective_from, effective_to);

create index if not exists idx_transport_route_operations_route_active
    on transport_route_operations (institute_id, route_id, status, effective_from, effective_to);

alter table if exists transport_assignments
    add column if not exists academic_session_id bigint references academic_sessions(id),
    add column if not exists route_id bigint references transport_routes(id),
    add column if not exists pickup_stop_id bigint references transport_route_stops(id),
    add column if not exists status varchar(30) not null default 'ACTIVE';

alter table if exists transport_attendance
    add column if not exists route_id bigint references transport_routes(id),
    add column if not exists route_operation_id bigint references transport_route_operations(id),
    add column if not exists marked_by_user_id bigint;

insert into transport_vehicles (institute_id, bus_number, vehicle_type, seat_capacity, status, created_at, updated_at)
select d.institute_id,
       d.bus_number,
       max(d.vehicle_type),
       max(d.seat_capacity),
       'ACTIVE',
       min(d.created_at),
       max(coalesce(d.updated_at, d.created_at))
from transport_drivers d
where d.bus_number is not null
  and trim(d.bus_number) <> ''
group by d.institute_id, lower(d.bus_number), d.bus_number
on conflict do nothing;

insert into transport_routes (institute_id, route_name, route_code, status, created_at, updated_at)
select d.institute_id,
       d.route_name,
       coalesce(nullif(trim(d.route_code), ''), 'ROUTE-' || upper(regexp_replace(trim(d.route_name), '\s+', '-', 'g'))),
       'ACTIVE',
       min(d.created_at),
       max(coalesce(d.updated_at, d.created_at))
from transport_drivers d
where d.route_name is not null
  and trim(d.route_name) <> ''
group by d.institute_id, d.route_name, coalesce(nullif(trim(d.route_code), ''), 'ROUTE-' || upper(regexp_replace(trim(d.route_name), '\s+', '-', 'g')))
on conflict do nothing;

insert into transport_route_stops (route_id, stop_name, stop_order, status, created_at, updated_at)
select r.id,
       trim(split.stop_name),
       split.stop_order,
       'ACTIVE',
       now(),
       now()
from transport_drivers d
join transport_routes r
  on r.institute_id = d.institute_id
 and lower(r.route_code) = lower(coalesce(nullif(trim(d.route_code), ''), 'ROUTE-' || upper(regexp_replace(trim(d.route_name), '\s+', '-', 'g'))))
cross join lateral regexp_split_to_table(coalesce(d.pickup_points, ''), ',') with ordinality as split(stop_name, stop_order)
where trim(split.stop_name) <> ''
on conflict do nothing;

insert into transport_route_operations (institute_id, route_id, driver_id, vehicle_id, effective_from, effective_to, status, created_at, updated_at)
select d.institute_id,
       r.id,
       d.id,
       v.id,
       coalesce(d.created_at::date, current_date),
       null,
       case when upper(coalesce(d.status, 'ACTIVE')) in ('ACTIVE', 'INACTIVE', 'ARCHIVED') then upper(d.status) else 'ACTIVE' end,
       coalesce(d.created_at, now()),
       coalesce(d.updated_at, d.created_at, now())
from transport_drivers d
join transport_vehicles v
  on v.institute_id = d.institute_id
 and lower(v.bus_number) = lower(d.bus_number)
join transport_routes r
  on r.institute_id = d.institute_id
 and lower(r.route_code) = lower(coalesce(nullif(trim(d.route_code), ''), 'ROUTE-' || upper(regexp_replace(trim(d.route_name), '\s+', '-', 'g'))))
where d.bus_number is not null
  and d.route_name is not null
  and not exists (
      select 1
      from transport_route_operations existing
      where existing.institute_id = d.institute_id
        and existing.driver_id = d.id
        and existing.route_id = r.id
        and existing.vehicle_id = v.id
  );

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select a.institute_id,
       'ACADEMIC_SESSION_FALLBACK',
       'transport_assignments',
       a.id,
       'Assignment could not be mapped by date range; current academic session was used for compatibility.'
from transport_assignments a
join academic_sessions s
  on s.institute_id = a.institute_id
 and s.is_current = true
where a.academic_session_id is null
  and not exists (
      select 1
      from academic_sessions exact
      where exact.institute_id = a.institute_id
        and a.created_at::date between exact.start_date and exact.end_date
  );

update transport_assignments a
set academic_session_id = coalesce(
        (
            select exact.id
            from academic_sessions exact
            where exact.institute_id = a.institute_id
              and a.created_at::date between exact.start_date and exact.end_date
            order by exact.start_date desc
            limit 1
        ),
        (
            select current_session.id
            from academic_sessions current_session
            where current_session.institute_id = a.institute_id
              and current_session.is_current = true
            order by current_session.updated_at desc
            limit 1
        )
    )
where a.academic_session_id is null;

update transport_assignments a
set route_id = o.route_id
from transport_route_operations o
where a.driver_id = o.driver_id
  and a.institute_id = o.institute_id
  and a.route_id is null
  and upper(coalesce(o.status, 'ACTIVE')) = 'ACTIVE';

update transport_assignments a
set pickup_stop_id = s.id
from transport_route_stops s
where a.route_id = s.route_id
  and a.pickup_stop is not null
  and lower(trim(a.pickup_stop)) = lower(trim(s.stop_name))
  and a.pickup_stop_id is null;

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select a.institute_id,
       'UNMATCHED_PICKUP_STOP',
       'transport_assignments',
       a.id,
       'Assignment pickup stop could not be matched to a normalized route stop: ' || coalesce(a.pickup_stop, '')
from transport_assignments a
where a.route_id is not null
  and a.pickup_stop is not null
  and a.pickup_stop_id is null;

update transport_attendance ta
set route_operation_id = o.id,
    route_id = o.route_id
from transport_route_operations o
where ta.driver_id = o.driver_id
  and ta.institute_id = o.institute_id
  and ta.attendance_date >= coalesce(o.effective_from, ta.attendance_date)
  and ta.attendance_date <= coalesce(o.effective_to, ta.attendance_date)
  and ta.route_operation_id is null;

insert into transport_migration_reports (institute_id, report_type, legacy_table, legacy_id, message)
select ta.institute_id,
       'UNRESOLVED_ATTENDANCE_OPERATION',
       'transport_attendance',
       ta.id,
       'Attendance could not be mapped to a normalized route operation.'
from transport_attendance ta
where ta.route_operation_id is null;

drop index if exists ux_transport_assignments_student;

create unique index if not exists ux_transport_assignments_session_student
    on transport_assignments (institute_id, academic_session_id, student_id)
    where academic_session_id is not null;

create index if not exists idx_transport_assignments_session_route
    on transport_assignments (institute_id, academic_session_id, route_id, status);

create index if not exists idx_transport_attendance_route_date
    on transport_attendance (institute_id, route_id, attendance_date)
    where route_id is not null;

delete from transport_attendance ta
using (
    select id,
           row_number() over (
               partition by institute_id, route_id, student_id, attendance_date
               order by updated_at desc nulls last, created_at desc nulls last, id desc
           ) as duplicate_rank
    from transport_attendance
    where route_id is not null
) ranked
where ta.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists ux_transport_attendance_route_student_day
    on transport_attendance (institute_id, route_id, student_id, attendance_date)
    where route_id is not null;

update transport_attendance
set status = case
    when lower(coalesce(status, '')) = 'present' then 'Present'
    when lower(coalesce(status, '')) = 'absent' then 'Absent'
    else 'Absent'
end;

alter table if exists transport_attendance
    add constraint chk_transport_attendance_status
    check (status in ('Present', 'Absent'));

alter table if exists transport_drivers
    add constraint chk_transport_drivers_status
    check (upper(status) in ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

alter table if exists transport_vehicles
    add constraint chk_transport_vehicles_status
    check (upper(status) in ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED'));

alter table if exists transport_routes
    add constraint chk_transport_routes_status
    check (upper(status) in ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

alter table if exists transport_assignments
    add constraint chk_transport_assignments_status
    check (upper(status) in ('ACTIVE', 'INACTIVE'));
