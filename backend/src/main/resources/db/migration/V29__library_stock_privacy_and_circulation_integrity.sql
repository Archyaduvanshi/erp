alter table if exists library_books
    add column if not exists normalized_isbn varchar(64),
    add column if not exists total_copies integer,
    add column if not exists available_copies integer,
    add column if not exists status varchar(32) not null default 'ACTIVE';

alter table if exists library_issues
    add column if not exists status varchar(32),
    add column if not exists issued_by_account_id bigint,
    add column if not exists returned_by_account_id bigint,
    add column if not exists voided_by_account_id bigint,
    add column if not exists returned_at timestamp,
    add column if not exists voided_at timestamp,
    add column if not exists void_reason text;

update library_books b
set normalized_isbn = upper(regexp_replace(coalesce(b.isbn, ''), '[^A-Za-z0-9]', '', 'g'))
where normalized_isbn is null;

update library_issues
set status = case when return_date is null then 'ISSUED' else 'RETURNED' end
where status is null;

update library_books b
set total_copies = greatest(coalesce(b.available_quantity, 0) + coalesce(active_counts.active_count, 0), 0),
    available_copies = greatest(coalesce(b.available_quantity, 0), 0)
from (
    select book_id, count(*) as active_count
    from library_issues
    where status = 'ISSUED'
    group by book_id
) active_counts
where active_counts.book_id = b.id
  and (b.total_copies is null or b.available_copies is null);

update library_books b
set total_copies = greatest(coalesce(b.total_copies, b.available_quantity, 0), 0),
    available_copies = least(greatest(coalesce(b.available_copies, b.available_quantity, 0), 0), greatest(coalesce(b.total_copies, b.available_quantity, 0), 0))
where b.total_copies is null
   or b.available_copies is null
   or b.available_copies > b.total_copies
   or b.available_copies < 0;

alter table if exists library_books
    alter column normalized_isbn set not null,
    alter column total_copies set not null,
    alter column available_copies set not null;

alter table if exists library_issues
    alter column status set not null;

alter table if exists library_books
    drop constraint if exists chk_library_books_stock_counts,
    add constraint chk_library_books_stock_counts
        check (total_copies >= 0 and available_copies >= 0 and available_copies <= total_copies);

alter table if exists library_issues
    drop constraint if exists chk_library_issue_amounts,
    add constraint chk_library_issue_amounts
        check (coalesce(fine_per_day, 0) >= 0 and coalesce(damage_charges, 0) >= 0);

alter table if exists library_issues
    drop constraint if exists chk_library_issue_status,
    add constraint chk_library_issue_status
        check (status in ('ISSUED', 'RETURNED', 'VOIDED', 'LOST'));

create unique index if not exists ux_library_books_active_isbn
    on library_books(institute_id, normalized_isbn)
    where status <> 'ARCHIVED';

create unique index if not exists ux_library_issue_active_student_book
    on library_issues(institute_id, borrower_id, book_id)
    where status = 'ISSUED';

create unique index if not exists ux_library_membership_active_student
    on library_memberships(institute_id, student_id)
    where status = 'active';

create index if not exists idx_library_books_status_title
    on library_books(institute_id, status, title);

create index if not exists idx_library_issues_borrower_date
    on library_issues(institute_id, borrower_id, issue_date desc);

create index if not exists idx_library_issues_book_return
    on library_issues(institute_id, book_id, return_date);

create index if not exists idx_library_issues_due_active
    on library_issues(institute_id, status, due_date);

create index if not exists idx_library_issues_active_borrower_due
    on library_issues(institute_id, borrower_id, due_date)
    where status = 'ISSUED';
