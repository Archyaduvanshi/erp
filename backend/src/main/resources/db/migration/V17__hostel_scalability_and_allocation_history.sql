alter table hostel_residents
    add column if not exists academic_session_id bigint references academic_sessions(id);

create table if not exists hostel_mess_menus (
    id bigserial primary key,
    institute_id bigint not null references institutes(id),
    hostel_id bigint not null references hostels(id),
    academic_session_id bigint references academic_sessions(id),
    menu_json text not null,
    status varchar(40) not null default 'active',
    created_at timestamp not null default current_timestamp,
    updated_at timestamp not null default current_timestamp
);

create unique index if not exists uk_hostel_mess_menus_institute_hostel
    on hostel_mess_menus (institute_id, hostel_id);

create index if not exists idx_hostels_institute_status
    on hostels (institute_id, status);

create unique index if not exists uk_hostels_institute_name_lower
    on hostels (institute_id, lower(hostel_name));

create index if not exists idx_hostel_rooms_institute_hostel
    on hostel_rooms (institute_id, hostel_id);

create index if not exists idx_hostel_rooms_institute_hostel_floor
    on hostel_rooms (institute_id, hostel_id, floor_label);

create index if not exists idx_hostel_rooms_institute_status
    on hostel_rooms (institute_id, status);

create unique index if not exists uk_hostel_rooms_institute_hostel_room_lower
    on hostel_rooms (institute_id, hostel_id, lower(room_number));

create index if not exists idx_hostel_residents_institute_room_status
    on hostel_residents (institute_id, room_id, status);

create index if not exists idx_hostel_residents_institute_student_status
    on hostel_residents (institute_id, student_id, status);

create index if not exists idx_hostel_residents_institute_session_status
    on hostel_residents (institute_id, academic_session_id, status);

create index if not exists idx_hostel_residents_institute_check_in
    on hostel_residents (institute_id, check_in_date);

create unique index if not exists uk_hostel_residents_active_student
    on hostel_residents (institute_id, student_id)
    where lower(coalesce(status, 'active')) = 'active'
      and check_out_date is null;

create unique index if not exists uk_hostel_residents_active_room_bed
    on hostel_residents (institute_id, room_id, lower(bed_number))
    where lower(coalesce(status, 'active')) = 'active'
      and check_out_date is null
      and bed_number is not null;
