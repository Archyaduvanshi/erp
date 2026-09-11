# Subscription management implementation report

Implemented in the existing VidyantraErp platform console. The module is available at `/platform/subscriptions`; `/platform/plans` redirects to its Plans tab. Existing gateway changes and school fee accounting remain separate.

1. **Existing architecture.** JDBC services and record DTOs over PostgreSQL tables, with Flyway migrations, platform JWT/refresh-token authentication and SUPER_ADMIN controllers. The pre-change review is in `subscriptions-current-flow.md`.

2. **Previous Plans page limitations.** Separate from the Subscription module, missing yearly-price display/status actions/default-plan protection, zero limits shown as unlimited, backend code changes allowed, generic errors and incomplete cache invalidation. Subscription and institute directory plan filters were hardcoded.

3. **Subscription UI.** Plans and Institute Subscriptions tabs, summary cards for total/active plans, active subscriptions, trials and 7/30-day expiry. Plans tab does not preload institute, student, teacher, billing or subscription directories.

4. **Create flow.** SUPER_ADMIN opens Create Plan, enters commercial fields and selects registry features. A validated modal submits POST, disables repeated submission, shows errors and refreshes the plan list. Empty state provides the same action.

5. **Edit flow.** The same editor sends PUT with the plan version. Code is disabled; name, prices, trial days, limits, status and features are editable. Stale updates return 409 and refresh cached plans for reopening the editor.

6. **Activation.** Explicit Activate/Deactivate actions require a reason. Existing subscriptions keep their amounts and periods. Inactive plans cannot be newly assigned. Default-plan deactivation is rejected. No delete API/UI was added.

7. **Plan model.** Existing `subscription_plans` stores code/name, numeric(14,2) monthly/yearly prices, nullable integer limits, trial days, status, version and timestamps. Java money uses BigDecimal. The established JDBC architecture was retained rather than introducing duplicate JPA entities.

8. **Plan features.** Existing normalized `subscription_plan_features(plan_id, feature_code)` uses its composite primary key. It already provides stronger uniqueness than an unnecessary surrogate ID.

9. **Registry.** Java `FeatureCode` is authoritative. `/features/options` and the compatible `/feature-registry` route expose code, displayName, label and legacyKey. SQL registry rows are derived from the enum instead of duplicated strings.

10. **APIs.** GET/POST `/api/platform/plans`; PUT `/plans/{id}`; PUT `/plans/{id}/status`; GET `/features/options`; GET `/subscriptions/summary`; GET `/subscriptions`; GET/POST `/institutes/{id}/subscriptions`; POST `/institutes/{id}/subscriptions/extend-trial`; POST `/institutes/{id}/subscriptions/end-trial`. Existing settings/features/usage endpoints remain in use.

11. **Validation.** Trimmed name up to 100 characters; uppercase trimmed code matching A-Z/0-9/underscore up to 40; nonnegative prices with at most two decimal places and numeric(14,2) bounds; trial 0–365; nonnegative or null limits; registry-only features; ACTIVE/INACTIVE status. Explicit errors include PLAN_ALREADY_EXISTS, PLAN_NOT_FOUND, PLAN_INACTIVE, PLAN_CODE_IMMUTABLE, PLAN_MODIFIED_CONCURRENTLY, INVALID_PLAN_PRICE, INVALID_PLAN_LIMIT and INVALID_FEATURE.

12. **Uniqueness.** Existing unique(code), combined with the new normalized-code CHECK, guarantees database-level normalized uniqueness. Duplicate-key exceptions map to PLAN_ALREADY_EXISTS/409. Existing feature and current-subscription uniqueness constraints are reused.

13. **Concurrency.** Plan update/status requests require the current version and use a version predicate. Subscription assignment requires the latest history ID/version, locks the institute row and reads the chosen plan under a share lock. A stale request receives SUBSCRIPTION_CONFLICT/409. The partial unique index remains the final database safeguard.

14. **Feature writes.** Only obsolete mappings are deleted; new mappings are batch-inserted. Unchanged mappings are retained. Plan, feature and audit writes share a transaction. A database-triggered feature failure test proves the entire plan creation rolls back.

