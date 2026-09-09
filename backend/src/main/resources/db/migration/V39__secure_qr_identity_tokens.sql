-- Replace legacy QR payloads containing personal data with stable opaque identities.
UPDATE students
SET qr_code_data = 'VIDYANTRA:STUDENT:' || replace(gen_random_uuid()::text, '-', '');

UPDATE teachers
SET qr_code_data = 'VIDYANTRA:TEACHER:' || replace(gen_random_uuid()::text, '-', '');

ALTER TABLE students
    ALTER COLUMN qr_code_data TYPE varchar(80),
    ALTER COLUMN qr_code_data SET NOT NULL;

ALTER TABLE teachers
    ALTER COLUMN qr_code_data TYPE varchar(80),
    ALTER COLUMN qr_code_data SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_students_qr_code_data
    ON students (qr_code_data);

CREATE UNIQUE INDEX IF NOT EXISTS uk_teachers_qr_code_data
    ON teachers (qr_code_data);

ALTER TABLE students
    ADD CONSTRAINT ck_students_secure_qr_payload
    CHECK (qr_code_data ~ '^VIDYANTRA:STUDENT:[a-f0-9]{32}$');

ALTER TABLE teachers
    ADD CONSTRAINT ck_teachers_secure_qr_payload
    CHECK (qr_code_data ~ '^VIDYANTRA:TEACHER:[a-f0-9]{32}$');
