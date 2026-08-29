# Authorization Matrix

## Roles

- `ADMIN`: full access to the authenticated institute's management APIs.
- `TEACHER`: own profile/timetable plus explicitly assigned feature modules.
- `STUDENT`: own `/me` data only, with limited read-only shared reference data.

## Teacher Feature Rules

- No assignment: read and write are denied.
- `read`: `GET`, `HEAD`, and `OPTIONS` are allowed; writes are denied.
- `read_write`: reads and writes are allowed for the mapped feature.
- Unknown teacher routes are denied by default.

## Feature Route Keys

- `/api/students` -> `admissionStudent`
- `/api/teachers` -> `teacher`
- `/api/library` -> `library`
- `/api/hostel` -> `hostel`
- `/api/fees` -> `fees`
- `/api/transport` -> `transport`
- `/api/attendance` -> `attendance`
- `/api/marks`, `/api/results`, `/api/examinations` -> `examinations`
- `/api/class-subjects`, `/api/classes`, `/api/course-books`, `/api/curriculum`, `/api/subjects` -> `courses`
- `/api/timetables` -> `timetable`
- `/api/salary` -> `salary`
- `/api/notices` -> `notices`
- `/api/holidays` -> `holidays`

## Student Allowlist

- `/api/students/me/**`
- `GET /api/students/{ownStudentId}` for legacy profile compatibility
- `/api/attendance/students/me`
- `/api/transport/student/me/**`
- `/api/notices/portal`
- read-only `/api/academic-sessions` and `/api/holidays`

All other student access is denied by default.

## Tenant Identity

Protected requests derive tenant identity from `AuthPrincipal.instituteId`.
Client-supplied identity headers are not authoritative and are not required.
Controllers read tenant context from the authenticated principal instead of `X-Institute-Id`, `X-User-Id`, `X-Teacher-Id`, or `X-Student-Id`.
