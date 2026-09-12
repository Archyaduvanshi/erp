# Email OTP setup

For Gmail SMTP, set these on the backend host, then restart/redeploy:

```env
EMAIL_PROVIDER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_google_app_password
MAIL_SENDER_NAME=Vidyantra ERP
```

SMTP messages use `Vidyantra ERP` as the default sender display name, even if MAIL_SENDER_NAME is omitted. This does not hide or replace MAIL_USERNAME: recipients can still see the real sending address in message details. Restart the backend after changing the name; previously sent messages will not change.

Use a Google App Password with 2-Step Verification, not the normal account password. This mode requires outbound SMTP access. Render Free blocks SMTP ports 25, 465 and 587. On Render Free use the HTTPS provider option below instead:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_sender@example.com
BREVO_SENDER_NAME=Vidyantra ERP
```

For Brevo use an API key, not an SMTP key, and verify the sender/domain. Brevo delivery uses HTTPS on port 443. Never put credentials in VITE variables or commit them. Missing configuration returns a clear service-unavailable error; verification is never bypassed.

Email fields in college creation, school-admin student/teacher creation, and profile email changes have Send OTP and an inline Verify button. New records require verification before save. Existing profile edits with the same email do not need a new OTP. The latest requirement makes verification mandatory for admin-created records too. Bulk imports cannot bypass verification; use individually verified registration for now.

The existing platform-managed college registration policy is preserved. No new public student/teacher signup endpoints are introduced.

Forgot password: enter institution code, login identifier and registered email, send/verify OTP, then continue to choose a password. Only proof for the email stored on that account authorizes reset. Reset tokens are returned only after verification and passed to the reset page through router state, not displayed as development tokens.

OTP expires after 5 minutes; verification allows 5 attempts. Sending is limited to once per 60 seconds and 5 per email per hour, using database-backed limits. IP limits also apply. Codes are hashed with the password encoder. A successful verification returns an unpredictable proof valid for 30 minutes, bound to normalized email and purpose. Saves consume it atomically in the business transaction. Resending invalidates older challenges/proofs for that email and purpose. Proofs stay in browser memory only.

Flyway V48 creates email_verifications. No existing emails are automatically marked verified. This verifies inbox access, not a person's identity. Sensitive-admin step-up checks are not included in the latest requested scope.

Manual acceptance: verify a real inbox, save one record, then check that replay, wrong email, different purpose, expired OTP, and missing proof cannot save a new record. Check email edits leave the original address intact until verification and saving succeed. End-to-end delivery requires configured mail credentials.
