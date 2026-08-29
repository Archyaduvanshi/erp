alter table feature_access
    add column if not exists teacher_id bigint,
    add column if not exists operation varchar(20) not null default 'read';

alter table feature_access
    alter column password_hash drop not null;

do $$
begin
    if exists (
        select 1
        from pg_constraint
        where conname = 'feature_access_institute_id_feature_key_key'
    ) then
        alter table feature_access drop constraint feature_access_institute_id_feature_key_key;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'fk_feature_access_teacher'
    ) then
        alter table feature_access
            add constraint fk_feature_access_teacher
            foreign key (teacher_id) references teachers(id);
    end if;
end $$;

alter table feature_access
    drop constraint if exists chk_feature_access_operation;

alter table feature_access
    add constraint chk_feature_access_operation
    check (operation in ('read', 'read_write'));

create unique index if not exists uk_feature_access_institute_feature_teacher
    on feature_access (institute_id, feature_key, teacher_id)
    where teacher_id is not null;

create unique index if not exists uk_feature_access_institute_feature_legacy
    on feature_access (institute_id, feature_key)
    where teacher_id is null;