15. **Directory.** Current/latest subscription only, joined institute and plan data, 25/50/100 server pagination, search debounce of 350ms, status tabs, database plan options, billing cycle, expiry dates and 7/30-day windows. Rows show institution code, plan, status, cycle, dates, days remaining, amount and assignment action.

16. **Assignment.** Directory links to the institute Subscription tab; unassigned institutes are reachable through Select Institute / Assign Plan. The editor shows active plans only and submits explicit dates, status, billing cycle, snapshot amount, reason and concurrency identifiers.

17. **Autofill.** Monthly/yearly selection fills the corresponding plan price. Trials default to zero and their plan trial duration. CUSTOM permits manual amounts. Current subscriptions cannot start in the future; this avoids granting early access without a scheduled-subscription model.

18. **Overrides.** A nonstandard amount or custom commercial amount requires a reason at the backend and in the UI. SUBSCRIPTION_PRICE_OVERRIDE records the original calculated amount and accepted amount separately from the assignment event.

19. **History.** Assignment cancels the old current row (or marks it expired if already ended), then inserts a new row. Amounts and existing invoices are never recalculated by plan edits. Deterministic timestamp/ID ordering resolves same-time changes.

20. **Current protection.** The existing unique partial index permits one TRIAL/ACTIVE/PAST_DUE row per institute. PostgreSQL concurrency tests show one assignment succeeds and the stale competing request is rejected.

21. **Trials.** Start Trial, Extend Trial, Convert to Paid and End Trial actions are available. Extensions require a later end date and reason, preserve row identity, increment version and record the full previous/new values in audit history. Conversion creates a new subscription history row; ending records cancellation and audit.

22. **Expiry.** Existing current-subscription view computes request-time expiry. Entitlement checks also respect start dates and institute status. The scheduled job persists EXPIRED and writes system audit events. Institute data is retained.

23. **Entitlements.** `EntitlementService` now owns subscription validation and resource-limit validation, exposes the current subscription, and evaluates plan features plus institute overrides dynamically. `PlanLimitService` is a compatibility facade delegating to it. No per-institute copy of plan features is created.

24. **Student limits.** Creates/imports use serialized capacity checks. Archived-to-nonarchived updates also check capacity. Existing non-archived student counting semantics were preserved. Concurrent admission tests show only available capacity can be consumed.

25. **Teacher limits.** Creates/imports and reactivation use the same central checks. Teacher update is transactional so teacher/account changes roll back together on a limit failure.

26. **User limits.** Only ACTIVE accounts count. Student/teacher account creation and inactive-to-active transitions check capacity. Inactive historical accounts do not consume the limit. Admin account creation is checked as before.

27. **Storage.** The configurable limit is displayed, but actual storage usage is explicitly Not Available. No fabricated usage or enforcement was added because the application has no reliable per-institute byte accounting.

28. **Downgrades.** Lower limits are allowed without deleting data. Usage displays OVER_LIMIT; subsequent growth is blocked. Zero is consistently displayed as zero in plan cards and platform usage, not as unlimited.

29. **Default plan.** Settings provides active database plan choices. Empty/nonactive defaults are rejected. Settings, plan deactivation and provisioning coordinate using a lock on the default-plan setting, avoiding an inactive-default race.

30. **Registration.** Provisioning resolves the configured default instead of falling back to BASIC. Trial days come from settings, with the selected plan duration as fallback. A missing/inactive default fails explicitly instead of silently registering an institute without a subscription. Automatic assignment is audited.

31. **Audit.** Creation/update/status, feature/limit/price changes, assignments, overrides, trial extension/end and scheduled expiry are recorded. System operations use a null platform actor displayed as System. A pre-existing date-serialization bug was fixed locally in PlatformAuditService using ISO date/time serializers, allowing subscription audits to commit.

32. **Query keys.** `['platform','plans']`, `feature-options`, `subscription-summary`, `['platform','subscriptions', filters]`, `['platform','subscription-history', instituteId]`, `institute`, `features`, `usage`, and existing feature/usage directories. Page/size are part of the subscription filters object.

33. **Invalidation.** Creation invalidates plans only; summary plan counts derive from that list. Edits refresh plans and relevant cached institute history/features/usage, plus affected directory views. Assignment refreshes that institute's detail/history/features/usage and subscription/overview/summary directories. No browser reload or global cache reset is used.

