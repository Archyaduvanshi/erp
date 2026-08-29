drop index if exists uk_hostels_institute_name_lower;

create unique index if not exists uk_hostels_institute_name_lower
    on hostels (institute_id, lower(hostel_name))
    where lower(coalesce(status, 'active')) <> 'archived';

drop index if exists uk_hostel_rooms_institute_hostel_room_lower;

create unique index if not exists uk_hostel_rooms_institute_hostel_room_lower
    on hostel_rooms (institute_id, hostel_id, lower(room_number))
    where lower(coalesce(status, 'available')) <> 'archived';
