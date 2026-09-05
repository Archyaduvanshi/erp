alter table school_classes
    add column if not exists code varchar(40),
    add column if not exists display_order integer not null default 0;

update school_classes
set display_order = id
where display_order = 0;

create unique index if not exists uk_school_classes_institute_code
    on school_classes(institute_id, lower(trim(code)))
    where code is not null and trim(code) <> '';

create index if not exists idx_school_classes_institute_display_order
    on school_classes(institute_id, display_order, name);

create unique index if not exists uk_school_classes_institute_normalized_name_active
    on school_classes(institute_id, lower(trim(normalized_name)))
    where status <> 'ARCHIVED';

create unique index if not exists uk_class_sections_class_normalized_name_active
    on class_sections(class_id, lower(trim(normalized_name)))
    where status <> 'ARCHIVED';
