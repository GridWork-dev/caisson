# ADR-0183 — BYOK key-submission UX + endpoint home

**Status:** accepted · 2026-07-01 (edition seam-completion, operator-locked) · relates **ADR-0162** (BYOK
store/resolver), **ADR-0114** (unified Railway Next app), **ADR-0182** (BYOK billing policy), the security
floor (`identity/security.md` — secrets, HTTPS-only, timing-safe). Append-only; supersede with a later ADR,
never edit. **Tags:** `secrets`, `frontend`, `auth`.

## Context

`putTenantProviderKey` encrypts-on-write and `getTenantProviderKey` decrypts inside `withTenant`, but there
is no buyer-facing edge to submit a key. The BYOK research brief prescribes a strong, convergent UX
(Stripe/Pleo/Zuplo): validate-on-submit (fire a live minimal-scope provider call before persisting),
write-only (never read the key back; masked last-4 + metadata only), mask on entry, and a dedicated rotation
flow that atomically replaces. Two things need locking: where the endpoint lives, and the UX contract.

## Decision

**(A) Endpoint home: `apps/site` route-handler** (`app/api/byok/route.ts`). The unified Next app (ADR-0114)
already hosts the buyer dashboard, session/auth, and the RLS `withTenant` context — the key form and its
handler live in one tree, reusing the buyer session and RLS. (An `agent-dev` coach surface is rejected as
over-built for a plain CRUD-with-validation endpoint.)

**(B) UX contract — all MUST:**

- **Validate-on-submit** — one minimal-scope live provider call (`fetchWithTimeout`, never native
  `AbortSignal.timeout`) before persist; never activate a failed key.
- **Write-only** — GET returns metadata + masked last-4 only, never the plaintext; the key is never read
  back, never logged, never echoed in an error.
- **Atomic rotation** — per-provider entry with a settable label; show created + last-used; rotation
  re-validates then atomically UPSERTs (the store's existing semantics).
- Cost preview is driven by ADR-0182 — omitted (the tenant lane is free).

## Consequences

- The ~80-LOC route-handler + the key form land in `apps/site`, reusing session/RLS.
- Locks the write-only + validate-on-submit + atomic-rotation invariants the SECURITY audit checks at SHIP
  (`secrets` tag); Zod `.strict()` at the boundary, no plaintext in logs/errors.
- Design-track owns the form's visual craft; this ADR is the security/behavior floor, not the visual design.
