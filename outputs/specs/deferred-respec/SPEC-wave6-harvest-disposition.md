# SPEC — Wave-6 harvest disposition (enumerate + rank the parked sub-top-15 lift-sweep residual)

**Status: DRAFT — operator lock required.** Document-only; authorizes no build. Realizes
ADR-0210 §4; spec-gated (ADR-0133). This is a DRAFT for the operator to review and lock — a
single disposition + roadmap document, not 22 (or 67) build specs.

- **Type:** disposition-roadmap — one document, no product code. Format matches the
  `outputs/specs/harvest-slice2/` house SPECs (Goal / Scope / Design / Tasks / Verify /
  Effort-Value); it just carries a whole-bucket disposition instead of one package's build.
- **Proposes ADR:** ~0218 (next free after the 0217 ceiling — grep `main` FIRST per ADR-0088;
  this session's ceiling may be stale by merge time).
- **Supersedes:** nothing. Realizes ADR-0210 §4's PARK promise.
- **Tags:** harvest · security · auth · secrets · billing · ai · data-migration ·
  observability · ui · infra — these classify the _domains the parked candidates span_; this
  SPEC lands no product code, so no audit fires on it. Each fork-gated `build-next` follow-up
  SPEC (if the operator ever elects one) re-declares its own audit-firing tags.
- **Prior art:** ADR-0133 (the document-only, spec-gated harvest initiative) · ADR-0210 §4
  (the PARK lock this realizes) · ADR-0135 (the 2 built NEW-PKGs the `37 − 15` math excludes).

## Goal (WHAT + WHY)

ADR-0210 §4 **PARKED** the "Wave-6 sub-top-15 residual (~22 items)" per the harvest program's
own ordering — but recorded only the _count_, never the _list_: "no per-package SPEC pending.
Recorded here so the bucket is dispositioned, not silently dropped." The actual candidate rows
exist in exactly **one** artifact — `caisson-lift-sweep-REPORT.md` (Source C, the 6-repo lift
sweep) — which lives **outside** the caisson repo, un-versioned, one directory above it
(`/home/gw/lab/caisson-lift-sweep-REPORT.md`). If that file drifts or is lost, the wave-6
source evidence is gone and ADR-0210 §4 points at nothing.

**Why now.** Three live triggers: (1) the operator's deferred-items backlog surfaced
`wave6-harvest-disposition` precisely to turn that bare count into a lockable, durable list;
(2) evidence-drift is live — `ADR-0133`/`ADR-0210` `Evidence:` lines reference the report by
bare filename, and one `rm`/`mv` above the repo root makes the only enumeration source
unrecoverable; (3) the harvest program is otherwise terminal — ADR-0210 closed Source A (11
pkgs), Source B (Wardfile top-6), and Source C top-15 to terminal states, so wave-6 is the
_only_ open bucket in the whole program.

This SPEC closes the gap in one document: it (1) states the arithmetic origin of the "~22"
figure, (2) reproduces the full candidate enumeration from the report as a durable in-repo
table — every parked row with _what it is · source repo+path · target package · size · value ·
disposition_ — (3) ranks each row `build-next` / `build-on-trigger` / `drop-with-reason`, and
(4) vendors the source report into the repo so the evidence stops living out of reach. Locking
this SPEC realizes ADR-0210 §4's promise; it authorizes **no build**.

## Scope

**In:**

- The `37 − 15 = 22` arithmetic origin, stated plainly (Design §1).
- The full 67-row enumeration + per-row disposition ranking — `build-next` / `build-on-trigger`
  / `drop-with-reason`, each with a one-line reason (Design §2–§4).
- Vendoring `caisson-lift-sweep-REPORT.md` into the repo so the source rows travel with the ADRs
  that cite them (Design §5, Task 1).
- Repointing `harvest-program.md` §Residuals at this disposition + its derived split (Task 3).
- Two operator forks (disposition scope; build-now-vs-stay-parked) presented with options + a
  labeled recommendation, decided by the operator on lock (Design §8).

**Out:**

- **NOT 22 (or 67) build specs.** Per-package SPECs are a _fork-gated_ follow-up (Task 5), never
  in this SPEC.
- **Builds nothing.** Spec-gate binds (ADR-0133): no product code lands from a lock. Locking
  records dispositions only.
- **Does NOT re-open Source A / Source B.** Both are fully terminal per ADR-0210 (all 11 + all 6
  built/existing). The wave-6 residual draws **exclusively from Source C**.
- **Does NOT re-rank the top-15, nor touch shipped work** (incl. the 2 built NEW-PKGs,
  ADR-0135) — out of scope by construction.
- **Does NOT change pricing, edition membership, or the open/commercial license split.**
- **Does NOT decide the operator forks** — Forks A and B are presented with options + a
  labeled recommendation; the operator locks them.

## Design

**Real files this SPEC draws from / touches.** `docs/state/harvest-program.md` — the ranked,
deduped 3-source tracking doc; §Residuals carries the bare _"Wave-6 sub-top-15 candidates
(~22) → PARKED … no per-package SPEC pending"_ line (repointed by Task 3). ·
`knowledge/decisions/ADR-0210-harvest-slice2-wave-lock.md` §4 — the binding PARK lock (count +
disposition, no enumeration). · `ADR-0133` — the document-only, spec-gated harvest initiative
(Source A + B both terminal). · `ADR-0135` — the 2 built NEW-PKGs (alerting #1,
retention-runner #3) the `37 − 15` math excludes. · `caisson-lift-sweep-REPORT.md` — **Source
C, the only place the rows exist**, one dir above the repo, un-versioned (grep confirms no
in-repo file under `outputs/`, `docs/`, `knowledge/` enumerates the wave-6 items). ·
`outputs/specs/harvest-slice2/` — the 10 house-format wave-1..5 build SPECs (this SPEC's format
reference + any future `build-next` follow-up's). · `docs/build-state.md` — live per-package
truth; the **required pre-lock cross-check** for the ~4 rows that may already be covered by
shipped work (Design §7). · `docs/state/decisions-and-forks.md` — the live board; Forks A/B
land here on lock.

### 1. The "~22" is arithmetic, not a curated list — state it plainly

The lift-sweep report's executive summary flags **37 raw "high-value" candidates** across the
six repos (per-repo raw: telesis 10 · gridwork 8 · gridworkdigital 4 · throughframe 6 · glossread
7 · tm-watch 2 = 37; 9 downgraded on second pass). Its own **Top-15 highest-value lifts** table
accounts for 15 of the 37 (two of which — alerting #1, retention-runner #3 — are the NEW-PKGs
ADR-0135 already locked + built). **37 − 15 = 22.** That subtraction is almost certainly the
literal origin of ADR-0210 §4's "~22" — **not** a separately hand-curated 22-item list. This SPEC
does not pretend an official 22-row list ever existed; it makes the _enumeration below_
authoritative. (The ADR text at Task 4 must carry the same caveat so no future reader assumes a
curated 22-row list existed.)

### 2. The enumeration totals 67 rows — reconcile against "~22" (→ Fork A)

Transcribing every non-top-15, non-NEW-PKG row from the report's category tables yields **67
distinct candidates** (plus 4 explicit negative-evidence rows that are _not_ candidates). The gap
vs "~22" is because the published report documents **corrections, confirmations, and
doc-note-only observations beyond the 37 raw flags** — the "~22" counted only the raw
high-value flags minus the top-15. Both readings are legitimate; the operator picks the
disposition scope in **Fork A** (§8). This SPEC enumerates all 67 (the thorough reading) so
nothing is silently dropped — which is exactly what ADR-0210 §4 promised. **This document is
therefore already written to Fork A / Option 1** — see the honest cost of re-scoping to Option
2 in §8.

### 3. Disposition split (derived from the per-row table, §4)

Three dispositions, counted directly off the table below (the table is the source of truth; the
counts derive from it):

- **`build-next` — 19 rows.** XS/S size, high-or-medium value, no competing live priority, closes
  a real named gap. Roster: **#1, #2, #8, #9, #10, #18, #25, #27, #28, #38, #40, #44, #46, #50,
  #51, #54, #56, #57, #59.**
- **`build-on-trigger` — 28 rows.** Valuable but gated on a feature/customer/compliance trigger
  that has not fired; each row names its trigger condition. Left exactly where ADR-0210 §4 left
  them: parked, revisit on trigger.
- **`drop-with-reason` — 20 rows.** Doc-note-only (fold into a checklist/playbook line, not a
  package), confirmed superseded by existing caisson design, or redundant with already-shipped
  work.

_(19 + 28 + 20 = 67. The "17 / ~33 / ~17" split in the source research notes was an approximate
summary; the authoritative counts are recomputed here off the per-row dispositions.)_

### 4. The full candidate table

Format per row: **# · candidate (what it is) · source repo · path · size · value · disposition +
one-line reason.** Grouped by target package. Size = XS/S/M/L; value = low/medium/high.

#### `@caisson/rls` (tenancy-rls) — additional Source-C deltas atop the shipped Wardfile lift

| #   | Candidate                                                                                          | Source · path                                                   | Size | Value  | Disposition                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 404-not-403 existence-leak guard + FORCE-RLS `pg_class` introspection test                         | gridwork · `apps/hq/src/lib/tenant.ts`                          | S    | medium | **build-next** — cheap, closes a real existence-leak class, additive to shipped tenancy-rls                                                                                                         |
| 2   | pgbouncer `NULLIF`-empty-string GUC gotcha check (verify caisson already guards it)                | gridworkdigital · `packages/db/src/with-tenant.ts`              | XS   | medium | **build-next** — verification task (maybe 1-line fix), do first: a potential live bug                                                                                                               |
| 3   | RLS fail-closed conformance test harness (9-assertion suite)                                       | gridworkdigital · `apps/backend/tests/rls-isolation.test.ts`    | M    | medium | **drop** — superseded by caisson's own `checkRlsEquivalence` (standards-gate), locked under ADR-0210's tenancy-rls SPEC #7 + recorded at `harvest-program.md` §Source C #7; internal reference only |
| 4   | Ephemeral per-test-run Postgres-branch lifecycle helper (crash-safe teardown)                      | telesis · `packages/db/src/__tests__/_neon_branch_lifecycle.ts` | S    | high   | **build-on-trigger** — adopt if/when caisson moves to branch-per-test-run DB CI and shared-DB test flake appears                                                                                    |
| 5   | "The wall" — build-enforced import/string CI leak-guard                                            | glossread · `packages/db/src/internal.ts`                       | XS   | medium | **build-on-trigger** — ship as a CI-leak-guard convention note if a package needs a hard single-tenant / no-import boundary                                                                         |
| 6   | Three-layer access model: RLS + static-RBAC matrix + entitlement-gate (404-not-403 feature hiding) | gridworkdigital · `permissions.ts`/`entitlement.ts`             | S    | medium | **build-on-trigger** — clean-lift drop-in, worth it only alongside a broader RBAC hardening pass                                                                                                    |
| 7   | Tenant `ContextVar` capture/restore across async-generator await boundaries                        | gridwork · `sse_context.py`                                     | S    | medium | **drop** — report flags it was never wired to prod in its source repo (self-tested only); low-confidence lift                                                                                       |

#### audit-worm / soc2-hipaa evidence

| #   | Candidate                                                                                           | Source · path                                               | Size            | Value  | Disposition                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8   | Sentry PHI/secret scrubber (TS snake+camelCase key matcher / Python denylist)                       | telesis · `sentry-scrub.ts`/`sentry.py`                     | S               | high   | **build-next** — closes a real SOC2/HIPAA evidence gap (proving the error tracker doesn't leak regulated data); no equivalent today                                                        |
| 9   | Policy-to-code ADR traceability idiom (numbered-ADR-in-docstring + `policy_version` on golden rows) | telesis · `verdict_guard.py`, `007-evidence-tier-policy.md` | XS (convention) | high   | **build-next** — near-zero cost, exactly what a SOC2/HIPAA auditor asks; adopt as a control-traceability template                                                                          |
| 10  | Canonical-JSON + SHA-256 content hash (frozen-claim integrity, ~10 lines)                           | glossread · `content-hash.ts`                               | XS              | high   | **build-next** — feeds directly into audit-chain's existing hash-link builder; pure upside                                                                                                 |
| 11  | No-look-ahead bitemporal `VintageReader` ("what did we know as of X")                               | glossread · `vintage.ts`                                    | S               | medium | **build-on-trigger** — for point-in-time compliance evidence trails; no current consumer                                                                                                   |
| 12  | Rare-event retention mechanic + insurance-backstop retention lever (doc lesson)                     | tm-watch · `comp-intel-heartbeat.md`                        | doc-only        | medium | **drop** — fold as a one-paragraph note into audit-worm/compliance digest UX guidance                                                                                                      |
| 13  | Cost poller as SOC2 CC7.2 continuous-monitoring-control template                                    | gridwork · `cost_poller.py`/`cron_checker.py`               | S               | medium | **build-on-trigger** — formalize as a reusable threshold-monitor base only when a 2nd monitoring use-case needs it (report notes the shape was already re-implemented twice — a dup smell) |
| 14  | Postgres least-privilege GRANT/REVOKE for append-only logs                                          | glossread                                                   | XS              | low    | **drop** — 5 lines of standard GRANT/REVOKE boilerplate; doc reminder only                                                                                                                 |
| 15  | Fail-closed SHACL validation gate (RDF-specific)                                                    | throughframe                                                | n/a             | low    | **drop** — RDF-specific; caisson's fail-closed-RLS already embodies the pattern more maturely                                                                                              |
| 16  | Staged-graph promotion w/ bounded content-free reject records                                       | throughframe                                                | n/a             | low    | **drop** — caisson's `evidence/generate.ts`+`pack-format.ts` confirmed stricter/superior in the report                                                                                     |

#### field-crypto (existing per ADR-0210 — deltas only)

| #   | Candidate                                                                                       | Source · path                           | Size | Value  | Disposition                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Edge-runtime + cross-language (TS Web Crypto / Python `cryptography`) bit-exact interop CI test | telesis · `field-crypto.ts`/`crypto.py` | S    | medium | **build-on-trigger** — only if a polyglot (non-TS) field-crypto consumer appears                                                    |
| 18  | Versioned-KDF-prefix key-rotation-without-remigration idiom                                     | gridwork · `secrets.ts`                 | S    | medium | **build-next** — cheap, directly strengthens field-crypto's rotation story (a gap the report flags even where caisson leads on KMS) |

#### ai-meter (report confirms caisson already ahead — mostly confirmatory)

| #   | Candidate                                                         | Source · path                                      | Size     | Value                      | Disposition                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------- | -------------------------------------------------- | -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 19  | Two-phase reserve/reconcile ledger w/ fallback-on-trip classifier | telesis · `ledger.py`                              | n/a      | high (confirm-vs-existing) | **drop** — report's own "where caisson is ahead" section confirms ai-meter is structurally superior (persistent, RLS-scoped, fail-closed Postgres breaker vs in-process float ledger). No action |
| 20  | Per-tenant LiteLLM spend-cap + credits webhook                    | gridwork · `budget_manager.py`/`credits_client.py` | S        | medium                     | **drop** — the durable half is billing/credits (#50/#51); the in-process budget-counter is a documented anti-pattern (breaks under >1 running machine)                                           |
| 21  | Severity-as-routing-gate cost-explosion postmortem (doc lesson)   | throughframe · `route.py`                          | doc-only | low                        | **drop** — fold as a one-line caution into the ai-meter routing-review checklist                                                                                                                 |
| 22  | Zero-marginal-cost ingestion shape (doc lesson)                   | tm-watch                                           | doc-only | low                        | **drop** — one-line add to ai-meter's spend-cap checklist ("flag any cron re-touching unchanged rows")                                                                                           |

#### ai-evals

| #   | Candidate                                                                                          | Source · path                 | Size     | Value  | Disposition                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | BYOK-aware observability tracing wrapper (opt-in construction + NoOp fallback + per-tenant creds)  | gridwork · `observability.py` | S        | medium | **build-on-trigger** — revisit alongside a BYOK-tracing feature request; no current pull                                                                                                                                                                      |
| 24  | Sample-size/confidence-gated publish decision (`contentGate`)                                      | glossread · `gate.ts`         | S        | medium | **build-on-trigger** — a generic evidence-sufficiency gate; valuable only if caisson ever auto-promotes prompt/model changes (no such flow today)                                                                                                             |
| 25  | Backtest-via-live-code-path replay harness (swappable point-in-time reader, zero replay branching) | glossread · `backfill-one.ts` | M        | high   | **build-next** — guarantees backtest can't diverge from live behavior ("generation+scoring must accept explicit `decisionTime`, never read `Date.now()`"); closes a testing-discipline gap ai-evals lacks                                                     |
| 26  | Regulator-determination ground truth as eval substrate (doc idea + caution)                        | tm-watch                      | doc-only | low    | **drop** — the source's own finding is a caution (3-6mo build, selection-bias risk); gotcha note, not a build                                                                                                                                                 |
| 27  | Evidence-gated claims / honest claim-ceiling release gate (3-tier claim ladder)                    | tm-watch                      | M        | high   | **build-next** — rebuild as a generic `{metric,threshold,baseline,margin}→tier→allowed-claim-strings` primitive, consumed by guardrails at copy-review time; stops marketing/AI copy outrunning eval evidence (useful for Caisson's own site-copy governance) |

#### guardrails

| #   | Candidate                                                                                                                    | Source · path               | Size           | Value  | Disposition                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Regulatory-exemption→output-constraint posture playbook (legal-test-element→LLM-output-rule worksheet + human sign-off gate) | glossread                   | S (mostly doc) | high   | **build-next** — cheap (structured worksheet + a new SHIP-gate type); generalizes to HIPAA-marketing / FINRA / FTC-endorsement rules; directly useful to Compliance-edition positioning |
| 29  | Third-party content-minimization guard (span-align + per-doc word-budget cap + robots.txt/TDM-honoring fetch)                | throughframe · `acquire.py` | M              | medium | **build-on-trigger** — a genuine gap, but only pays off once Caisson ships a RAG/research-agent that ingests external docs (none shipped yet)                                           |
| 30  | Layered label-taxonomy w/ active/scaffolded layers + closed-vocabulary validator                                             | throughframe · `frames.py`  | S              | medium | **build-on-trigger** — generic closed-vocabulary guardrail; no current classification-output feature needs it                                                                           |
| 31  | Signal-fusion-as-gate architecture lesson (hard-gate vs weighted-blend, doc)                                                 | tm-watch                    | doc-only       | medium | **drop** — design-review checklist note for any future risk-scoring pipeline; not a package                                                                                             |
| 32  | Discovery-not-judgment wording boundary (forbidden-phrase linter)                                                            | tm-watch                    | n/a            | low    | **drop** — near table-stakes for what guardrails already does; audit existing coverage, don't rebuild                                                                                   |
| 33  | Upstream-schema parser isolation / anti-corruption layer (described, not built)                                              | tm-watch                    | n/a            | low    | **drop** — retargeted by the report to generic ingestion/jobs; the "never silently drop" sub-clause is already covered by jobs' dead-letter conventions                                 |

#### prompt-registry

| #   | Candidate                                                                  | Source · path                       | Size | Value  | Disposition                                                                                                                                                             |
| --- | -------------------------------------------------------------------------- | ----------------------------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34  | Content-hash prompt versioning store (`SHA256[:8]` dedupe by content-hash) | gridwork · `prompt_version.py`      | XS   | medium | **build-on-trigger** — minimal seed (no diff/approval/rollback); useful as a primitive inside a real registry upgrade, not standalone                                   |
| 35  | Provenance stamp + content-addressed IRIs (per-claim metadata shape)       | throughframe · `provenance.py`      | XS   | medium | **drop** — caisson's `audit-chain.ts` is a peer-or-better primitive; only the metadata SHAPE (confidence/evidenceSpan/alternatives) is non-dup, not worth a build alone |
| 36  | `BasePlugin` template-method contract + fail-fast static registry          | glossread · `base.ts`/`registry.ts` | XS   | low    | **drop** — generic shape, no concrete current need                                                                                                                      |
| 37  | `PayloadSchemaRegistry` (typed per-type Zod registry)                      | glossread · `schema-registry.ts`    | XS   | low    | **drop** — portable shape but trivial/low-value standalone                                                                                                              |

#### ai-kit

| #   | Candidate                                                                                      | Source · path                    | Size          | Value  | Disposition                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------- | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 38  | `gen<T>` structured-output-or-throw wrapper (refusal-as-typed-error, null-parse guard)         | glossread · `readgen.ts`         | XS (19 lines) | high   | **build-next** — should become ai-kit's canonical `structuredGenerate<T>()` default path; removes a whole "agent silently did nothing" bug class |
| 39  | Reconnecting SSE store factory (framework-agnostic, full-jitter backoff, Last-Event-ID resume) | gridwork · `create-sse-store.ts` | S             | medium | **build-on-trigger** — zero coupling, drop-in for any streaming AI-output UI; build when a caisson surface actually streams AI output live       |

#### agent-kernel (existing per ADR-0210 — deltas)

| #   | Candidate                                                                                                           | Source · path                   | Size | Value  | Disposition                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 40  | Secret-redacting structured JSONL event logger (regex-alternation redact before write)                              | telesis · `logs.py`             | XS   | medium | **build-next** — pure, dependency-free, trivially portable; good default redaction pass before the agent-kernel audit trail hits WORM                                                      |
| 41  | Concurrency leaf-acquisition + per-resource budget-wall (semaphore only at the actual await, never across `gather`) | throughframe · `concurrency.py` | S    | medium | **build-on-trigger** — exactly what a governed kernel needs to bound concurrent tool calls without nested-fanout deadlock; build when agent-runner tool-exec concurrency becomes a problem |
| 42  | AFK-agent-readiness triage-label state machine (5-state)                                                            | tm-watch                        | XS   | medium | **build-on-trigger** — rebuild as a tracker-agnostic enum + Linear/GitHub label-sync adapter if/when Agentic-Dev customers want autonomy-gating via their own tracker                      |

#### auth

| #   | Candidate                                                                                       | Source · path                    | Size | Value  | Disposition                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------- | ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Cross-service JWT/JWKS auth bridge (pure-ASGI streaming-safe + org-mismatch tenant-spoof check) | gridwork · `auth.ts`/`tenant.py` | M    | high   | **build-on-trigger** — valuable, but only relevant if Caisson splits a frontend-session/backend-service boundary across languages/services; not the current architecture (better-auth single-surface per ADR-0015)         |
| 44  | Constant-time secret/admin verification wrapper (hash-both-sides-before-`timingSafeEqual`)      | telesis · `admin-auth.ts`        | XS   | medium | **build-next** — small, pure, directly reinforces `security.md`'s variable-length-secret-comparison rule; standardize this exact wrapper                                                                                   |
| 45  | Cross-service HMAC handoff signer/verifier (Edge-safe, ±60s skew)                               | telesis · `labs-handoff-hmac.ts` | XS   | medium | **build-on-trigger** — clean Edge-safe service-to-service primitive; no current cross-service handoff need                                                                                                                 |
| 46  | Operator allowlist gate (timing-safe digest compare, no early-return)                           | gridworkdigital · `operator.ts`  | XS   | low    | **build-next** — tiny, dependency-free, drop-in verbatim; cheap admin-surface hardening                                                                                                                                    |
| 47  | Single-use signed action token (mint/verify/consume via INSERT-PK-conflict-as-mutex)            | gridworkdigital · `ack.ts`       | XS   | low    | **build-on-trigger** — generic signed-single-use-link utility; build when a magic-link / one-click-action feature needs it                                                                                                 |
| 48  | Typed API client w/ structured `ApiError` + leak-safe serialization                             | telesis · `api-fetch.ts`         | S    | medium | **build-on-trigger** — report retargets this OUT of auth into a generic net/http-client util; caps error-body capture, prevents stack-trace leak into logs/Sentry; do alongside a future `fetchWithTimeout` hardening pass |
| 49  | Anti-spoofing client-IP extraction (rightmost-XFF) + rate limiter                               | gridwork · `rate-limit.ts`       | XS   | low    | **drop** — superseded by ADR-0204's already-shipped `X-Real-IP`-keyed trusted-header rate-limit (Strix remediation); redundant                                                                                             |

#### billing / credits

| #   | Candidate                                                                                           | Source · path            | Size | Value  | Disposition                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------ | ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 50  | Idempotent credits ledger (grant/consume/expire; UNIQUE-stripe-event-id + FOR UPDATE + drain-order) | gridwork · `credits.ts`  | M    | high   | **build-next** — directly strengthens Base billing/credits idempotency; concrete, well-specified                                                                     |
| 51  | Dual-layer Stripe webhook idempotency (outer event-table + per-side-effect suffixed keys)           | gridwork · `handlers.ts` | M    | high   | **build-next** — converges with #50; rebuild as `processEvent()`+`withIdempotentSideEffect()`; closes a real one-event-fans-into-many-writes gap                     |
| 52  | Idempotent Stripe webhook retry-safe claim (row-locked claim, reprocess-if-not-ok)                  | gridworkdigital          | XS   | low    | **drop** — textbook recipe, subsumed by #51's more complete dual-layer pattern                                                                                       |
| 53  | 3-strike dunning escalation forcing read-only state                                                 | gridwork · `dunning.ts`  | S    | medium | **build-on-trigger** — generic N-strike dunning state machine; build alongside a real dunning/collections feature, not speculative                                   |
| 54  | Read-only-mode mutation gate (`assertNotReadOnly`)                                                  | gridwork · `readonly.ts` | XS   | medium | **build-next** — tiny, composable, mirrors caisson's fail-closed-RLS philosophy; cheap defensive win                                                                 |
| 55  | Price-ID-to-plan mapping + lazy-getter-w/-descriptive-error idiom                                   | gridwork · `stripe.ts`   | XS   | low    | **build-on-trigger** — keep the lazy-getter idiom for the billing config loader when reworking it; skip the plan-mapping itself (pure repo-specific business config) |

#### jobs (composes with the shipped ADR-0211 consumer-side work)

| #   | Candidate                                                                                        | Source · path                           | Size           | Value  | Disposition                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 56  | APScheduler poller fleet w/ `max_instances=1` / `coalesce=True` default                          | gridwork · `runner.py`                  | XS (a default) | high   | **build-next** — trivial to apply as a Base:jobs safety default for every interval job; directly prevents overlapping-run stacking   |
| 57  | Race-free deduplicated notification queue via Postgres advisory xact lock                        | gridwork · `queries.py`                 | S              | high   | **build-next** — closes a real TOCTOU race a plain UNIQUE/SELECT-then-INSERT has; composes with jobs' shipped SKIP LOCKED (ADR-0211) |
| 58  | Independent sender loop draining the notification queue (producer/consumer split, bounded retry) | gridwork · `runner.py`                  | S              | medium | **build-on-trigger** — generic outbound-queue drain loop; build alongside #57 if jobs needs a dedicated notification-sender lane     |
| 59  | Cron/internal-worker bearer auth (constant-time, fail-closed)                                    | gridworkdigital · `verify-cron-auth.ts` | XS             | low    | **build-next** — 15-line drop-in; the same shape should gate every caisson background-job HTTP trigger; cheap universal hardening    |

#### Base — webhooks / rate-limit / email

| #   | Candidate                                                                                    | Source · path                             | Size | Value  | Disposition                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 60  | Redis Lua token-bucket rate limiter (atomic EVAL refill, needs pluggable trusted-header)     | telesis · `rate-limit.ts`                 | S    | medium | **build-on-trigger** — hardcodes a Vercel header (breaks on Fly/Railway); combine with #61 into one Base rate-limiting primitive; low urgency since ADR-0204 already shipped a trusted-IP-keyed limiter |
| 61  | Cross-machine rate limiter w/ transparent local fallback (Upstash REST INCR+EXPIRE)          | gridworkdigital · `redis.ts`              | S    | medium | **build-on-trigger** — converges with #60 into one Base primitive; low urgency given ADR-0204's coverage of the highest-risk surface                                                                    |
| 62  | Email deliverability circuit breaker (bounce/complaint auto-pause, rolling-30-day threshold) | gridworkdigital · `schema.ts`/`resend.ts` | S    | medium | **build-on-trigger** — generic sender-reputation protection; build when email volume/deliverability becomes a monitored concern                                                                         |

#### mcp-server (built per ADR-0210/0216 — a distinct delta)

| #   | Candidate                                                                                                        | Source · path              | Size | Value | Disposition                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ---- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 63  | FastMCP HTTP-service-to-MCP-tools wrapper/generator (thin `@mcp.tool()` httpx proxies, docstring-as-description) | gridwork · `mcp_server.py` | S    | high  | **build-on-trigger** — the only concrete FastMCP specimen in the survey; ADR-0216's manifest+ledger covers governance, this covers the _generator/template_ half; build if AI Production Kit wants a "wrap any HTTP service as an MCP tool" generator |

#### Base — ui

| #   | Candidate                                                                                                                                 | Source · path                                        | Size        | Value  | Disposition                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 64  | Generic human-in-the-loop review-queue UI kit (injectable API, keyboard-driven, optimistic-update-w/-rollback, separate audit-trail view) | telesis · `use-triage.ts` + 5 files                  | L (6 files) | high   | **build-on-trigger** — reusable by BOTH guardrails (flagged-output review) and soc2/hipaa evidence (audit-evidence review); genuinely high-value but the largest parked item; revisit once either edition ships a customer-facing review-queue feature |
| 65  | Ops dashboard live event feed + health/metric panels (reference layout; has a hardcoded-hex anti-pattern to avoid)                        | gridwork · 4 component files                         | M           | medium | **build-on-trigger** — useful reference for a soc2/hipaa evidence-viewer screen; rebuild with real design tokens if that screen gets scoped                                                                                                            |
| 66  | Ember calibration UI vocabulary (color+texture+glyph triple-encoded epistemic-status components, WCAG-driven)                             | throughframe · `CalibrationTag.tsx`/`Provenance.tsx` | M           | medium | **build-on-trigger** — strip the source tokens, keep the triple-encoding discipline for any surface showing AI-output confidence; no current surface needs it                                                                                          |

#### Skip / doc-note only

| #   | Candidate                | Source · path                | Size     | Value | Disposition                                                                                    |
| --- | ------------------------ | ---------------------------- | -------- | ----- | ---------------------------------------------------------------------------------------------- |
| 67  | Feature-flag-as-404 gate | telesis · `feature_flags.py` | doc-only | n/a   | **drop** — the report labels it a trivial one-line idiom, a documented convention not a module |

#### Appendix — confirmed negative-evidence / not-a-lift (NOT candidates; caisson already ahead)

- Cross-language ORM schema-parity detector — telesis — N/A (Bun/TS-only).
- Audit log as mutable KV-blob array — gridwork — negative evidence.
- Two independently-reinvented HKDF+AES crypto modules — gridwork — negative evidence (confirms
  field-crypto's unified design is correct).
- Profile-driven 3-layer design-token cascade — gridworkdigital — repo-specific-skip (only
  relevant for true white-labeling).

### 5. Evidence-preservation (part of this SPEC's own deliverable)

`caisson-lift-sweep-REPORT.md` currently sits one directory **above** the repo, un-versioned. On
lock, it is vendored into `outputs/research/` so the source rows travel with the ADRs that cite
them (Task 1) — the sharpest risk here (one `mv`/`rm` above the repo root loses the only
enumeration source), which is why Task 1 is a first-class deliverable of this SPEC, not an
afterthought. This is a recommended action, not a fork — the operator may override the target
path.

### 6. Leaner alternative (acknowledged — the shortest path)

The **cheapest** path that still closes the evidence-drift risk is **Task 1 + a one-line
repoint, skipping the 67-row in-SPEC transcription (§4) and Task 2's exact-count verify
entirely**: vendor the report in (Task 1), then point `harvest-program.md` §Residuals straight
at `outputs/research/caisson-lift-sweep-REPORT.md`. The report already lists the rows; re-typing
them into a house-format table is duplication.

**Why the fuller version is still recommended:** the report carries the candidates as prose /
category tables with _no per-row disposition and no ranking_. This SPEC's whole added value is
exactly the `build-next` / `build-on-trigger` / `drop-with-reason` ranking in §3–§4 that the
report lacks — a lockable decision surface, not a re-listing. The leaner path preserves the
evidence but leaves the bucket _un-dispositioned_, so ADR-0210 §4's actual promise ("recorded so
the bucket is dispositioned") goes unmet. Take the leaner path only if the operator wants
evidence-durability now and defers the ranking; otherwise the full enumeration is the
recommended deliverable.

### 7. Pre-lock cross-check — rows that may already be covered by shipped work

A few rows may already be covered by shipped work: **#49** (IP+rate-limit) is almost certainly
redundant with ADR-0204's Strix remediation (already reflected as `drop` in the table);
**#52 / #55** may be covered by the "billing built/verified" language; **#60 / #61** overlap
ADR-0204. **Required pre-lock step:** cross-check these five rows against `docs/build-state.md`
and downgrade any that shipped to `drop (superseded)` before the ADR (Task 4) is filed. None is
scheduled as `build-next` on top of shipped work.

### 8. Operator forks (options + recommendation; NOT decided here)

Per the caisson one-operator rule, these are presented, not resolved. Under an armed unattended
goal, take the **Recommended** option or defer — never silently lock a higher-risk path. Both
forks land on `docs/state/decisions-and-forks.md` on lock.

#### Fork A — disposition scope

- **Option 1 — enumerate ALL 67 report rows.** _(Recommended.)_ Nothing is silently dropped —
  fulfills ADR-0210 §4's explicit promise; the actionable core is the 19 build-next + 28
  build-on-trigger, the 20 drops are the doc-note/superseded tail. **This document already IS
  Option 1** (§2, §4) — marginal cost of picking it is **zero**.
- **Option 2 — cover only the ~22 substantive still-viable candidates.** Matches ADR-0210's
  stated number; leaves the doc-note-only and negative-evidence rows uncatalogued. **This is NOT
  a costless pick from here:** the §4 table, the 19/28/20 split (§3), and Task 2's `= 67`
  row-count verify are all built to Option 1. Electing Option 2 means re-scoping the table down
  to ~22, recomputing the disposition split, and rewriting Task 2's verify — a **rewrite, not a
  trim** — and it re-opens the "silently dropped" gap §4 was written to close. Pick it only as a
  deliberate re-scope, eyes open on the rework.

  _Recommendation: Option 1 — completeness is the entire point of a "dispositioned, not dropped"
  bucket, it is already written, and Option 2 costs a rewrite while giving back less._

#### Fork B — act on `build-next` now, or stay parked

- **Option 1 — lock disposition document-only; keep everything parked.** _(Recommended.)_ Run
  Tasks 1–4 only; leave all 47 viable items (19 build-next + 28 build-on-trigger) exactly where
  ADR-0210 §4 left them — parked, revisit on the next harvest-appetite window. The program was
  deliberately parked by program-ordering; no trigger has fired; the harvest program is otherwise
  terminal. Tradeoff: the 19 cheap wins wait. (Also the ponytail-correct default — don't build 19
  packages on spec.)
- **Option 2 — elect a full "wave-6a" build wave now** for all 19 build-next items (XS/S, high/
  medium value). Triggers Task 5 (19 per-package SPECs) + a new build ADR that **amends ADR-0210
  §4's "no per-package SPEC pending"** for the elected subset. Tradeoff: real build budget spent
  with no external trigger; 19 SPEC+PLAN+EXECUTE cycles.
- **Option 3 — elect a minimal "wave-6a" of the highest-value security/audit/billing subset only**
  (e.g. #8, #9, #10, #44, #50, #51, #54, #56, #57, #59 — the SOC2/HIPAA-evidence, secret-compare,
  and idempotency-ledger items). Same ADR-amendment requirement as Option 2, smaller footprint.
  Tradeoff: a middle path — real value on the compliance/billing seams this repo cares about,
  without committing to all 19.

  _Recommendation: Option 1 — lock the roadmap, don't spend build budget speculatively. If the
  operator wants motion, Option 3 is the tighter of the two build paths (it concentrates on the
  compliance-evidence + money-idempotency gaps that are genuinely named, not just cheap)._

  **Binding constraint on Options 2/3:** electing any build changes WHAT is harvested, so per
  `harvest-program.md` §Binding it **REQUIRES a superseding/amending ADR** for the elected subset
  — an edit to the tracking page alone is not enough. Every follow-up SPEC + build must honor
  ADR-0003 (editions compose base primitives, never fork them; a package never depends "up" on an
  edition) and re-declare its own audit-firing tags.

### 9. ADR interactions

- **ADR-0210 §4 — REALIZES (primary).** This SPEC fulfills §4's "dispositioned, not silently
  dropped; no per-package SPEC pending" promise by enumerating the parked bucket. Document-only;
  supersedes nothing. ADR-0210 is also the lock under which `checkRlsEquivalence` (row #3's
  superseder) actually lives — its tenancy-rls SPEC, item #7. **Electing a build (Fork B option
  2/3) REQUIRES a new ADR** amending §4's "no per-package SPEC pending" for the elected items.
- **ADR-0133 — EXTENDS / operates under.** The document-only, spec-gated harvest initiative; this
  SPEC is the document, and no code lands without a per-package SPEC lock (the ADR-0133 gate).
  Source A/B are terminal — this residual draws only from Source C.
- **ADR-0135 — CITES.** The 2 built NEW-PKGs (alerting #1, retention-runner #3) that the `37 − 15`
  arithmetic excludes from the 22; not touched.
- **ADR-0134 — CITES (umbrella only).** The cross-domain audit/validate harvest initiative.
  **ADR-0134 does NOT itself document `checkRlsEquivalence`** (grep confirms zero hits) — row #3
  is dropped against that harness, but its source is the tracking page
  `docs/state/harvest-program.md` §Source C #7 ("RLS codegen-equivalence harness → built —
  `checkRlsEquivalence` in standards-gate + 7-table overrides ledger") and the harness's actual
  definition in ADR-0210's tenancy-rls SPEC — NOT ADR-0134. 0134 is only the umbrella initiative
  the shipped harness partly answers; do not cite it as the harness's documentation.
- **ADR-0204 — CITES / relies on.** The Strix rate-limit remediation (`X-Real-IP`-keyed
  trusted-header limiter) makes #49 redundant (dropped) and #60/#61 low-urgency (build-on-trigger).
- **ADR-0211 — CITES.** The shipped jobs consumer-side SKIP LOCKED work; #57 (advisory-lock dedup
  queue) composes with it if built.
- **ADR-0217 — CITES.** ai-meter MinHash dedup + "core confirmed strictly ahead"; grounds the
  #19/#20 drops.
- **ADR-0007 — EXTENDS (only if #50/#51/#54 build).** Integer-money ledger discipline the
  credits-idempotency items would extend.
- **ADR-0015 — CITES.** The single-surface better-auth lock; #43 (cross-service JWT bridge) is
  build-on-trigger precisely because the current architecture has no cross-language service split.
- **ADR-0197 / ADR-0199 — CITES.** Per-tenant CMK + BYOK per-action allowlist; #23 (BYOK tracing
  wrapper) is build-on-trigger against a future BYOK-tracing feature.
- **ADR-0003 — BINDS any future build.** Editions compose base primitives, never fork them; no
  package depends "up" on an edition — a hard constraint on every build-next follow-up SPEC.
- **ADR-0006 — BINDS.** The disposition ADR (Task 4) is append-only; amend by a later superseding
  ADR, never edit in place.
- **ADR-0088 — BINDS.** The proposed disposition ADR number (~0218) must be verified against `main`
  before filing (this program has renumbered ADRs at merge three times).

## Tasks

None of these execute until the operator **locks this disposition SPEC**. Tasks 1–4 are the
document-only work that lands on lock (or the leaner Task-1+3 variant, §6); Task 5 is
**fork-gated** (runs only if Fork B resolves to "build now"). Sized for bounded execution.

1. **Vendor the source evidence into the repo.** Copy
   `/home/gw/lab/caisson-lift-sweep-REPORT.md` → `outputs/research/caisson-lift-sweep-REPORT.md`
   (its first durable in-repo home). Verify:
   `test -f outputs/research/caisson-lift-sweep-REPORT.md && git status --porcelain outputs/research/caisson-lift-sweep-REPORT.md`.

2. **Land this SPEC as the durable enumeration.** _(Full/Option-1 path — the leaner alternative
   §6 skips this task.)_ Place at `outputs/specs/wave6-harvest-disposition/SPEC.md` with the full
   67-row table (this document). Verify (row count):
   `grep -cE '^\| [0-9]+ \|' outputs/specs/wave6-harvest-disposition/SPEC.md` returns `67`.

3. **Repoint `harvest-program.md` §Residuals.** Replace the bare "~22 → PARKED, no per-package
   SPEC pending" line (currently `docs/state/harvest-program.md:229-230`) with a pointer to this
   disposition SPEC + the derived **19 build-next / 28 build-on-trigger / 20 drop** split (full
   path), or — under the leaner alternative (§6) — straight at the vendored
   `outputs/research/caisson-lift-sweep-REPORT.md`. Do not touch the ADRs (per the page's own
   Binding rule: the tracking page follows, the ADRs lead). Verify:
   `grep -n "wave6-harvest-disposition\|caisson-lift-sweep-REPORT" docs/state/harvest-program.md`.

4. **Lock the disposition as an ADR (operator-gated, document-only).** File
   `knowledge/decisions/ADR-<NNNN>-wave6-harvest-disposition.md` recording the enumerated split +
   the 19-item `build-next` roster + the two fork resolutions + the "~22 is `37 − 15` arithmetic,
   not a curated list" caveat (Design §1); append them to `docs/state/decisions-and-forks.md` and
   add the row to `docs/adr-index.md`. **Number:** next free after the 0217 ceiling (~0218) —
   `grep -rl "^# ADR-0218" knowledge/decisions/` on `main` FIRST per ADR-0088 (this session's
   ceiling may be stale by merge time). Supersedes nothing; realizes ADR-0210 §4. Verify:
   `test -f knowledge/decisions/ADR-*-wave6-harvest-disposition.md && grep -n "wave6-harvest-disposition" docs/adr-index.md`.

5. **(Fork-gated — only if Fork B = "build now.")** For each `build-next` item the operator
   green-lights, author one house-format per-package SPEC under `outputs/specs/wave6a/` (one SPEC
   per package, spec-gated per ADR-0133 — never batch 19 into one). This task does **not** run
   under Fork B option 1. Verify: `ls outputs/specs/wave6a/*.md` matches the elected roster.

## Verify (goal-backward)

Re-ask the Goal — _did we turn ADR-0210 §4's bare count into a durable, lockable, evidence-backed
disposition without authorizing any build?_

- **Enumeration is durable + in-repo.** After Tasks 1–2 (full path), the 67 rows + their source
  paths live in version control (both the SPEC table and the vendored report); the wave-6 source
  no longer depends on a file outside the repo root. Check: both files tracked by git;
  row-count = 67. (Under the leaner §6 path: Task 1 alone makes the evidence durable, and the
  ranking is deferred — an explicit, operator-chosen tradeoff, not a silent gap.)
- **"~22" is honestly reconciled.** The SPEC states the `37 − 15 = 22` arithmetic origin and does
  not imply a pre-existing curated 22-item list; the 67 vs 22 gap is explained and surfaced as
  Fork A, not hidden — and Fork A honestly prices Option 2 as a rewrite, not a free re-scope.
- **Every row has a ranked disposition + reason.** 19 build-next / 28 build-on-trigger / 20 drop,
  summing to 67; each build-on-trigger names its trigger; each drop names why (doc-note /
  superseded / redundant-with-shipped).
- **No build authorized.** No product code lands from a lock; Task 5 is fork-gated and empty under
  the recommended fork. ADR-0133 spec-gate + ADR-0210 §4 precedent intact.
- **ADR-0210 §4 realized, not superseded.** The disposition ADR (Task 4) records the enumeration
  document-only; §4's "dispositioned, not silently dropped" promise is now backed by a list.
- **Shipped-work dispositions cross-checked.** The ~4 maybe-already-covered rows (#49, #52, #55,
  #60/#61) are reconciled against `docs/build-state.md` before lock (Design §7) — none is
  scheduled as build-next on top of shipped work.
- **Citations resolve.** Row #3's drop cites the tracking page (`harvest-program.md` §Source C #7)
  - ADR-0210's tenancy-rls SPEC, not ADR-0134; every other cited ADR/path resolves to a real
    artifact.

## Effort / Value

**Effort: XS** — document-only. Tasks 1–4 are copy-a-file + land-a-doc + repoint-one-line +
file-an-ADR (no build, no tests). The leaner path (§6) is XS-minus (Task 1 + the one-line
repoint, skipping the 67-row transcription and Task 2's count-verify). **Value: HIGH for the
cost** — retires the last open bucket in the otherwise-terminal harvest program and rescues the
only copy of the wave-6 source evidence from an un-versioned path one directory above the repo.
Fork-gated build effort (Fork B option 2/3) is separate and much larger — 19 (or a subset of)
SPEC+PLAN+EXECUTE cycles — and is **NOT** authorized by locking this SPEC.
