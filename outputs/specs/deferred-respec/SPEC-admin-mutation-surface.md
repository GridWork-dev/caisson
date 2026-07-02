---
title: apps/admin mutation surface + audit trail
status: draft - operator lock required
tags:
  [
    security,
    auth,
    secrets,
    billing,
    data-migration,
    frontend,
    infra,
    observability,
  ]
proposed-adr: ADR-0218 (next in sequence; verify ceiling — currently 0217 — before filing, per ADR-0088 collision-check convention)
adr-interactions: REQUIRES SUPERSEDING ADR-0141 (read-only mutation-deferral clause) · extends ADR-0113/0110/0204/0074 · reuses ADR-0005/0007/0212/0052/0006/0014
---

# SPEC — `apps/admin` mutation surface + dual-logged audit trail

> **This is a DRAFT for operator review. It does not authorize building.** ADR-0141 explicitly
> deferred this surface to "a later ADR"; the Caisson operator rule (`CLAUDE.md`: "Never
> auto-decide a fork") means no product code lands until a new ADR supersedes ADR-0141's
> read-only posture AND the operator locks the forks in this SPEC. This SPEC is the input to
> that ADR, not an execution plan.

## Goal (WHAT + WHY)

`apps/admin` is a read-only cockpit today (ADR-0141): the operator can SEE every tenant's
entitlements/credits/licenses through the read-only `admin` Postgres role, but has **no
application-layer path to CHANGE any of it**. Every comp, chargeback-driven revoke,
billing-error credit correction, or lost-license reissue an operator needs pre-launch can
only be done by hand-writing SQL against the Railway PG or by waiting for a real Paddle
webhook — verified: the only writers to `entitlement_grant` / `credit_wallet` /
`license_grant` are the webhook path (`services/license/src/apply-billing-event.ts`) and the
service-to-service `POST /issue` endpoint; nothing operator-triggered exists. The one
ad-hoc workaround (`services/support-bot`'s `/grant-role`) only touches Discord roles, leaving
the buyer's real DB rows unchanged — a latent inconsistency, not a fix.

This SPEC defines a **minimal, operator-only mutation surface for the 4 pre-launch actions
that are directly evidenced by dead-end code paths** — entitlement grant, entitlement revoke,
credit adjust, license reissue — each behind the existing CF-Access-JWT gate, each dual-logged
(WORM evidence + an operator-facing action log), each bounded by RLS to exactly one target
account per call, and each validated with Zod `.strict()` at the boundary.

## Tags

`security` · `auth` · `secrets` · `billing` · `data-migration` · `frontend` · `infra` ·
`observability`. Drives the SHIP audits (per gridwork-core `identity/doctrine.md`):

- **SECURITY** (blocking — money/license seam) — the `withTenant` "id-from-params" sanctioned
  exception (Risk 2), the CF-Access-gated _write_ surface, the RLS one-account bound, the new
  admin-scoped license-issue credential. `CLAUDE.md` → the crypto/money/license code here
  warrants **Fable-lane** review, not fan-out.
- **UI review** (`frontend`) — the `apps/admin` per-action type-to-confirm mutation forms +
  the `admin_action_log` audit browser.
- **Migration-safety + rollback** (`data-migration`) — the `admin_comp` CHECK extension +
  the `admin_action_log` table DDL (both via `@caisson/migrate`, ADR-0014).

`observability` is classification-only (the dual-log). Per the autonomy line the risk tags
(`security`/`auth`/`secrets`/`billing`/`data-migration`) re-enter the operator at SHIP — but
this whole SPEC is already operator-gated behind the superseding ADR, so SHIP is downstream of
the fork lock, not a surprise gate.

## Why now / trigger

- Checkout is imminent-but-not-live (Paddle sandbox, pre-launch CF-Access gate ON). The
  operator needs comp/refund/correction levers **before** the first real buyer, and the only
  current lever is raw SQL against production — the single highest-risk operator action on the
  box today.
- ADR-0141 named this the explicit follow-up ("The mutation surface ... + its audit trail is
  deferred to a later ADR") and it is still flagged open on the live board
  (`docs/state/decisions-and-forks.md`: business-admin row + the "Still deferred (own future
  ADR)" note).
- ADR-0204 (Strix remediation) just landed the in-app CF-Access-JWT check that makes a
  write surface defensible — the auth floor a mutation surface requires now exists.

## Non-goals

- **Not the 5th "buyer lookup / support-context edit" action.** No write target was found —
  identity lives in better-auth's own tables and `apps/admin/src/lib/business-reads.ts`
  derives its tenants view from the business tables precisely because there is "no typed
  reader today" for better-auth. Excluded from locked scope pending a read of better-auth's
  user/session schema (see Fork 1).
- **Not exposing `LICENSE_ISSUE_TOKEN` to the browser.** License reissue proxies `POST /issue`
  server-side under a distinct admin credential (Fork 5 + Task 5).
- **Not widening the read-only `admin` role with write grants.** ADR-0141 chose SELECT-only so
  a bug can only over-read; mixing write privilege onto that role reopens exactly that risk.
- **Not a bulk / batch surface.** One target account, one action per call — RLS bounds each
  write to that single account.
- **Not key-rotation reissue in v1** (see Fork 5).
- **Not any buyer-facing / self-serve mutation.** Operator-only, behind CF-Access.

## Current state (verified in-repo)

- **Read-only cockpit (ADR-0141):** `apps/admin/src/app/business/page.tsx` is the sole
  consumer; it renders `readTenants/readEntitlements/readCredits/readLicenses`
  (`apps/admin/src/lib/business-reads.ts`) through `withAdminRead` /
  `buildAdminReadPolicySql` (`apps/admin/src/lib/admin-read.ts`), a role that holds only
  `GRANT SELECT` + a `FOR SELECT TO admin USING (true)` policy. The page copy carries an
  explicit "mutation is a later decision" note.
- **Auth (ADR-0204, supersedes ADR-0140's edge-alone posture):**
  `apps/admin/src/middleware.ts` gates **every** route (matcher excludes only
  `_next/static`, `_next/image`, `favicon.ico`, `healthz`) with a fail-closed in-app check.
  `apps/admin/src/lib/cf-access.ts` `verifyAccessJwt` pins `issuer`/`audience`/`RS256`
  server-side and **returns `void` — it verifies and discards the token; no `email` claim is
  extracted.** The CF-Access `email` claim exists per Cloudflare's spec
  (https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)
  but is not wired. Edge policy (`infra/terraform/access.tf`): the `admin_gate` app is
  permanent, allow = anyone with a verified `@gridwork.dev` email (domain-wide, not a
  single-email pin).
- **No operator mutation path today (verified dead-ends):**
  - `services/license/src/entitlement-store.ts` — `grantEntitlements` / `revokeSubscriptionGrants`
    / `revokePurchaseGrants` exist, invoked **only** from the webhook path. Reference-counted
    grants (ADR-0113), source_kind CHECK pinned to `{subscription, one_time}`.
  - `packages/credits/src/credits.ts` — `grant` / `debit` / `clawback` exist (integer-only,
    branded `Credits` per ADR-0212, idempotent), **only** webhook callers.
  - `services/license/src/app.ts` `POST /issue` — bearer-gated by `LICENSE_ISSUE_TOKEN`
    (SHA-256 → `timingSafeEqual`), Zod `.strict()` body `{accountId, tier, major, expiry}`,
    resolves entitlements server-side (never caller-supplied), **idempotent persist-and-reuse
    per `(accountId, major)`** — a later call for the same major re-serves the SAME persisted
    token (see Fork 5).
  - `services/support-bot/src/caisson_support_bot/{billing_grant,member_mgmt}.py` — Discord
    role grants only; does nothing to the PG entitlement/credit/license rows.
- **Audit primitive to reuse:** `packages/audit-worm/src/chain-store.ts` `AuditChainStore.append`
  — append-only, per-tenant, hash-chained `audit_chain_entry` (grants withhold UPDATE/DELETE),
  `pg_advisory_xact_lock`-serialized, WORM-anchored write-once, all methods run through
  `withTenant`. An admin action targets ONE tenant's `account_id`, so appending to THAT tenant's
  chain (source-tagged `admin_action`) is a correct, zero-new-hash-chain-code fit.
  `packages/audit-harness` is a **static code-review manifest** (`domains.ts`/`findings.ts`,
  no append API) — NOT a runtime log; do not use it.
- **PG roles that exist:** `app` (`packages/tenancy-rls/src/rls.ts` `buildTenantPolicySql` —
  full CRUD, FORCE-RLS tenant-scoped) and `admin` (SELECT-only). No write role across tenants.
  `assertRoleNotPrivileged` (`rls.ts`) refuses any SUPERUSER/BYPASSRLS role for tenant work.

## Design

### The 4 locked actions

1. **Entitlement grant** (comp / support goodwill) — new source_kind, see below.
2. **Entitlement revoke** (chargeback / fraud / policy) — new source_kind, see below.
3. **Credit adjust** (billing-error correction) — positive and negative.
4. **License reissue** (lost key / device change) — proxy `POST /issue`.

### Reuse, don't rebuild — writes route through `withTenant`

An admin mutation always targets **one** operator-chosen account. `withTenant(db,
targetAccountId, fn)` binds that account's GUC, drops to the ordinary `app` role, and the
existing tested writer functions (`grant`/`clawback`/`grantEntitlements`/`revoke*`) run
verbatim under the same fail-closed RLS `WITH CHECK` buyers use — a typo'd `targetAccountId`
writes to a _different single_ account, never many. This means **no new write role and no
cross-tenant write policy are required** for the recommended design (Fork 2). One deliberate
exception to call out: `withTenant`'s contract says "the account id must come from a verified
session/JWT — never from request params" (`rls.ts`); an admin surface _inherently_ takes the
target from operator input. This is a **sanctioned exception** — the guardrails are the
CF-Access gate + the dual-log + the one-account-per-call RLS bound, not session-derived
scoping. The new ADR must state it explicitly.

### New `admin_comp` entitlement source (migration required)

`entitlement_grant.source_kind` is CHECK-pinned to `{subscription, one_time}` with a
`source_ref` CHECK forcing `subscription_id` XOR `purchase_id`. A comp grant fits neither. A
migration (via `@caisson/migrate`, ADR-0014) extends both CHECKs to admit
`source_kind = 'admin_comp'` (its own ref-shape branch), so an admin grant/revoke never
reference-counts against a real purchase (ADR-0113 refcount semantics preserved). **Rejected
lazy alternative:** reusing `one_time` with a synthetic `purchase_id` — it would make
`revokePurchaseGrants` treat a comp identically to a real purchase and destroy audit
distinguishability. Money/entitlement seam → take the correct schema change, not the shortcut.
New `grantAdminComp` / `revokeAdminComp` functions mirror the existing store functions.

### Credit adjust — reuse the ADR-0074 feature envelope

Positive adjust → `grant(tx, { eventType: "feature_grant", feature: <registered admin tag>,
amount: asCredits(delta) })`. The base `credit_event` type set is intentionally closed;
ADR-0074's `feature_grant`/`feature_debit` envelope is the sanctioned seam for a new action
**without** a base schema change — but it requires the tag be registered in `FeatureTagSchema`
(`@caisson/registry-schema`), a small base edit (Fork 3). Negative adjust must never push the
wallet negative: reuse `clawback`'s bound-to-balance pattern (`min(delta, balance)`,
`SELECT ... FOR UPDATE`), NOT `debit` (its 402 floor is the wrong semantic for a correction).
Amounts stay integer + branded (`asCredits`, ADR-0007/0212). The wrapper lives **service-side,
not in base `@caisson/credits`** (keep base free of operator concerns).

### License reissue — proxy `POST /issue`, never reimplement signing

`issueLicense` (`packages/license-issue/src/issue.ts`) already resolves current entitlements
server-side and signs. Reissue is an admin-scoped **server-side** call to `POST /issue` under a
NEW credential (Fork 5), never exposing `LICENSE_ISSUE_TOKEN` to the browser. Note the
persist-and-reuse nuance: a same-`major` reissue re-serves the buyer's EXISTING token (the
pre-launch "give me my key again" case) — true key rotation is deferred (Fork 5).

### Operator-identity plumbing (currently missing)

`verifyAccessJwt` returns `void`. Extend it to return the verified `{ email }` claim;
`middleware.ts` threads it to route handlers via a rewritten request header
(`NextResponse.next({ request: { headers } })` → `x-admin-actor`), fail-closed if the claim is
absent. This actor email is the audit-row author. Small, scoped, genuinely new code — not a
reuse.

### Dual-log every mutation

- **(a) WORM half** — append to the **target tenant's** `AuditChainStore`
  (`packages/audit-worm`) with payload `{ source: "admin_action", action, actorEmail,
targetAccountId, before, after, at }`. Reuses the tamper-evident chain verbatim — zero new
  hash-chain code. Needs an `ArtifactStore` binding in the mutation service (Fork 4 covers
  whether WORM is v1 or a fast-follow).
- **(b) App-level `admin_action_log`** (new table, NOT WORM) — `(id, actor_email,
target_account_id, action, payload_before jsonb, payload_after jsonb, created_at)`, queryable
  from `apps/admin` as the operator's "who did what" browser. The WORM chain is per-tenant
  evidence; this is the operator-facing audit list.

### Zod `.strict()` + explicit confirm UX

One `.strict()` body per action (mirrors `app.ts`'s `/issue` body and the pydantic
`extra=forbid` precedent in `billing_grant.py`): e.g. `{ targetAccountId, entitlementIds }`
(grant), `{ targetAccountId, comp|subscriptionId|purchaseId }` (revoke), `{ targetAccountId,
deltaCredits, reason }` (adjust), `{ targetAccountId, major }` (reissue). Given the money/
license blast radius, each mutation is behind a **type-to-confirm** step (type the target
account id or `CONFIRM`) — the security floor's input-validation-at-trust-boundaries rule,
made visible. Per `CLAUDE.md`, the crypto/money/license code here warrants Fable-lane review.

## Forks (operator-locked — do NOT pre-bind)

**Fork 1 — the 5th action ("buyer lookup / support-context edit").**

- **A (recommended, high confidence):** DROP from locked scope — no write target exists;
  re-scope separately after reading better-auth's user/session schema (unread here).
- **B:** include now — requires that schema read first + defining a write table.
- _Rationale:_ the other 4 are directly evidenced by dead-end code; this one is speculative.

**Fork 2 — PG role for admin writes.**

- **A (recommended, medium-high):** reuse `withTenant(db, targetAccountId, …)` + existing
  writer functions; no new role, no new policy. RLS bounds each call to one account; add an
  app-layer allowlist of exactly the 4 mutation RPCs. _Tradeoff:_ admin writes run as the same
  `app` role as buyer runtime (privilege not DB-separated), but blast radius stays one account.
- **B:** a dedicated `admin_write` role + `TO admin_write WITH CHECK (true)` cross-tenant
  policy on the touched tables + a `withAdminWrite` seam mirroring `assertRoleNotPrivileged`.
  _Tradeoff:_ a genuine new privilege class (write across tenants) — larger blast radius if the
  allowlist is ever bypassed; more code; but cleanly separates operator-write from buyer-runtime
  in the DB itself.
- _Note:_ no prior lock exists either way. A trades DB-level privilege separation for a smaller
  blast radius + zero new code; B is the choice only if the operator wants operator-write
  separated from buyer-runtime as a first-class DB boundary.

**Fork 3 — admin credit event type.**

- **A (recommended, medium):** reuse ADR-0074 `feature_grant`/`feature_debit` with a registered
  `admin_adjust` feature tag — no base `credit_event` schema change, just a
  `FeatureTagSchema` registry addition.
- **B:** add a dedicated base `credit_event` type (`admin_adjust`) — a base-owned, base-closed
  schema change to the money core.

**Fork 4 — WORM audit in v1 or fast-follow.**

- **A (recommended, medium):** WORM half from day 1 — money/entitlement mutation warrants
  tamper-evident evidence, and `AuditChainStore` is reuse-not-build; cost is provisioning an
  `ArtifactStore` for the mutation service.
- **B:** ship the app-level `admin_action_log` first, WORM as an immediate fast-follow — avoids
  the WORM store provisioning on the critical path.

**Fork 5 — license reissue semantics + credential.**

- Credential: **(recommended)** a NEW admin-scoped short-lived credential for the server-side
  `/issue` proxy; never route the CF-Access session through the shared `LICENSE_ISSUE_TOKEN`
  (that would let any CF-Access session mint licenses for any account).
- Semantics: **(recommended, medium)** v1 = re-serve the buyer's current token (idempotent
  `/issue` proxy already does this); defer true key-rotation (rotate the persisted grant for a
  same-`major` reissue) to a separate, smaller follow-up.

## Tasks (atomic; each with a verify command)

1. **CF-Access actor identity.** Extend `verifyAccessJwt` (`apps/admin/src/lib/cf-access.ts`)
   to return the verified `{ email }` claim; thread it in `middleware.ts` as an `x-admin-actor`
   request header (fail-closed if absent). Verify:
   `bun test apps/admin/src/lib/cf-access.test.ts` (extend to assert email extraction + a
   missing-claim denial).
2. **Migration — `admin_comp` source + `admin_action_log`.** A `@caisson/migrate` numbered
   migration (ADR-0014) extending `entitlement_grant_source_kind` + `entitlement_grant_source_ref`
   CHECKs to admit `admin_comp`, plus the `admin_action_log` table DDL. Verify:
   `bun test services/license/src` (round-trip: an `admin_comp` grant inserts and reads back;
   a malformed comp ref is rejected by the CHECK).
3. **Entitlement admin writers.** Add `grantAdminComp` / `revokeAdminComp` to
   `services/license/src/entitlement-store.ts` (source_kind `admin_comp`), each run inside
   `withTenant(db, targetAccountId, …)`. Verify:
   `bun test services/license/src/entitlement-store.integration.test.ts`.
4. **Credit admin-adjust wrapper (service-side).** A wrapper calling base `grant`
   (`feature_grant` + registered admin tag) for positive and a `clawback`-shaped bounded debit
   for negative; register the `admin_adjust` tag in `@caisson/registry-schema` (per Fork 3-A).
   Base `@caisson/credits` stays untouched. Verify: `bun test` the wrapper (positive grants,
   negative clamps to balance and never goes negative, integer-only).
5. **License reissue proxy.** Admin-scoped server-side call to `services/license` `POST /issue`
   under the new credential (Fork 5); never expose the issue bearer to the client. Verify:
   integration test that a `(accountId, major)` reissue re-serves the persisted token and the
   client response never contains the issue bearer.
6. **Mutation surface + Zod `.strict()` boundaries + app-layer RPC allowlist.** The 4 actions
   only, one `.strict()` body each, actor-header required. Location per Fork 2/the "where writes
   live" decision. Verify: `bun test` — rejects unknown action, rejects unknown fields, denies a
   request with no `x-admin-actor`.
7. **Dual-log wiring.** Every mutation (a) appends to the target tenant's `AuditChainStore`
   tagged `admin_action` and (b) inserts an `admin_action_log` row with before/after. Verify:
   `bun test` asserting both logs land per mutation and a failed mutation writes neither.
8. **apps/admin mutation UI.** Per-action type-to-confirm forms on the business page + an
   `admin_action_log` audit-browser view. Verify: `bun run build` (Next client/server bundle
   boundary — the only reliable catch) + a route/component test for the confirm gate.
9. **Changeset + full check.** Changeset naming every touched package; `bun run check` green
   across them. Verify: `bunx changeset status --since=origin/main` + `bun run check`.

## Verify (goal-backward)

Re-ask the goal, not the task list:

- Can the operator, from `apps/admin` behind CF-Access, perform each of the **4** actions —
  entitlement grant, entitlement revoke, credit adjust (±), license reissue — with **no raw SQL
  against production**?
- Is **every** mutation dual-logged (WORM chain + `admin_action_log`) with the real
  CF-Access `email` as actor, and RLS-bounded to exactly one target account per call?
- Does an `admin_comp` grant/revoke carry its own source_kind, never reference-counting against
  a real purchase (ADR-0113 intact)? Are credit amounts integer + branded and unable to push a
  wallet negative (ADR-0007/0212 intact)?
- Is the read-only `admin` role **unchanged** (still SELECT-only; writes went through a distinct
  path per the locked Fork 2)?
- Above all: **did a new ADR supersede ADR-0141's read-only posture and lock all forks BEFORE
  any of this shipped?** If not — do not ship (the founding operator rule).

## Risks

1. **Building without the superseding ADR violates the repo's own binding rule** (`CLAUDE.md`
   "Never auto-decide a fork"; ADR-0141 reserved this as a future ADR). Gate all code behind a
   new operator-locked ADR.