34. **Indexes.** Existing code uniqueness, feature composite primary key, institute-current partial uniqueness, institute/history and status/end-date indexes are retained. V44 adds plan status/price ordering and subscriptions(plan_id), without duplicating existing indexes.

35. **Flyway.** `V44__subscription_plan_management.sql` changes zero-limit checks, enforces normalized codes and valid states/cycles, adds the two indexes and permits system audit actors. Archived plans become INACTIVE. Migration SQL V40–V44 was exercised in a private PostgreSQL schema. The application database was not migrated or deployed during this task; normal Flyway startup must apply V44 after the existing migrations.

36. **Security tests.** SubscriptionSecurityTest checks HTTP 403 for institute ADMIN, TEACHER and STUDENT plan creation and method-level denial for every management action. SUPER_ADMIN creation returns 200. Existing gateway security and authentication-filter tests also pass.

37. **Performance/tests.** 13 PostgreSQL integration cases plus 6 security/filter cases pass. Real query instrumentation verifies 2 queries for plans, 1 for the lightweight summary and 2 for the subscription directory, with no entity/billing preload. Four Playwright tests exercise actual React pages against isolated API fixtures: initial request scope and responsive zero-limit display; create/edit/features/status; dynamic directory filters/pagination; assignment price autofill and inactive-plan exclusion. Vite production build passes.

38. **UI consistency.** Existing platform card borders, shadows, serif headings, emerald controls, badges and table styles are retained. Dashboard ModuleCard and College Dashboard styling are unchanged. Shared subscription modal/fields add explicit labels, keyboard focus containment, Escape/close handling and visible loading/errors. Desktop and mobile screenshots were inspected; no horizontal overflow was observed.

39. **Changed files for this task.**

    Backend: `platform/controller/PlatformController.java`, `platform/dto/PlatformDtos.java`, `platform/FeatureCode.java`, `platform/service/PlatformConsoleService.java`, `EntitlementService.java`, `PlanLimitService.java`, `PlatformProvisioningService.java`, `SubscriptionExpiryJob.java`, `PlatformAuditService.java`; `auth/AuthService.java`; `student/service/StudentService.java`; `teacher/service/TeacherService.java`; migration V44; tests `SubscriptionManagementTest.java` and `SubscriptionSecurityTest.java`.

    Frontend: `pages/platform/SubscriptionsPage.jsx`, `PlansPage.jsx`, `InstituteDetailsPage.jsx`, `InstitutesPage.jsx`, `PlatformSettingsPage.jsx`, `PlatformUsagePage.jsx`; `components/platform/InstituteSubscriptions.jsx`, `SubscriptionUi.jsx`, `PlatformUi.jsx`, `PlatformLayout.jsx`; `api/platformApi.js`; `tests/subscriptions.spec.js`; `playwright.config.js`; `package.json`, `package-lock.json`, `.gitignore`. Documentation: this report and the pre-change flow document. Other pre-existing workspace changes were preserved.

40. **Remaining technical debt / verification boundaries.** Storage measurement is intentionally unavailable. Plan/history collections remain lightweight lists; only the cross-institute subscription directory is server-paginated. Future scheduled activation is not implemented. Automatic expiry audit records the expired snapshot; trial extension audit records both old/new values. Browser tests mock HTTP responses; backend behavior is separately verified on real PostgreSQL. Production deployment, the full registration HTTP flow with every ERP dependency, and the live gateway were not exercised. No Redis, Kafka or microservices were introduced.

## Reproduce checks

From `backend`:

```powershell
mvn.cmd '-Dmaven.compiler.useIncrementalCompilation=false' '-Dtest=SubscriptionManagementTest,SubscriptionSecurityTest,PlatformGatewaySecurityTest,AuthSecurityFilterTest' test
```

Integration tests read the local datasource environment/`.env`, create a uniquely named `subscription_test_*` schema with minimal ERP fixtures, execute platform migrations, and remove only that schema afterward.

From `frontend`:

```powershell
npm.cmd run build
npm.cmd run test:subscriptions
```

Playwright uses installed Chrome and a dedicated local Vite port 4175. On Windows environments that block automatic process-tree cleanup, start Vite separately and set `PLAYWRIGHT_EXTERNAL_SERVER=1` before running the tests. Browser screenshots are generated under the ignored `frontend/test-results` directory.
