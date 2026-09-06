create table if not exists auth_login_identifier_conflict_report (
    normalized_login_identifier varchar(120) not null,
    account_count bigint not null,
    detected_at timestamp not null default current_timestamp
);

insert into auth_login_identifier_conflict_report (normalized_login_identifier, account_count)
select normalized_login_identifier, count(*)
from user_accounts
where normalized_login_identifier is not null
group by normalized_login_identifier
having count(*) > 1;

create index if not exists idx_user_accounts_global_login_identifier
    on user_accounts (normalized_login_identifier);
