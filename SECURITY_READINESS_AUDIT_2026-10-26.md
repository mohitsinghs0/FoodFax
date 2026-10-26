# FoodFax Customer Web — Security & Readiness Audit
**Audit date:** 2026-10-26  
**Scope:** Default branch source inspection only. No production requests, database queries, dependency installation, or runtime tests were performed. Findings are code-review observations, not a penetration-test certification.

## Confirmed code-review findings
- **Critical review priority — order creation API:** `api/order/create.ts` accepts a client-supplied order/dbOrder payload and writes with a privileged server client; in the inspected handler, no bearer-token verification or server-side ownership check is performed before the write. It also returns database error messages to clients and sets wildcard CORS.
- **Critical review priority — payment webhook:** `api/payment/webhook.ts` permits processing to continue when the configured webhook secret or signature is absent (signature verification is only performed when both exist). It uses a fallback Supabase key and wildcard CORS. Payment state must not be marked paid without provider-authenticated evidence.
- **Critical review priority — payment status endpoint:** `api/payment/status.ts` contains a hard-coded payment-provider API-key fallback and hard-coded Supabase anon-key fallback. The endpoint also accepts caller-supplied payment/shop identifiers; verify that it cannot disclose another customer's payment details and that payment state comes from trusted provider evidence.
- **Configuration hygiene:** `.env.example` contains realistic-looking key values rather than unmistakable placeholders. Treat committed provider credentials as exposed until rotated/restricted.
- **Schema review required:** `supabase/schema.sql` includes password/password_hash columns in application tables. Confirm these are never used to store raw passwords and remove legacy credential columns only through a reviewed migration after verifying live dependencies.
- **Existing tests:** `src/utils/security.test.ts` has unit tests, but helper-level tests do not prove API authentication, database RLS, webhook signature enforcement, or deployment configuration.

## Required verification before release
1. Verify every protected API route authenticates the request and checks customer/shop ownership on the server.
2. Recalculate prices and totals from database menu records; never trust client-supplied price, role, payment status, or ownership.
3. Fail closed when service-role credentials or provider webhook secrets are missing; no secrets in client bundles.
4. Verify webhook signature according to the provider's official contract, including raw-body handling and timing-safe comparison; add replay/idempotency controls.
5. Restrict CORS to exact deployed origins; apply rate limiting at the edge/server.
6. Test RLS policies against anonymous, customer, owner-A, owner-B, and admin identities.
7. Add API-level integration tests and payment-flow regression tests before changing production paths.
8. Review secrets in repository history and rotate exposed provider/API keys; deleting a value from the current file does not erase Git history.

## Status
- Source inspection: **started**
- Runtime/build/tests: **not run**
- Production configuration/database: **not verified**
- Production readiness: **not certified**
