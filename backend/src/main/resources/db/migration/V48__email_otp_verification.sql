create table email_verifications (
    id varchar(64) primary key,
    email varchar(254) not null,
    purpose varchar(32) not null,
    otp_hash varchar(255) not null,
    expires_at timestamp not null,
    created_at timestamp not null default current_timestamp,
    attempts integer not null default 0,
    proof_hash varchar(64),
    verified_at timestamp,
    consumed_at timestamp
);
create index idx_email_verifications_email_created on email_verifications(email, created_at);
create unique index idx_email_verifications_proof on email_verifications(proof_hash) where proof_hash is not null;
