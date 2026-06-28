# ADR-0073 — Local/SQLite tenant isolation: one DB file per tenant

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Extends the ADR-0005 tenancy
boundary to the local/SQLite tier, which has no RLS.)

The local editions (local-ai, agent-dev) ship on SQLite, which has **no row-level security** — the
ADR-0005 floor that makes a missing `WHERE` fail closed simply does not exist there. ADR-0006/0043
already tie the encryption boundary to the tenant boundary (per-tenant-derived keys); the local tier
needs an equivalent physical isolation floor so "tenant boundary == enforced boundary" still holds.

## Decision

**One SQLite DB file per tenant — the file path IS the isolation boundary.** A connection opens
exactly one tenant's file, so a cross-tenant query is not even expressible.

- This makes **"encryption boundary == RLS boundary" a per-tier invariant**: the **Postgres tier**
  enforces it via RLS (`withTenant` / `SET LOCAL`, ADR-0005); the **local tier** enforces it via
  **physical DB-file separation + at-rest field-crypto** (ADR-0006/0043/0045).
- **Extends ADR-0005 to the local tier** where SQLite has no RLS: the filesystem provides the
  fail-closed floor — opening tenant A's file cannot return tenant B's rows. Nothing is softened;
  the boundary moves from a `FORCE`'d policy to a path.
- Local editions are therefore **multi-tenant-capable, not single-tenant-only**: a host process
  routes each request to the tenant's file path; field-crypto keys stay **per-tenant-derived**
  (ADR-0043) so an exfiltrated file is still AAD/tenant-scoped ciphertext (ADR-0045).
- The `tenant_id → file path` mapping is a **trusted server-side seam** — never user-supplied,
  traversal-guarded (reject `..`/null bytes; `path.resolve` + assert the result is under the
  tenant-data root + `path.sep`).

## Rejected

- **Single-tenant-only local editions** — caps the local tier at one tenant per deployment; the
  operator chose multi-tenant capability so a single local-ai/agent-dev install serves many
  workspaces. Reject.
- **App-level `tenant_id` filter in one shared SQLite DB file** — gives **no DB-level guarantee**;
  one missed `WHERE` leaks across tenants — the exact failure RLS exists to backstop on Postgres
  and which SQLite cannot. File-per-tenant makes the leak _unexpressible_ rather than merely
  tested-against. Reject.

## Binding

Every local/SQLite edition isolates tenants by **one DB file per tenant**; the resolved file path is
the isolation boundary, derived server-side from an authenticated `tenant_id` (traversal-guarded,
asserted under the tenant-data root), never shared across tenants. Field-crypto keys stay
per-tenant-derived (ADR-0043) and at-rest AEAD (ADR-0045) so the file alone leaks no plaintext.
"Encryption boundary == RLS boundary" holds **per tier**: RLS on Postgres, file separation on local.
Note ADR-0050 makes **local-ai fully commercial** (no longer the AGPL flank of ADR-0023), so this
isolation floor is a paid-product guarantee, not community-tier. Evidence: ADR-0005 (fail-closed RLS
/ `withTenant`), ADR-0006/0043 (per-tenant field-crypto boundary), ADR-0045 (AEAD cipher),
ADR-0023/0050 (commercial licensing of the local tier); `outputs/research/wave1-forks.md`.
