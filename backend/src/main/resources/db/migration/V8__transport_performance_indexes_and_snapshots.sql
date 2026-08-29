alter table if exists transport_attendance
    add column if not exists pickup_stop_snapshot varchar(255),
    add column if not exists route_name_snapshot varchar(255),
    add column if not exists bus_number_snapshot varchar(255),
    add column if not exists driver_name_snapshot varchar(255);

update transport_attendance ta
set pickup_stop_snapshot = coalesce(
        ta.pickup_stop_snapshot,
        (
            select a.pickup_stop
            from transport_assignments a
            where a.institute_id = ta.institute_id
              and a.student_id = ta.student_id
              and a.driver_id = ta.driver_id
            order by a.updated_at desc nulls last, a.created_at desc nulls last, a.id desc
            limit 1
        )
    ),
    route_name_snapshot = coalesce(ta.route_name_snapshot, d.route_name),
    bus_number_snapshot = coalesce(ta.bus_number_snapshot, d.bus_number),
    driver_name_snapshot = coalesce(ta.driver_name_snapshot, d.driver_name)
from transport_drivers d
where ta.driver_id = d.id;

delete from transport_attendance ta
using (
    select id,
           row_number() over (
               partition by institute_id, driver_id, student_id, attendance_date
               order by updated_at desc nulls last, created_at desc nulls last, id desc
           ) as duplicate_rank
    from transport_attendance
) ranked
where ta.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists ux_transport_attendance_daily_driver_student
    on transport_attendance (institute_id, driver_id, student_id, attendance_date);

create index if not exists idx_transport_attendance_driver_date
    on transport_attendance (institute_id, driver_id, attendance_date);

create index if not exists idx_transport_attendance_student_date
    on transport_attendance (institute_id, student_id, attendance_date);

create index if not exists idx_transport_assignments_driver
    on transport_assignments (institute_id, driver_id);

delete from transport_assignments ta
using (
    select id,
           row_number() over (
               partition by institute_id, student_id
               order by updated_at desc nulls last, created_at desc nulls last, id desc
           ) as duplicate_rank
    from transport_assignments
) ranked
where ta.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists ux_transport_assignments_student
    on transport_assignments (institute_id, student_id);

create index if not exists idx_transport_drivers_active
    on transport_drivers (institute_id, status);
