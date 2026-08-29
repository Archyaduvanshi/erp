with duplicate_charges as (
    select id,
           row_number() over (
               partition by institute_id, student_id, fee_structure_id, coalesce(period_key, '')
               order by created_at asc, id asc
           ) as duplicate_rank
    from student_fee_charges
    where fee_structure_id is not null
      and lower(coalesce(status, 'OPEN')) <> 'archived'
)
update student_fee_charges c
set status = 'ARCHIVED',
    updated_at = now()
from duplicate_charges d
where c.id = d.id
  and d.duplicate_rank > 1;

create unique index if not exists uk_student_fee_charges_open_identity
    on student_fee_charges (institute_id, student_id, fee_structure_id, coalesce(period_key, ''))
    where fee_structure_id is not null
      and lower(coalesce(status, 'OPEN')) <> 'archived';

create index if not exists idx_student_fee_charges_structure_student
    on student_fee_charges (institute_id, fee_structure_id, student_id)
    where lower(coalesce(status, 'OPEN')) <> 'archived';

create index if not exists idx_fee_payment_allocations_advance
    on fee_payment_allocations (institute_id, student_id, academic_session_id, allocation_type, payment_id);
