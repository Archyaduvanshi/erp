update exam_date_sheets
set file_data = null
where file_data like 'data:%';

create index if not exists idx_exam_date_sheets_created
    on exam_date_sheets(institute_id, created_at desc)
    where upper(coalesce(status, 'PUBLISHED')) <> 'ARCHIVED';

create index if not exists idx_exam_question_papers_created
    on exam_question_papers(institute_id, created_at desc)
    where upper(coalesce(status, 'DRAFT')) <> 'ARCHIVED';

create index if not exists idx_exam_admit_cards_created
    on exam_admit_cards(institute_id, created_at desc)
    where upper(coalesce(status, 'GENERATED')) <> 'ARCHIVED';
