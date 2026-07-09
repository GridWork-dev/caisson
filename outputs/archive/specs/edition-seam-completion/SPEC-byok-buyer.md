# SPEC — Edition Seam-Completion · BYOK buyer-facing completion

> **LOCKED DECISIONS (2026-07-01).** Both blocking forks are now operator-locked: **ADR-0182** — a metered
> AI action under a tenant-supplied key debits **$0 credits** (FREE); internal metering still runs as the
> spend-cap/abuse mechanism but is not the billing signal, so no cost preview renders on the tenant lane.
> **ADR-0183** — the key-submission endpoint lives in the **`apps/site` route-handler** (reuses the unified
> Next app's buyer session + `withTenant` RLS); the UX contract is MUST: **validate-on-submit**, **write-only**
> (masked last-4, never read back, never logged), **atomic rotation**. Build against these; the "Open design
> forks" section below is historical.

Act 1 (SPEC) for the **BYOK buyer** seam of EDITION SEAM-COMPLETION. Server-side BYOK is BUILT (Stream
C, ADR-0162): `tenant_ai_credential` table (FORCE-RLS, field-crypto encrypted, per-tenant HKDF),
`getTenantProviderKey`/`putTenantProviderKey`, `buildByokResolver` decrypting at `providerFor()` inside
`withTenant`. What's missing is the **buyer-facing edge** (submit a key) and the **billing policy**
(does a BYOK lane debit credits). Grounded in the BYOK seam recon (`packages/ai-kit/src/byok-store.ts`,
`byok-resolver.ts`) + BYOK research brief (envelope encryption, gateway billing norms, key-submission
UX). Bound by ADR-0162 (BYOK mechanism), ADR-0043 (per-tenant field-crypto), ADR-0007 (integer
credits) — do not relitigate the storage layer.

## Goal

Let a buyer submit and rotate their own provider key from the Dashboard, and settle whether a
BYOK-lane action debits Caisson credits. WHY: the encrypted store + resolver exist and are golden-tested
(round-trip, rotation, RLS isolation, ciphertext-never-plaintext), but there is no endpoint to write a
key and no policy for metering it — so the feature is un-shippable to a buyer despite the crypto being
done. ADR-0162 explicitly punted the credit-vs-BYOK question to "a pricebook/policy decision." VERIFY
re-asks: **can a buyer store a key write-only (never read back), have it validated live on submit, and
does a subsequent AI action debit exactly what the locked billing policy says?**

## Tags

`secrets` (per-tenant provider keys at the edge) · `auth` (endpoint is tenant-scoped, Bearer/session) ·
`billing` (credit-vs-BYOK policy touches the pricebook debit path) · `frontend` (Dashboard key form) ·
`ai`. Drives SHIP audits: **SECURITY** (secret-at-edge, write-only, no-plaintext-in-logs) · **UI**
(key-submission form). The `secrets` + `billing` tags re-enter the operator at SHIP.

## Open design forks (BLOCK build — operator locks first)

1. **ADR-0182 — credit-vs-BYOK billing policy (THE gate).** When a tenant supplies their own key, does
   an action debit credits — free / discounted / unchanged? Blocks the pricebook `keySource`
   discriminator + `computeCost()` branch; without it the UI can't show a cost preview.
2. **ADR-0183 — key-submission UX + endpoint home.** Where does the write endpoint live (`apps/site`
   route-handler vs an `agent-dev` coach), and does the flow follow the write-only + validate-on-submit
   - masked-metadata pattern the research prescribes?

## Scope (post-lock)

**T-BYOK-1 — key-submission endpoint (~80 LOC, gated on ADR-0183 home):**

- POST accepts `{ provider, apiKey }` for the authenticated tenant; opens `withTenant(accountId, …)`;
  **validate-on-submit** — fire one minimal-scope live provider call (models-list / 1-token completion)
  via `fetchWithTimeout` BEFORE persisting; on success call
  `putTenantProviderKey(tx, ctxFor(accountId), provider, plaintextKey)` (encrypts on write); on failure
  return an editable error, never activate a bad key (research §3.1).
- Zod `.strict()` at the boundary; never log the plaintext key or echo it in an error (research §3.2).
- Rotation = same endpoint, UPSERT (already the store's semantics), re-validate then atomically replace.

**T-BYOK-2 — read-back / status endpoint (write-only enforcement):**

- A GET returns **metadata only** — provider, `keyVersion`, masked last-4, created/last-used — never the
  key (research §3.2, §3.5). This is what the UI renders; the plaintext is irretrievable post-save.

**T-BYOK-3 — pricebook keySource discriminator (gated on ADR-0182 option):**

- If free/discounted: add a `keySource: "env" | "tenant"` discriminator to the `@caisson/pricebook` /
  ai-meter pricebook Zod schema; `computeCost()` branches on lane mode (free → 0 debit; discounted →
  locked fraction of the internal rate). If "unchanged" is locked: **no code** — metering stays
  orthogonal exactly as ADR-0162 built it; this task is deleted.
- Metering (`reserve`→`reconcile`→cap) still runs regardless (it's the spend-cap safety mechanism, not
  just billing — research §2 consensus: every gateway meters internally even under BYOK).

**T-BYOK-4 — Dashboard key form (`frontend`, ~200 LOC, design track owns craft):**

- Per-provider key entry (masked input, secure paste, explicit "secret credential" label); Validating →
  Connected / Failed states; masked metadata after save; "Update key" rotation action; cost preview
  driven by the locked billing policy (if not "free").

## Verify commands

```bash
bun test packages/ai-kit/src/byok-store.test.ts packages/ai-kit/src/byok-resolver.test.ts
bun test packages/pricebook   # keySource branch, if ADR-0182 ≠ unchanged
bun run --filter @caisson/ai-kit check
# manual: submit a bad key → editable error, no row written; good key → 200, GET shows masked last-4 only
```

## Failure modes

Plaintext key leaks into a log/error → SECURITY-audit blocker (research §3.2), scrub before any
`throw`/log. A BYOK lane debits credits when ADR-0182 locked "free" → wrong money, integer-credit path
must branch on `keySource`. Validate-on-submit skipped → a dead key enters "active" and every AI action
fails silently at resolution → the endpoint must round-trip a live provider call first.
