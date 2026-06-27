# ADR-0005 — Fail-closed multi-tenant RLS

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Tenancy is a **shared schema with `account_id` (buyer-platform) / `workspace_id` (shipped apps)
on every tenant-owned row**: the app layer filters explicitly (index-friendly) **and Postgres
RLS policies keyed by `SET LOCAL` sit underneath as the correctness floor — a missing `WHERE`
fails closed.** Policies are **FORCE**'d and asserted by a schema test (← gridwork-digital's
16-FORCE-policy / 3-role `withTenant()` pattern, the rare fail-closed isolation most boilerplates
skip — and a marketed differentiator since "no boilerplate publishes RLS/security test results").

Rejected: schema-per-tenant (no clean Drizzle multi-schema migration story; ×N migration runs;
revisit only on a contractual hard-isolation demand). App-layer filtering alone (one missing
`WHERE` = cross-tenant leak; RLS is the floor that makes that fail closed).

Binding: every tenant-owned table ships an RLS policy + a FORCE-RLS test in the same change; a
table without one fails CI. The `ui`-marketed "security floor" claim is backed by a public test.