2. **`withTenant` "id from params" exception.** The admin surface deliberately takes the target
   account from operator input, contrary to `rls.ts`'s "never from request params" rule. Safe
   only because CF-Access + dual-log + one-account-per-call RLS bound it — the ADR must state
   this exception explicitly, and the app-layer allowlist must be the hard gate.
3. **Operator-identity gap.** `verifyAccessJwt` discards the token today; the audit trail is
   worthless without the `email` claim threaded through — real (small) new code, Task 1.
4. **`entitlement_grant` refcount (ADR-0113).** An admin grant/revoke needs the `admin_comp`
   source_kind (a schema migration, not just app code) or it collides with the source_ref CHECK
   and risks reference-counting against a real purchase.
5. **License reissue "for free" is deceptive.** `POST /issue` does the signing, but exposing it
   needs its own confirm UX + audit row + a distinct admin credential — routing a CF-Access
   session through the shared `LICENSE_ISSUE_TOKEN` would let any authenticated session mint
   licenses for any account (bigger blast radius than the read cockpit). And persist-and-reuse
   means a same-`major` reissue re-serves the existing token — a true "new key" case is a
   separate follow-up, not covered by a naive proxy.
6. **Credit event-type set is base-closed.** A comp/correction has no native `credit_event`
   type; Fork 3 forces a choice (feature-envelope reuse vs a base schema change) — don't
   silently reuse `topup`.
