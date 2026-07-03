# SPEC — Wave-6a compliance/billing subset (build)

**Status: BUILD — authorized by ADR-0229.** This is a build plan, not a fork doc. ADR-0229
(fourth picker round, operator-locked, ceiling 0233) already dispositioned the wave-6 bucket and
committed **SPEC rows 8, 9, 10, 44, 50, 51, 54, 56, 57, 59** to build as **ONE spec / workflow /
PR set**. There are **no open forks** here; every decision below is downstream of that lock.

- **Type:** house-format build SPEC (Goal / Scope / Design / Tasks / Verify / Effort-Value),
  matching `outputs/specs/harvest-slice2/`.
- **Realizes:** ADR-0229 (the 10-row commit) → extends ADR-0210 §3–4 (the parked residual).
- **Source rows:** `outputs/specs/deferred-respec/SPEC-wave6-harvest-disposition.md` §4 — rows
  8, 9, 10, 44, 50, 51, 54, 56, 57, 59; source evidence vendored at
  `outputs/research/caisson-lift-sweep-REPORT.md`.
- **Tags (audit-firing at SHIP):** `security` · `auth` · `secrets` · `billing` · `data-migration`
  (the `billing_processed_event` table + credit/audit primitives). No `ai`/`ui`/`infra`.
- **Delivery:** one workflow-orchestrated EXECUTE, one PR. Model routing per
  `identity/doctrine.md`; **fable only** for the money/crypto verdicts (rows 50/51 clawback-adjacent,
  row 10 hash, rows 44/59 secret-compare). Do NOT push / open the PR from the authoring session.

## Goal (WHAT + WHY)

Close the ten named SOC2/HIPAA-evidence, secret-compare, and money/jobs-idempotency gaps ADR-0229
committed — **as caisson-idiomatic primitives written clean**, reusing what already ships and
building only the genuine deltas. The subset is tree-coherent: compliance-evidence primitives +
two auth primitives (WP-A) and billing/credits idempotency + jobs safety + a kernel fail-closed
gate (WP-B).

**Rebuild-clean firewall (binding).** Every source row cites an OUTSIDE repo (telesis, gridwork,
gridworkdigital, glossread) for the **pattern only**. Never port an implementation. Write
caisson-idiomatic TypeScript from scratch against the kernel/billing/jobs seams. Nothing from
`media-pipeline` (pro-private) seeds anything.

## Scope

**In:** the ten rows, homed + built per Design §2. Each changed `packages/*` gets a NAMING
changeset. Wiring into `services/license` (a service, changeset-optional) where a primitive needs
a real consumer.

**Out:**

- **No new package.** Every row lands in an existing package (`kernel`, `billing`, `jobs`,
  `compliance`) or a doc.
