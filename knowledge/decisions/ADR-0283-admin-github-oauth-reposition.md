# ADR-0283 — Admin auth reposition: in-app GitHub OAuth replaces CF-Access

**Status:** accepted · 2026-07-07 (operator-locked, sixth-sitting picker).
Supersedes the admin half of ADR-0107's CF-Access posture and the ADR-0204 CF-Access-JWT
middleware as admin's PRIMARY gate (the middleware pattern is retired with the edge gate).
Append-only; supersede with a later ADR, never edit. **Tags:** `security`, `auth`.

## Context

`admin.caisson.sh` has been gated by a permanent operator CF-Access policy (ADR-0138/0140)
with a fail-closed CF-Access-JWT middleware inside the app (Strix remediation, ADR-0204).
The operator wants GitHub sign-in with the gridwork-dev account instead of the CF-Access
flow. The same day, admin served 502s twice traced to the same class — the Next standalone
`HOSTNAME` bind — reinforcing that the auth seam was being rebuilt anyway.

## Decision

- **In-app GitHub OAuth via better-auth** inside `apps/admin` (the site already runs
  better-auth; reuse the pattern and deps). A dedicated GitHub OAuth app for admin.
- **Allowlist pins the GitHub NUMERIC USER ID** of the gridwork-dev account — never the
  username (usernames can be renamed and re-registered; an id cannot).
- **Fail-closed middleware** replaces the CF-Access-JWT check: no verified session → 401/
  redirect-to-login on every route except the OAuth callback + `/healthz`. API routes keep
  route-level session checks (middleware is not a substitute, per the security floor).
- **CF-Access is dropped from `admin.caisson.sh`** (the `admin_gate` Access application/
  policy is retired in the same change; `site_gate` is untouched). DNS/proxying unchanged.
- The rejected alternatives: GitHub-as-IdP inside CF-Access (zero-code, but keeps the CF
  flow the operator is moving away from) and the belt-and-braces double gate (two GitHub
  prompts per cold session).

## Consequences

- The app becomes its own gate: the middleware must be provably fail-closed before the
  Access policy is removed — flip order is code-live-first, gate-drop-second, verified.
- `security`/`auth` tags fire the fable audit at SHIP.
- The Terraform `access.tf` change touches ONLY the admin_gate resource (the standing
  warning about never touching `site_gate` stays binding).