7. **The domain-wide CF-Access allowlist** admits any `@gridwork.dev` identity — recording the
   actor email makes multi-identity auditable, but the operator may want to pin a single-email
   policy in `infra/terraform/access.tf` before a write surface goes live (their call, not
   this SPEC's).
8. **WORM store provisioning** is the one genuinely-new infra piece if Fork 4-A is chosen
   (an `ArtifactStore` binding for the mutation service) — scope/effort the operator should
   weigh.

## ADR interactions

- **ADR-0141** (business-admin read-only cockpit) — **REQUIRES SUPERSEDING.** The new ADR
  supersedes 0141's "mutation ... deferred to a later ADR" clause and realizes it. The 0141
  read primitive (`withAdminRead` / `buildAdminReadPolicySql`, SELECT-only `admin` role) stays
  **intact and unchanged** — only the mutation-deferral reservation is lifted.
- **ADR-0113** (entitlement-revoke-and-onetime) — **extends** (schema migration): adds a third
  `source_kind = 'admin_comp'` + a matching `source_ref` CHECK branch; refcount + soft-revoke
  semantics preserved.
- **ADR-0110** (license-issuer-implementation) — **realizes/extends**: reuses `POST /issue` via
  an admin-scoped proxy; does NOT reuse `LICENSE_ISSUE_TOKEN` for browser-facing calls (a new
  admin credential). Surfaces the persist-and-reuse reissue nuance.
- **ADR-0204** (Strix remediation) — **extends**: builds on the in-app CF-Access-JWT middleware;
  adds email-claim extraction on top of `verifyAccessJwt`. Weakens no 0204 pin (issuer/audience/
  RS256 stay hard-coded server-side).
- **ADR-0074** (feature-meter envelope) — **extends** (Fork 3-A): a registered `admin_adjust`
  feature tag rides the existing `feature_grant`/`feature_debit` envelope rather than adding a
  base credit type.
- **ADR-0005** (fail-closed RLS) — **reused/intact**: admin writes route through `withTenant` +
  `assertRoleNotPrivileged`; each write is RLS-bounded to one account. (If Fork 2-B is chosen,
  the new `admin_write` role must pass the same non-privileged guard.)
- **ADR-0007 / ADR-0212** (integer money / branded money) — **intact**: credit adjust is
  integer-only, minted via `asCredits`, never floats, never negative wallet.
- **ADR-0052 / ADR-0006** (WORM audit chain / append-only) — **realizes/reused**: the WORM half
  appends to the target tenant's `AuditChainStore` tagged `admin_action` — no new hash-chain
  code.
- **ADR-0014** (numbered-migrate path) — **reused**: the `admin_comp` CHECK extension +
  `admin_action_log` table land as a `@caisson/migrate` numbered migration.
- **ADR-0140** (CF-Access edge-alone) — already superseded by ADR-0204; noted for lineage only.

## Effort / Value

**Effort: L (~3–5 days incl. tests).** Serialized across a `@caisson/migrate` migration
(Task 2), two `services/license` writer paths (Tasks 3, 5), a service-side credit wrapper +
one base registry edit (Task 4), the CF-Access actor plumbing (Task 1), the mutation surface +
allowlist + Zod boundaries (Task 6), the dual-log wiring (Task 7), and the `apps/admin` UI
(Task 8). Most of it is reuse-not-build (`withTenant` + the existing writer functions + the
`AuditChainStore` chain), so the LOC is modest but the seam count (money · license · audit ·
migration) makes it a Fable-lane, SECURITY-blocking change, not a fan-out.

**Value: HIGH.** Removes the single highest-risk operator action on the box today — raw SQL
against the production money/license rows — before the first real buyer, and does it behind the
CF-Access gate with a tamper-evident + operator-facing audit trail. Strictly gated: no code
ships until a superseding ADR lifts ADR-0141's read-only reservation and the operator locks all
five forks above.