- **No credit-expiry / lot-draining** (row 50's "expire / drain-order" half) — caisson credits are
  a single fungible integer balance (`credit_wallet.balance`), there are no grant lots to drain and
  **no expiry feature exists**. Building lot-based expiry now is speculative (YAGNI); it stays
  build-on-trigger under ADR-0210 §4. Row 50's **idempotency** half is the in-scope part — and it
  is _already shipped_ (Design §1), so row 50 folds entirely into row 51's webhook layer.
- **No refactor of the shipped flat scrubbers** (`observability/scrub.ts`, kernel `scrubForEgress`)
  — row 8 adds a deep scrubber alongside them; it does not churn them.
- **No speculative wiring.** Where a primitive has no live caller yet (row 54's read-only source,
  row 59's future cron endpoints), ship the tested primitive + a documented adoption point, marked
  with a `ponytail:` comment naming the ceiling. A fake caller is worse than none.
- No pricing / edition-membership / license-split changes.

## Design

### §1 — Reconciliation: what already ships (read before building)

The kernel is further along than the source rows assume. **Build only the deltas below.**

| Row | Source pattern                                                            | Already in caisson                                                                                                                           | Genuine delta to build                                                                                               |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 8   | Sentry PHI/secret scrubber                                                | `scrubForEgress`/`looksLikeSecret` (kernel, string spans) · `scrubAttributes`/`SENSITIVE_ATTRIBUTE_KEY` (observability, **flat** span attrs) | a **deep/recursive** object scrubber (key-name PHI, snake+camelCase) that composes `scrubForEgress` on string leaves |
| 9   | ADR-in-docstring + `policy_version` golden rows                           | control code exists; no traceability convention                                                                                              | a **template doc + one golden exemplar** (not a framework)                                                           |
| 10  | canonical-JSON + SHA-256 content hash                                     | `canonicalize` + `hashChainLink` (kernel audit-chain)                                                                                        | a 3-line standalone `contentHash()` (hash the claim itself, not a chain-link 2-tuple)                                |
| 44  | hash-both-sides `timingSafeEqual` wrapper                                 | **`safeEqualVariable` IS this exact primitive**                                                                                              | a named, no-early-return allowlist wrapper over it + adoption/doc                                                    |
| 50  | idempotent credits ledger (UNIQUE + FOR UPDATE + drain)                   | **ledger idempotency fully shipped** (`credit_event` UNIQUE indexes, `ON CONFLICT DO NOTHING RETURNING`, `FOR UPDATE` in `clawback`)         | nothing new in credits — it is the _inner_ layer row 51 builds on                                                    |
| 51  | dual-layer webhook idempotency (outer event-table + per-side-effect keys) | credit/entitlement writes idempotent; **the post-commit Discord push is NOT** (re-fires on every re-delivery)                                | `billing_processed_event` table + `processEvent()` (outer) + `withIdempotentSideEffect()` (per-effect)               |
| 54  | `assertNotReadOnly` mutation gate                                         | nothing                                                                                                                                      | the fail-closed primitive (reusing `ConflictError`) + doc; no live caller yet                                        |
| 56  | scheduler `max_instances=1`/`coalesce`                                    | `EnqueueOptions` has only `idempotencyKey`; pg-boss + retention sweep ship                                                                   | a `singletonKey` overlap-safety enqueue option across all 3 drivers + retention as the real consumer                 |
| 57  | race-free dedup via `pg_advisory_xact_lock`                               | `deriveIdempotentJobId` + `ON CONFLICT` (atomic INSERT dedup); SKIP LOCKED consumer (ADR-0211)                                               | a `withAdvisoryXactLock()` helper for the _producer-side_ check-then-enqueue TOCTOU the INSERT-dedup can't cover     |
| 59  | cron/internal bearer auth (constant-time, fail-closed)                    | `safeEqualFixed` exists; mcp-server has its own ad-hoc extractor                                                                             | a shared `verifyBearer()` kernel helper every background trigger uses                                                |

### §2 — Per-row build

Every rule below is binding: **TS strict, Bun only, no `any`, no `console.log` in product code,
Zod `.strict()` at every boundary, `crypto.randomUUID()` ids, integer credits/money,
`fetchWithTimeout` on outbound fetch, `crypto.timingSafeEqual` (via the kernel wrappers) for secret
compares, composable packages never depend "up" on an edition (ADR-0003).**

---

#### Row 8 — Deep PHI/secret scrubber (compliance evidence) — `@caisson/kernel`, size S

**Home:** `packages/kernel/src/secret-scrub.ts` (add), exported from `packages/kernel/src/index.ts`.

**Why here:** kernel is the zero-dep, lowest-license home that already owns `scrubForEgress`; the
deep scrubber is the compliance-evidence primitive any error/telemetry/structured-event egress
composes. The existing flat scrubbers stay untouched (observability's is OTel-span-shaped and
depends on `@opentelemetry`; this one is pure and dependency-free).

**Public API:**

```ts
/** Case-insensitive substring set of PHI/PII key names (snake_case + camelCase both match by
 *  substring): email, ssn, social_security, dob, date_of_birth, phone, first_name/last_name/
 *  full_name, address, birthdate, mrn, patient. Unified with observability's SENSITIVE_ATTRIBUTE_KEY
 *  intent, but owned here as the reusable set. */
export const PHI_KEY: RegExp;

/** Recursively redact a JSON-ish value for egress. A key whose NAME matches PHI_KEY (or the
 *  secret-name set) drops its whole subtree to "[REDACTED]"; every remaining string leaf is run
 *  through scrubForEgress (secret spans). Arrays keep order; cycles are guarded. Pure, deterministic,
 *  idempotent. Returns a NEW value (never mutates input) — unlike observability's in-place span pass. */
export function scrubDeep(value: unknown): unknown;
```

**Tests + golden:** `packages/kernel/src/secret-scrub.test.ts` extended; golden
`packages/kernel/src/__golden__/scrub-deep.json` (input→output table: nested PHI keys redacted,
secret spans in leaves redacted, non-secret text untouched, camelCase + snake_case both hit, a
cyclic object does not hang). Assert idempotency (`scrubDeep(scrubDeep(x)) === scrubDeep(x)` deep).

**Verify:** `bun test packages/kernel/src/secret-scrub.test.ts`

---

#### Row 9 — Policy-to-code ADR traceability idiom (compliance evidence) — doc + exemplar, size XS

**Deliverable is a convention, NOT a framework:** a documented template + exactly one golden
exemplar.

**Home:**

- Template doc: `docs/compliance/control-traceability.md` — defines the idiom: (a) every
  compliance-control-bearing function carries a `Control: ADR-NNNN — <policy name>` line in its
  docstring; (b) golden fixtures for control logic carry a `policyVersion` field pinning the ADR/
  policy revision the golden was captured under. Two rules, one page. Cite what a SOC2/HIPAA
  auditor asks for (control → code → evidence traceability).
- Exemplar: annotate ONE real control function's docstring in
  `packages/compliance/src/frameworks/soc2-tsc.ts` (or `hipaa-security.ts`) with the `Control:`
  line, and add a `policyVersion` field to ONE golden fixture under
  `packages/compliance/src/__golden__/`.

**Tests:** the compliance package's existing golden test must still pass with the `policyVersion`
field present (update the golden + its reader if the fixture is `.strict()`-parsed).

**Verify:** `bun test packages/compliance` and `grep -n "Control: ADR-" packages/compliance/src/frameworks`

---

#### Row 10 — Standalone content hash (audit-chain) — `@caisson/kernel`, size XS

**Home:** `packages/kernel/src/audit-chain.ts` (add), exported from index.

**Why here:** `hashChainLink(prevHash, payload)` hashes `canonicalize([prevHash, payload])` — a
_chain-link_ hash. A frozen-claim integrity tag wants the hash of the **claim itself**, with no
chain wrapper. Three lines over the existing `canonicalize`.

**Public API:**

```ts
/** Lowercase-hex SHA-256 over canonicalize(value) — the content-integrity tag for a single frozen
 *  claim/artifact, independent of any chain. NOT a secret comparison (public integrity tag), so
 *  plain equality on the result is correct (ADR-0006 note). */
export function contentHash(value: JsonValue): string;
```

**Tests:** `packages/kernel/src/audit-chain.test.ts` — KAT (a fixed value → its known digest),
canonicalization-invariance (two key-orderings → same hash), distinct-payload → distinct hash.

**Verify:** `bun test packages/kernel/src/audit-chain.test.ts`

---

#### Row 44 — Constant-time allowlist verification wrapper (auth / security floor) — `@caisson/kernel`, size XS

**Home:** `packages/kernel/src/crypto.ts` (add), exported from index. **`safeEqualVariable`
already IS the hash-both-sides primitive** — row 44's delta is the _named wrapper_ that standardizes
the admin/allowlist compare and removes the early-return timing leak a hand-rolled `.some()` loop
introduces.

**Public API:**

```ts
/** Constant-time membership test: is `candidate` equal (after `normalize`) to any entry in `allowed`?
 *  Scans EVERY entry with safeEqualVariable and ORs the result — NO early return on first match, so
 *  the timing does not leak which/whether an entry matched. `normalize` defaults to trim+lowercase
 *  (the admin-email allowlist case in security.md). Empty allowlist ⇒ false (fail-closed). */
export function verifyAllowlisted(
  candidate: string,
  allowed: readonly string[],
  normalize?: (s: string) => string,
): boolean;
```

**Adoption:** this is the wrapper `security.md`'s variable-length-secret-comparison rule points at;
document it there-in-spirit via the docstring. Grep confirms no raw admin-email/allowlist `===`
compare exists to migrate today, so no call-site rewrite is forced — the primitive stands ready.

**Tests:** `packages/kernel/src/crypto.test.ts` — match / no-match / case+whitespace normalize /
empty allowlist fail-closed / a match anywhere in the list (not just index 0).

**Verify:** `bun test packages/kernel/src/crypto.test.ts`

---

#### Rows 50 + 51 (CONVERGED) — Dual-layer billing-webhook idempotency (billing) — `@caisson/billing`, size M

**The convergence ADR-0229 names.** Row 50's ledger idempotency is **already shipped** (kernel/
credits: `credit_event` UNIQUE indexes + `ON CONFLICT DO NOTHING RETURNING` + `FOR UPDATE`) — it is
the **inner** layer. Row 51 adds the **outer** event-dedup layer + the **per-side-effect** layer
that the inner ledger can't cover: a re-delivered webhook is absorbed by the credit ledger, but the
**post-commit Discord role push (ADR-0203) re-fires every re-delivery** (`services/license/src/app.ts`
fires it detached, un-guarded), and any future non-DB side-effect (email receipt) would too.

**Home:** `packages/billing/src/idempotency.ts` (new file), exported from
`packages/billing/src/index.ts`. Billing owns the primitive; `services/license` composes it
(license depends on billing — never the reverse; ADR-0003 honored).

**Public API:**

```ts
/** Outer webhook-event dedup table (ADR-0006 append-only; ships as a checksum-pinned platform
 *  migration string, NOT an edit to an existing one). PK is the claim key. */
export const PROCESSED_EVENT_SCHEMA_SQL: string; // billing_processed_event(event_key text PK, processed_at timestamptz default now())

export interface ProcessResult {
  alreadyProcessed: boolean;
}

/** OUTER layer: claim `sourceEventId` exactly once. INSERT ... ON CONFLICT DO NOTHING RETURNING —
 *  a fresh claim runs `fn` and returns {alreadyProcessed:false}; a re-delivery finds the row, SKIPS
 *  `fn`, returns {alreadyProcessed:true}. Run inside the caller's withTenant tx so the claim commits
 *  atomically with the grant `fn` performs. */
export async function processEvent(
  tx: TenantExecutor,
  sourceEventId: string,
  fn: () => Promise<void>,
): Promise<ProcessResult>;

/** PER-SIDE-EFFECT layer: claim `${sourceEventId}:${sideEffect}` once, same table + mechanic, so one
 *  event fanning into N writes fires each effect at most once across re-deliveries. Returns whether
 *  THIS call performed the effect (false ⇒ already done, skipped). */
export async function withIdempotentSideEffect(
  tx: TenantExecutor,
  sourceEventId: string,
  sideEffect: string,
  fn: () => Promise<void>,
): Promise<boolean>;
```

**Wiring (services/license, changeset-optional):**

- `services/license/src/webhook.ts` — wrap the `applyBillingEvent` call in `processEvent(tx,
event.sourceEventId, …)` inside the existing `withTenant`. A re-delivery short-circuits before the
  grant AND before returning `grantedEntitlements` — so the post-commit push is skipped too. Keep
  the accountId-unresolved loud-fail path (it must still throw for retry).
- Do NOT weaken the existing ledger idempotency — it stays the inner backstop (a partial-commit or
  a claim on a _different_ delivery still can't double-grant).

**Migration:** `PROCESSED_EVENT_SCHEMA_SQL` is a NEW checksum-pinned platform migration applied by
`apps/site` deploy-migrate + everywhere the billing tables bootstrap (mirror
`CREDIT_ROUNDING_MIGRATION_SQL`'s convention: a separate string, never an edit to a shipped one).
RLS: `billing_processed_event` is tenant-owned → `buildTenantPolicySql("billing_processed_event")`
(the claim runs inside `withTenant`).

**Tests:** `packages/billing/src/idempotency.integration.test.ts` (PGlite, `setDefaultTimeout(30_000)`
per the license-suite gotcha) — fresh claim runs fn; re-claim skips fn (same id); two side-effects
of one event both fire once; a re-delivery re-fires neither grant nor side-effect. Plus a
`services/license` integration test: a re-delivered `purchase.completed` grants once AND pushes
Discord once.

**Verify:** `bun test packages/billing/src/idempotency.integration.test.ts && bun test services/license`

---

#### Row 54 — Read-only-mode mutation gate (kernel/tenancy fail-closed) — `@caisson/kernel`, size XS

**Home:** `packages/kernel/src/read-only.ts` (new), exported from index. Reuse `ConflictError`
(409) — a mutation attempted while read-only is a conflict with system state; no new error class.

**Public API:**

```ts
export type SystemMode = "active" | "read_only";

/** Fail-closed: throw ConflictError when `mode` is "read_only". Call FIRST in any mutation
 *  entrypoint, before touching the DB — mirrors caisson's fail-closed-RLS philosophy. The `mode`
 *  source (a maintenance flag / dunning state / admin toggle) is the caller's; this is the gate. */
export function assertNotReadOnly(mode: SystemMode, action?: string): void;
```

**Adoption:** intended callers are the admin mutation surface (ADR-0220 `withAdminWrite`) and
billing/credit mutations under a future maintenance/dunning mode. **No live read-only source exists
today** (dunning #53 is not built) — so ship the primitive + a `ponytail:` comment naming the
ceiling ("no mode source wired yet; call at the mutation boundary once one exists"). Do not invent a
fake caller.

**Tests:** `packages/kernel/src/read-only.test.ts` — throws on `read_only`, no-op on `active`, the
thrown error is a `ConflictError` carrying `action`.

**Verify:** `bun test packages/kernel/src/read-only.test.ts`

---

#### Row 56 — Overlap-safe recurring-job default (jobs) — `@caisson/jobs`, size XS

**Home:** `packages/jobs/src/queue.ts` (extend `EnqueueOptions`), honored in all three drivers.

**The pattern (APScheduler `max_instances=1`/`coalesce`) → pg-boss `singletonKey`:** an interval
job must not stack a new run while the prior one is still queued/active.

**Public API (additive — every existing 2-arg caller keeps compiling):**

```ts
export interface EnqueueOptions {
  idempotencyKey?: string;
  /** Overlap-safety (ADR-0229 row 56): at most one job with this key may be queued/active at once —
   *  a second enqueue while one is in flight is a no-op. The recurring-job default so a slow run
   *  never stacks. Distinct from idempotencyKey (which dedups a RETRY of one logical job). */
  singletonKey?: string;
}
```

- **pg-boss driver:** map `singletonKey` → `boss.send(name, data, { singletonKey })` (native
  overlap suppression).
- **in-memory driver:** track in-flight `singletonKey`s in a `Set`; a same-key enqueue while one is
  running is a no-op (honest, testable).
- **trigger driver:** map to the SDK's queue/concurrency option, or document the no-op with a
  `ponytail:` note (Trigger.dev's hosted scheduler owns overlap) — do not fake it.

**Real consumer:** the retention `auto_90d` sweep (`packages/retention-runner/src/schedule.ts` /
its enqueue site) enqueues with a per-tenant `singletonKey` so a long erasure sweep can't double-run.

**Tests:** `packages/jobs/src/queue.test.ts` + `pgboss.test.ts` — in-memory: second same-key
enqueue while in-flight is a no-op; pg-boss (mock client): `send` receives `{ singletonKey }`.

**Verify:** `bun test packages/jobs/src/queue.test.ts packages/jobs/src/pgboss.test.ts`

---

#### Row 57 — Advisory-lock producer-side dedup (jobs, composes ADR-0211) — `@caisson/jobs`, size S

**Home:** `packages/jobs/src/advisory-lock.ts` (new), exported from index.

**The gap the INSERT-dedup can't cover:** `deriveIdempotentJobId` + `ON CONFLICT DO NOTHING` makes
the _INSERT_ atomic — but a **check-then-enqueue** decision ("enqueue a digest only if none is
pending and the last was >1h ago") is a read-then-write TOCTOU two workers can both pass. A Postgres
transaction-scoped advisory lock serializes that critical section. **Composes with the shipped
SKIP-LOCKED consumer (ADR-0211):** SKIP LOCKED protects the consumer claim; this protects the
producer's conditional enqueue.

**Public API:**

```ts
/** Run `fn` holding a Postgres transaction-scoped advisory lock keyed by `key` (hashed to a bigint
 *  via sha256→BigInt). SELECT pg_advisory_xact_lock($1) before fn; the lock auto-releases at tx end
 *  (no manual unlock, no leak on throw). Serializes a check-then-enqueue critical section across
 *  workers — the TOCTOU a plain UNIQUE + SELECT-then-INSERT still has. Run inside withTenant. */
export async function withAdvisoryXactLock<T>(
  tx: TenantExecutor,
  key: string,
  fn: () => Promise<T>,
): Promise<T>;
```

**Tests:** `packages/jobs/src/advisory-lock.test.ts` — unit (injected executor): asserts
`pg_advisory_xact_lock(<stable bigint of key>)` is issued exactly once before `fn`, and `fn`'s
result returns; key→bigint is stable + collision-separated (NUL-free hash). Integration
(`advisory-lock.integration.test.ts`, PGlite, `skipIf` if advisory locks are unsupported): two
concurrent `withAdvisoryXactLock` on the same key serialize (a shared counter never races).

**Verify:** `bun test packages/jobs/src/advisory-lock.test.ts`

---

#### Row 59 — Shared cron/internal bearer auth (jobs/background triggers) — `@caisson/kernel`, size XS

**Home:** `packages/kernel/src/crypto.ts` (add — it already owns the compare primitives), exported
from index. One shared helper every background-job HTTP trigger uses, replacing ad-hoc extractors.

**Public API:**

```ts
/** Fail-closed bearer check for an internal/cron HTTP trigger. Extracts the token from an
 *  `Authorization: Bearer <token>` header and constant-time-compares it (safeEqualFixed) to
 *  `expected`. Throws AuthnError on ANY of: missing/empty header, wrong scheme, mismatch, or an
 *  empty `expected` (a blank secret must never authorize — fail closed). Never echoes the token. */
export function verifyBearer(
  authorizationHeader: string | null | undefined,
  expected: string,
): void;
```

**Adoption:** the shared helper for retention/alerting cron endpoints + any future `/internal/*`
trigger. No such HTTP endpoint ships in `packages/*` today (retention runs as a task, not a server;
mcp-server has its own request-scoped extractor with different semantics — leave it), so ship the
primitive + document it as the required gate for the next internal trigger. `ponytail:` comment
names the ceiling. Do not retrofit mcp-server (out of scope, different auth model).

**Tests:** `packages/kernel/src/crypto.test.ts` — valid token passes; missing header / wrong scheme
/ mismatched token / empty expected all throw `AuthnError`; the error message never contains the
token.

**Verify:** `bun test packages/kernel/src/crypto.test.ts`

### §3 — Changesets (binding — the gate fails otherwise)

Every changed **`packages/*`** needs a NAMING changeset (`.changeset/<slug>.md` listing the package

- bump + summary). One changeset per package for the whole PR (changesets aggregate at release; a
  package changed in both WPs is listed **once** at its highest bump). `services/*` and `docs/*` are
  exempt from the gate (a `service-license` patch changeset is optional, nice-to-have).

| Changeset file                                          | Package                    | Bump  | Covers rows                            |
| ------------------------------------------------------- | -------------------------- | ----- | -------------------------------------- |
| `.changeset/wave6a-kernel-primitives.md`                | `@caisson/kernel`          | minor | 8, 10, 44, 54, 59 (new exports)        |
| `.changeset/wave6a-billing-webhook-idempotency.md`      | `@caisson/billing`         | minor | 50, 51 (new exports + migration)       |
| `.changeset/wave6a-jobs-overlap-advisory.md`            | `@caisson/jobs`            | minor | 56, 57 (new option + export)           |
| `.changeset/wave6a-compliance-traceability.md`          | `@caisson/compliance`      | patch | 9 (docstring + golden `policyVersion`) |
| `.changeset/wave6a-license-webhook-dedup.md` (optional) | `@caisson/service-license` | patch | 50/51 wiring                           |

**Verify:** `bunx changeset status --since=origin/main` (must exit 0).

## Tasks

Two bounded work packages, one PR. **WP-A** (compliance evidence + auth) and **WP-B** (money + jobs

- kernel) are tree-disjoint except both touch `packages/kernel` — sequence WP-A's kernel edits
  before WP-B's, or land both kernel files in one pass, so the single kernel changeset is coherent.
  One atomic commit per row (conventional, multiple `-m` flags; subjects free of backticks / `+` /
  `@` / em-dashes / a second `(`).

### WP-A — rows 8, 9, 10, 44 (compliance evidence + auth)

| #   | Row | File target(s)                                                                                                                                                                         | Deliverable                                                                                |
| --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A1  | 8   | `packages/kernel/src/secret-scrub.ts` · `packages/kernel/src/index.ts` · `packages/kernel/src/__golden__/scrub-deep.json` · `packages/kernel/src/secret-scrub.test.ts`                 | `scrubDeep()` + `PHI_KEY`; deep key-name + leaf-span redaction; golden-pinned + idempotent |
| A2  | 10  | `packages/kernel/src/audit-chain.ts` · `packages/kernel/src/index.ts` · `packages/kernel/src/audit-chain.test.ts`                                                                      | `contentHash(value)` = sha256(canonicalize(value)); KAT test                               |
| A3  | 44  | `packages/kernel/src/crypto.ts` · `packages/kernel/src/index.ts` · `packages/kernel/src/crypto.test.ts`                                                                                | `verifyAllowlisted()` — constant-time, no early return, normalized, fail-closed            |
| A4  | 9   | `docs/compliance/control-traceability.md` (new) · `packages/compliance/src/frameworks/soc2-tsc.ts` (docstring) · `packages/compliance/src/__golden__/<fixture>.json` (`policyVersion`) | template doc + one golden exemplar (NOT a framework)                                       |
| A5  | —   | `.changeset/wave6a-kernel-primitives.md` (kernel minor) · `.changeset/wave6a-compliance-traceability.md` (compliance patch)                                                            | NAMING changesets for WP-A packages                                                        |

WP-A verify: `bun test packages/kernel packages/compliance && bun run check`

### WP-B — rows 50, 51, 54, 56, 57, 59 (money + jobs + kernel)

| #   | Row   | File target(s)                                                                                                                                                                                                                                                                         | Deliverable                                                                                                                                                             |
| --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | 50+51 | `packages/billing/src/idempotency.ts` (new) · `packages/billing/src/index.ts` · `packages/billing/src/idempotency.integration.test.ts` · `services/license/src/webhook.ts` (wire) · `services/license/src/webhook.integration.test.ts`                                                 | `PROCESSED_EVENT_SCHEMA_SQL` + `processEvent()` + `withIdempotentSideEffect()`; migration string; license wraps applyBillingEvent so a re-delivery grants + pushes once |
| B2  | 54    | `packages/kernel/src/read-only.ts` (new) · `packages/kernel/src/index.ts` · `packages/kernel/src/read-only.test.ts`                                                                                                                                                                    | `assertNotReadOnly(mode, action?)` fail-closed (ConflictError); `ponytail:` no-caller ceiling                                                                           |
| B3  | 56    | `packages/jobs/src/queue.ts` (EnqueueOptions) · `packages/jobs/src/pgboss.ts` · `packages/jobs/src/trigger-driver.ts` · `packages/jobs/src/index.ts` · `packages/retention-runner/src/schedule.ts` (consumer) · `packages/jobs/src/queue.test.ts` · `packages/jobs/src/pgboss.test.ts` | `singletonKey` overlap-safety across 3 drivers + retention singleton enqueue                                                                                            |
| B4  | 57    | `packages/jobs/src/advisory-lock.ts` (new) · `packages/jobs/src/index.ts` · `packages/jobs/src/advisory-lock.test.ts` (+ `.integration.test.ts` skipIf)                                                                                                                                | `withAdvisoryXactLock()` producer-side TOCTOU guard; composes ADR-0211                                                                                                  |
| B5  | 59    | `packages/kernel/src/crypto.ts` · `packages/kernel/src/index.ts` · `packages/kernel/src/crypto.test.ts`                                                                                                                                                                                | `verifyBearer()` fail-closed constant-time bearer check                                                                                                                 |
| B6  | —     | `.changeset/wave6a-billing-webhook-idempotency.md` (billing minor) · `.changeset/wave6a-jobs-overlap-advisory.md` (jobs minor) · (kernel changeset from A5 also covers 54+59) · optional `.changeset/wave6a-license-webhook-dedup.md`                                                  | NAMING changesets for WP-B packages                                                                                                                                     |

WP-B verify: `bun test packages/billing packages/jobs packages/kernel services/license && bun run check`

**Note — `retention-runner` changeset:** if B3 edits `packages/retention-runner/src/*`, add a
`retention-runner` patch changeset too (the gate covers every changed `packages/*`).

## Verify (goal-backward)

Re-ask the Goal — _did we close the ten committed gaps as clean caisson primitives, building only
the genuine deltas, with the credits/money integer + secret-compare + composition invariants
intact?_

- **All ten rows land.** 8/10/44/54/59 in kernel, 50+51 in billing (+license wiring), 56/57 in jobs,
  9 as doc+exemplar. Nothing built for row 50's expire/drain half (documented YAGNI) or as a new
  package.
- **Reuse honored.** No re-implementation of `safeEqualVariable` (44 wraps it), `canonicalize` (10
  reuses it), the credit ledger idempotency (50 is the shipped inner layer), or the flat scrubbers
  (8 adds a deep one alongside).
- **Idempotency proven.** A re-delivered billing webhook grants credits once, grants entitlements
  once, AND pushes Discord once (the previously-unguarded gap) — asserted by a license integration
  test.
- **Fail-closed throughout.** `verifyAllowlisted`/`verifyBearer`/`assertNotReadOnly` all fail closed
  on empty/absent/mismatch; `scrubDeep` never emits an un-redacted PHI/secret leaf (golden-pinned).
- **Invariants intact.** Integer credits/money untouched; every new secret compare routes through a
  kernel timing-safe wrapper; every boundary is Zod `.strict()`; no package depends up on an edition;
  the `billing_processed_event` migration is append-only (a new string, not an edit).
- **Gate green.** `bunx changeset status --since=origin/main` exits 0 (every changed `packages/*`
  has a NAMING changeset); `bun run check` + `bun run gate` pass.
- **No speculative wiring.** Row 54/59 primitives ship tested with a `ponytail:` ceiling comment
  where no live caller exists yet — not a fabricated consumer.

## Effort / Value

**Effort: S–M** — nine of ten rows are XS/S primitives reusing shipped kernel seams; only 50+51
(billing idempotency layer + migration + license wiring) is M. **Value: HIGH** — closes named
SOC2/HIPAA evidence gaps (deep PHI scrubber, control traceability), the one real
webhook-idempotency hole (post-commit Discord re-push), and cheap jobs/auth hardening, all before
launch. Fable reserved for the money/crypto verdicts (50/51, 10, 44/59) per doctrine.
