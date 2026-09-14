# VidyantraErp public website

The public homepage is at `/`, with `/privacy`, `/terms` and a guarded `/register` route. It extends the existing blue/slate branding and rounded module-card treatment. The internal ERP layouts are unchanged.

The requested section order places **Pricing immediately after Security**, followed by performance/growth and product previews.

## Public data

- `GET /api/public/plans` publishes active plans only. It selects name, public code, prices, trial days, student/teacher limits and allowlisted feature labels. It excludes database IDs, versions, storage settings, audit fields and unreleased live transport tracking. Plans are ordered by monthly price, yearly price and code.
- `GET /api/public/config` publishes validated `platformSupportEmail`, `platformSupportPhone` and `registrationEnabled` as safe contact/config fields. No maintenance banner currently exists in the platform settings, so none is invented.
- `POST /api/public/demo-requests` validates the form, saves a platform-owned enquiry and queues a plain-text support notification. It returns an acknowledgement, not the stored record. There is no public enquiry-list endpoint.

The landing page makes only the two public GET requests. It does not restore authentication, warm the health endpoint or fetch tenant data. Public requests omit cookies and access tokens. Login, registration and legal-page code are split into separate route chunks.

## Deployment configuration

1. Deploy the backend with Flyway migration `V49__public_landing_and_demo_requests.sql`. It adds `public_demo_requests` and `public_request_limits` without changing tenant tables.
2. Set the public support email and optional phone in the existing Platform Settings page. These contacts are intentionally public. No private contact has been substituted.
3. Configure the existing email provider (`EMAIL_PROVIDER` and its SMTP or Brevo settings). The demo notification job uses the same delivery service as email verification.
4. Confirm `registrationEnabled`, the active default plan and default trial days in Platform Settings. The public `/api/institutes/register` route reuses the existing email-verified registration service and default-trial provisioning. Platform-managed creation remains available.
5. Set `VITE_PUBLIC_SITE_URL` to the final frontend origin if it differs from the existing `https://erpfrontend-kohl.vercel.app`. The build generates absolute canonical/social URLs, `robots.txt` and `sitemap.xml`. Set `VITE_API_BASE_URL` as for the existing frontend.
6. Keep the existing Vercel frontend / Spring Boot backend deployment model. This is not a Cloudflare Worker/Sites build; a Sites deployment would require an architecture change outside this task.

Registration buttons fall back to Request Demo when registration is disabled or configuration cannot be loaded. Direct visits to `/register` are guarded too. Trial duration and enabled modules follow backend configuration; choosing a displayed pricing card does not silently assign that plan. This is explained beside pricing.

## Enquiry operations

The public rate limiter uses atomic PostgreSQL buckets, shared across backend replicas: 120 reads per IP per minute, 5 public writes per IP per hour, and 3 demo submissions per email per day. Fixed-window boundaries can permit a burst across two adjacent windows. Configure the existing trusted-proxy address setting for the deployment; the application does not trust arbitrary forwarded-IP headers.

Request bodies are capped at 32 KiB, including chunked requests. Field limits, email/phone validation, plain-text validation, a honeypot and a minimum form-fill time provide additional abuse controls. These do not replace infrastructure-level DDoS protection.

Saved enquiries begin in `NEW` status with `created_at`. The notification job processes one pending record every 60 seconds (`app.public.demo-notification-delay-ms`), using a row lock to avoid simultaneous processing by replicas. Missing support configuration leaves requests pending. Delivery failures retry after 15 minutes, up to five attempts, then remain `FAILED` for operator review. Enquiries are retained when mail fails. Email delivery is at least once: a crash between sending and committing can produce a duplicate notification with the same request number.

Operators can review `public_demo_requests` through authorized database tooling and update `status` to `CONTACTED` or `CLOSED`. Failed notifications can be retried after fixing delivery configuration by resetting their notification status/attempt count and next-notification timestamp. No public endpoint can read or modify these records. Logs contain request IDs and delivery outcomes, not enquiry text or contact details.

## Content and legal review

Product previews are lightweight React interfaces using explicitly labeled illustrative records. They are not real student records, customer claims or production screenshots. There are no fabricated testimonials, customer logos, adoption statistics, uptime guarantees or biometric attendance claims. There are no non-essential analytics or cookie-consent popups.

Privacy and terms pages describe the implemented workflows. **Internal launch requirement:** the business owner/legal reviewer should confirm the operating entity, applicable terms, provider disclosures, retention/deletion policy, commercial terms and support contact before commercial launch. No legal certification or legal-compliance claim is made by this implementation.

The generated social image is `frontend/public/og.png`, created with the built-in ImageGen tool. Prompt: a white/slate and royal-blue landscape EdTech card with exact title “VidyantraErp” and supporting text “School & College Management, All in One Place”, graduation-cap motif, restrained module imagery, no people, customer logos or statistics. It is referenced by metadata only and is not downloaded as a hero asset.

## Validation

- Frontend: `npx playwright test tests/landing.spec.js` covers 320/375/768/1440px layouts, public-only requests, valid anchors, keyboard navigation, drawer dismissal/focus, dynamic pricing states, registration guards, demo validation/success/errors, product previews, reduced motion and public metadata.
- Backend: `mvn -o -Dtest=PublicSiteTest,PublicSecurityTest,PublicDatabaseTest,AuthSecurityFilterTest,SubscriptionSecurityTest test` covers public DTO limits, validation, exact security-chain allowlisting, anti-spam checks, email-failure behavior and database-backed concurrent rate limits. The database tests create and remove a uniquely named local PostgreSQL schema; they refuse remote database URLs. Email is mocked and no messages are sent.
- Production frontend: `npm run build` emits sitemap, robots, social metadata and separate route chunks.
- Production deployment and delivery through the configured live email provider are not performed by these tests.

The local mobile Lighthouse navigation audit (Lighthouse 12.8.2) measured performance 88, accessibility 100, best practices 96 and SEO 100, with LCP approximately 3.1 seconds, CLS 0 and total blocking time 130 ms. The running local backend rejected the preview origin with CORS, so this audit exercised the usable plan/config failure state. These are local lab results, not production guarantees. INP requires representative interaction/field measurements and is not established by this navigation audit. An accessible-name warning on the brand link was subsequently corrected.
