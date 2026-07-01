# ADR-0140 — admin.caisson.sh auth: CF-Access alone

Status: accepted · 2026-06-30 (Stage-2 Stream A initiative SPEC, operator picker) · **opens the
first ADR-0138 detail fork** ("admin auth detail: CF Access alone vs a `better-auth` operator role
behind it") · **reuses ADR-0107** (the Cloudflare Zero-Trust Access model already applied for the
buyer site). Append-only; supersede with a later ADR, never edit.

## Context

`apps/admin` (ADR-0138) is the operator control-plane at `admin.caisson.sh`. Its access model was
left open at the charter. Recon (Stream A, `wf_a3f97716-bff`) established: (a) Cloudflare Access
today is **pure edge-trust** — `infra/terraform/access.tf` gates `caisson.sh` at the CF edge with a
`@gridwork.dev`-email OTP policy, and **no TypeScript in the repo verifies a `Cf-Access-Jwt-Assertion`
header or any Access JWT**; (b) `apps/site`'s better-auth is buyer-scoped — the `Role` union in
`packages/auth/src/session.ts` is `"owner" | "seat"`, `getSession()` hardcodes `role: "owner"`, and
better-auth's `admin` plugin is not installed. There is no operator-role concept anywhere.

`admin.caisson.sh` is a **single-operator** cockpit (ADR-0138 names no multi-operator or per-user
audit requirement). Business-admin is **read-only** for now (ADR-0141), so there is no mutating
action that needs an audit-who trail inside the app.

## Decision

**`admin.caisson.sh` is gated by Cloudflare Access alone — no app-side auth code.** A dedicated
`cloudflare_zero_trust_access_application` (+ allow-policy) for the `admin.caisson.sh` hostname is
added to `infra/terraform/`, mirroring the existing `site_gate` shape, scoped to the operator email
domain. `apps/admin` ships **no** better-auth instance, session cookie, login page, or role model.
The edge either admits the request or 302s to the CF Access login; the app trusts the edge.

The Terraform apply + DNS binding are **DEPLOY-class** (integration/deploy session), not this stream —
Stream A only lands the `apps/admin` app, which needs no auth wiring under this decision.

## Why

- **YAGNI on a single-operator read-only surface.** The lazy correct answer is more Terraform, zero
  new app code, and the exact proven+audited pattern already live for the buyer site — not a second
  auth stack to build, secure (timing-safe compares, cookie flags), and maintain.
- **Clean trust boundary.** The operator surface shares no auth code or session store with the buyer
  `apps/site` — the gate is entirely at the edge, hostname-bound.
- **Reversible.** If a future ADR locks business-admin **mutation** (ADR-0141 alt) and wants
  per-operator audit, a `better-auth` operator role can be added _behind_ the same CF-Access perimeter
  without unwinding anything decided here.

## Rejected

- **better-auth operator role behind CF-Access** — buys per-operator identity/audit inside the app, but
  needs a new operator role (reusing `owner|seat` is semantically wrong), its own session storage, a
  login UI, and a second attack surface. Held as the upgrade path if mutation + audit-who lands.
- **App-level Access-JWT verification (defense-in-depth)** — validating `Cf-Access-Jwt-Assertion` in
  `apps/admin` on top of the edge gate. Rejected as premature for a single-operator cockpit; nothing in
  the repo does it today. Revisit if the admin host is ever exposed beyond the Access perimeter.

## Confidence + revisit

**HIGH** — consistent with ADR-0107/0138 and the single-operator, read-only scope. Revisit if the
operator adds named operators/roles or business-admin mutation (then the rejected better-auth option
becomes the likely successor ADR).

## Downstream

- Stream A: `apps/admin` needs no auth package/route/middleware.
- Deploy session: add the `admin.caisson.sh` CF Access application + policy in `infra/terraform/` and
  apply; bind DNS. Extends the ADR-0107 go-live runbook.

Evidence: recon `cf-access-model` (`wf_a3f97716-bff`); `infra/terraform/access.tf`;
`packages/auth/src/session.ts`; ADR-0107; ADR-0138 §"Still open" (admin auth detail).
