# Project Review: Database and Improvement Recommendations

**Reviewed:** 2026-11-24

## Database connection

The project uses MySQL for user accounts, hobbies and check-ins, journal entries, and sleep records through authenticated API routes. Connection settings are configured with environment variables; see [lib/db.ts](./lib/db.ts) and [.env.example](./.env.example). Data persists in the configured database and is no longer stored in browser `localStorage`.

## Findings

### 🔴 CRITICAL — None found

No critical issue was identified in the reviewed scope.

### 🟡 WARNING — Enforce a total request-body limit for profile uploads

**Location:** [app/api/profile/route.ts:55](./app/api/profile/route.ts#L55), [app/api/profile/route.ts:63](./app/api/profile/route.ts#L63)
**Confidence:** High

The route parses the complete multipart request with `request.formData()` before checking the file's 2 MB size. That check limits accepted files but does not limit the request bytes processed before parsing. If the deployment ingress does not impose its own body-size cap, an authenticated client can submit a much larger body and increase server memory use. Configure a total upload-body limit at the ingress/runtime, including multipart overhead, and retain the file-level check.

### 🔵 INFO — Avoid timing-based account discovery during password resets

**Location:** [app/api/auth/forgot-password/route.ts:57](./app/api/auth/forgot-password/route.ts#L57), [app/api/auth/forgot-password/route.ts:101](./app/api/auth/forgot-password/route.ts#L101), [README.md:84](./README.md#L84)
**Confidence:** High

The endpoint returns the same response body for unknown and registered email addresses, but an unknown address returns before email delivery while a registered address without a recent reset request waits for SMTP. Response time can therefore reveal account existence, so the README's non-disclosure statement is stronger than the implementation. Queue delivery asynchronously or otherwise normalize response timing, and apply IP-based rate limiting before public deployment.

### 🔵 INFO — Prune expired authentication sessions

**Location:** [database/schema.sql:20](./database/schema.sql#L20), [app/api/auth/login/route.ts:56](./app/api/auth/login/route.ts#L56), [app/api/auth/session/route.ts:31](./app/api/auth/session/route.ts#L31)
**Confidence:** High

Login creates a database row for each seven-day session, and authentication ignores expired rows, but logout deletes only the current token. No expired-session cleanup is present in the repository. Add a scheduled cleanup using the existing expiry index so the session table does not grow indefinitely.

### 🔵 INFO — Pin the security upgrade policy in Next.js config

**Location:** [next.config.ts:5](./next.config.ts#L5)
**Confidence:** High

The app's Next.js dependency is now 16.4.6, but the `experimental` config only sets `agentFeedback`. Next.js currently defaults `agentUpgrade` to `"security"`, so this is not an immediate vulnerability; setting it explicitly would preserve the requested project policy instead of relying on the framework default.

### 🔵 INFO — Back up the database before one-time migrations

**Location:** [database/migrations/002_sleep_hours.sql:13](./database/migrations/002_sleep_hours.sql#L13), [README.md:23](./README.md#L23)
**Confidence:** High

The sleep migration rounds the calculated duration to two decimal places and then drops the original `sleep_start` and `wake_time` columns. The README says to run migrations only once but does not call out this irreversible loss of the original times or require a backup. Document taking and verifying a database backup before running migrations.

### 🔵 INFO — Add API-level tests alongside query-helper tests

**Location:** [tests/validation.test.mjs](./tests/validation.test.mjs), [app/api/journal/route.ts](./app/api/journal/route.ts)
**Confidence:** High

The current tests cover pure validation, date-range, and journal-query construction helpers, but do not exercise HTTP route behavior or database transaction/error paths. Add focused handler tests with a mocked pool or isolated test database for authentication, response mapping, and persistence failure behavior.

### ✅ RESOLVED — Dashboard controls use date-specific records

**Location:** [app/dashboard-client.tsx](./app/dashboard-client.tsx), [app/api/hobbies/route.ts](./app/api/hobbies/route.ts), [app/api/sleep/route.ts](./app/api/sleep/route.ts)
**Confidence:** High

The hobby chart filters check-ins by the selected period or date, and the sleep form saves records used by the monthly sleep chart. The summary sleep value is also filtered by its selected date. One remaining date mismatch was fixed: daily summary hobby check-ins now load for the summary date independently of the hobby chart's selected date or period.

### ✅ RESOLVED — Hobby deletion persists

**Location:** [app/api/hobbies/[id]/route.ts](./app/api/hobbies/[id]/route.ts), [app/dashboard-client.tsx](./app/dashboard-client.tsx)
**Confidence:** High

Hobbies are stored in MySQL and deleted through an authenticated, user-scoped API request. Deleting the final hobby does not restore sample data after reload.

### ✅ RESOLVED — Hobby check-ins are recorded by date

**Location:** [database/schema.sql](./database/schema.sql), [app/api/hobbies/[id]/route.ts](./app/api/hobbies/[id]/route.ts), [app/api/hobbies/route.ts](./app/api/hobbies/route.ts)
**Confidence:** High

Check-ins are stored by hobby and date, and the API aggregates them for the selected period. Unchecking removes that hobby's check-in for the selected date without deleting other dates' history.

### ✅ RESOLVED — Hobby API errors are surfaced

**Location:** [app/dashboard-client.tsx](./app/dashboard-client.tsx), [app/api/hobbies/route.ts](./app/api/hobbies/route.ts)
**Confidence:** High

Hobby data is no longer parsed from localStorage. API failures are returned as errors and displayed by hobby loading and save actions rather than presented as successful writes.

### ✅ RESOLVED — The hobby dialog is modal and accessible

**Location:** [app/dashboard-client.tsx](./app/dashboard-client.tsx), [app/globals.css](./app/globals.css)
**Confidence:** High

The hobby manager uses the native modal dialog API, which removes it from the accessibility tree while closed, traps interaction behind a backdrop while open, and supports Escape. Focus moves into the dialog on open and returns to the Manage hobbies button on close.

### ✅ RESOLVED — Expand journal regression coverage

**Location:** [app/api/journal/route.ts](./app/api/journal/route.ts), [lib/journal-queries.ts](./lib/journal-queries.ts), [tests/validation.test.mjs](./tests/validation.test.mjs)
**Confidence:** High

Regression tests cover the database query parameters for journal reads by day, week, month, and year, as well as user-scoped reads, upserts, and deletes.

### ✅ RESOLVED — Document legacy data reset and export options

**Location:** [README.md](./README.md)
**Confidence:** High

The README identifies the legacy browser storage keys, documents how to export a private backup and remove only those browser-local copies, and clarifies that MySQL records are unaffected.

### ✅ RESOLVED — Lint passes cleanly

**Location:** [app/dashboard-client.tsx](./app/dashboard-client.tsx)
**Confidence:** High

The current dashboard passes the configured ESLint check (`npm run lint`).

## Strengths

- Passwords use salted scrypt hashes, reset/session tokens are stored as hashes, and database queries are parameterized and scoped to the authenticated user.
- Journal writes report API and database failures to the user rather than silently claiming success.
- Journal text is rendered as React text, not interpreted as HTML.

## Scope and validation

Reviewed the authentication and account routes, profile uploads, hobby/journal/sleep APIs, shared database/auth helpers, schema and migrations, client UI, dependencies, README, and tests. The review was static; no live database or deployment ingress configuration was available for inspection. `AGENTS.md` was the project guidance; `.github/copilot-instructions.md` was not present. No application source files were changed as part of this review.
