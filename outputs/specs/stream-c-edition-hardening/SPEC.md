# SPEC — Stage-2 · Stream C: Edition + AI package hardening & drivers

Act 1 (SPEC) of the 7-act cycle for **Stream C** of the Stage-2 four-stream partition
(`docs/state/stage2-kickoff-triage.md` §"Stream C", tasks C1–C9). Local build only, off clean
`main`; branch `stream/edition-hardening`; reserved ADR range **0160–0169**. Bound by the locked ADRs
cited below (do not relitigate). Grounded in a 7-agent code-truth recon (`wf_c1fdfcb8-3a4`,
2026-07-01) — **not** the kickoff's paraphrase; where the two disagree, the recon (code on disk) wins.

## Goal

Harden the four editions' **already-merged-but-partial** surface and widen the AI seam: pay down the
edition act-trail debt, wire the built-but-un-invoked compliance primitives into a demonstrable proof,
close the one real tenant-isolation gap in `agent-dev`, and add the operator-requested inference and
transport drivers (Bedrock/Azure/Ollama; MCP Streamable-HTTP). WHY: the editions merged with real code
and tests but carry un-exercised seams and un-wired primitives (`docs/build-state.md` honest-gaps
#2/#3); this stream converts "the catalog/primitive exists" into "the edition demonstrably uses it,"
and each new driver widens which environment a buyer can run Caisson in without forking a locked port
(ADR-0003). VERIFY re-asks: **for each in-scope task, does the edition now demonstrably do the thing
the kickoff named — or was it already done, and is the doc trail now honest about it?**

## Reality check (READ FIRST — the kickoff overstates open work)

The recon proved most of Stream C is **already built and green on `main`/this branch**. The kickoff
was authored from the backlog's act-trail-debt notes, several of which are **stale** (their own
reconcile sweeps missed them). Disposition per task:

| Task   | Kickoff framing                                                 | Code truth (recon)                                                                                                                                                                                                             | Disposition                                                  |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **C1** | record P4a EVAL act + author phase SECURITY.md                  | **DONE** — `EVAL.md`(63L)+`SECURITY.md`(312L, PASS, 7/7 threats mitigated) exist, committed `ac052f3`, ancestor of HEAD                                                                                                        | **fold into C9 (doc)**                                       |
| **C2** | add streaming `infer()` + concurrency test + soft-cap warn test | **DONE** — `inferStream()`(`144a6b8`) + concurrency test(`2fc4e6d`) + soft-cap test(`5df5a9e`), merged `261d7ba`; suites green (8 ai-meter, 17 ai-kit)                                                                         | **done; optional test-hygiene only**                         |
| **C3** | HIPAA leg + EU-AI-Act high-risk controls + wire OSCAL export    | **catalogs DONE** — SOC2(18)+HIPAA(20)+EU-AI-Act(18) controls + OSCAL map all built, 122 tests green; EU-AI-Act "reserved slot" claim is **stale** (`e4aaf8a`). Un-invoked: HIPAA leg + OSCAL bundle call in `apps/compliance` | **BUILD (app-layer wiring)**                                 |
| **C4** | tenant RLS on agent memory + GA-promotion                       | agent memory persisted (`LocalStore`) but **not tenant-scoped**; the ADR-0073 file-per-tenant primitive exists + is re-exported, just not wired into `createAgentDevEdition`                                                   | **BUILD (small wire + guard)**                               |
| **C5** | Bedrock / Azure / Ollama inference drivers                      | provider selection = one config switch; no driver code yet; Ollama ≈ existing `local` case                                                                                                                                     | **BUILD + ADR-0160**                                         |
| **C6** | MCP Streamable-HTTP transport beside stdio                      | no HTTP binder; transport-agnostic core ready; SDK `1.29` ships `StreamableHTTPServerTransport`                                                                                                                                | **BUILD + ADR-0161**                                         |
| **C7** | decide+maybe build per-tenant encrypted BYOK                    | env-pointer BYOK today; field-crypto provides 100% of the storage/crypto primitive; the work is a per-tenant encrypted key store + a decrypt-at-resolution hook                                                                | **BUILD + ADR-0162** _(operator lock 2026-07-01: build now)_ |
| **C8** | live-test ONNX / hosted / rented seams                          | needs real AWS/Azure/hosted accounts; DEPLOY-class                                                                                                                                                                             | **OUT OF STREAM** _(operator lock 2026-07-01: defer)_        |
| **C9** | reconcile stale act-trail debt                                  | multiple stale backlog lines (C1, C2, C3-EU-AI-Act)                                                                                                                                                                            | **DOC**                                                      |

Net: of nine tasks, **two are already done** (C1, C2), **one is doc** (C9), **one is deferred out of
stream** (C8), and the real buildable set is **C3, C4, C5, C6, C7** (+ trivial C2 hygiene). That is the
honest scope after the 2026-07-01 fork locks.

## Tags

`security` (C4 tenant isolation; C6 network-reachable MCP + auth model; C7 encrypted key at rest) ·
`auth` (C6 Bearer over HTTP) · `secrets` (C7 per-tenant provider keys) · `ai` (C5 inference drivers) ·
`external-system` (C5 Bedrock/Azure — **dormant/env-gated**, no live CI call). Drives SHIP audits:
**SECURITY** (C4+C6+C7, the isolation / network-surface / secret-at-rest changes) · **EVAL** (C5 —
golden/construction-test substitute per the P4a precedent, no eval-runner dataset). Per the autonomy
line these risk tags re-enter the operator at SHIP; C6 in particular reopens the exact
network-reachable-MCP concern `stdio.ts` deferred for security reasons — treat its audit as blocking.

## Scope

**C3 — compliance leg wiring (`apps/compliance`, no package changes):**

- Add a HIPAA-framework evidence-pack leg beside the SOC2 leg — a second `EvidenceControlPlan[]` built
  against the already-built `hipaaSecurity` catalog, reusing the same 3 framework-agnostic collectors
  (chain-verify / worm-retention / rls-force); `controlPlan()` (`leg.ts:184-201`, today hardwired to
  `soc2Tsc.controls.find`) grows a framework parameter. Second `generateEvidencePack`+`signEvidencePack`;
  extend `LegResult`; new golden fixture; new `leg.test.ts` assertions.
- Wire OSCAL **export** (the T15 seam, _map_ not _push_): call the already-built+tested
  `toOscalBundle(pack.manifest, {now, packSha256})` (`oscal-export.ts:399`) from `leg.ts` after pack
  generation; surface the bundle on `LegResult`; assert shape/determinism. The live network push
  (`OscalExportTransport.deliver()`, `oscal-export.ts:427`) stays **P7, out of scope**.

**C4 — agent-dev tenant scoping (`packages/agent-dev`, ~30 LOC + 1 test):**

- Thread a fail-closed tenant identity through `AgentDevEditionOptions`/`createAgentDevEdition` so the
  edition itself opens its memory via the already-built `tenantDbPath`/`openTenantDb` (ADR-0073
  file-per-tenant floor, already re-exported through `agent-dev/index.ts:19`) and **cannot silently
  open an unscoped/shared store** — mirroring `withTenant`'s fail-closed throw on empty accountId. One
  new isolation test (2 tenants → 2 edition instances → cross-tenant read returns nothing). AGENTS.md/
  README tenancy note.
- **Do NOT** add `@caisson/tenancy-rls` (Postgres-only; SQLite has no roles/GUCs) or a `scope` column
  to `LocalStore` SQL (ADR-0073 explicitly rejected the shared-file-tenant_id-filter pattern).

**C5 — inference drivers (`ai-config` + `ai-kit`, ADR-0160):**

- Add Bedrock + Azure OpenAI provider cases at the single Gate-2 `providerFor()` switch
  (`ai-kit/providers.ts:20-39`) as `@ai-sdk/amazon-bedrock` / `@ai-sdk/azure` `ProviderV2` adapters;
  add the enum values in `ai-config/config.ts:11`. Ollama = an explicit `"ollama"` enum value that maps
  to the existing `createOpenAI({baseURL})` branch (OpenAI-compatible, no new SDK). Drivers are
  **env-gated/off-by-default**, inert until a lane names them + creds present — merging changes no
  runtime behavior. Construction-level unit tests only (live transport stays the un-exercised path, the
  package's own zero-live-call invariant / ADR-0064 convention).

**C6 — MCP Streamable-HTTP transport (`packages/mcp-server`, ADR-0161):**

- New `http.ts` binder beside `stdio.ts` (~150 LOC) using the SDK's `StreamableHTTPServerTransport`
  (already in `@modelcontextprotocol/sdk@^1.29.0`, no new dep) over plain `node:http`; reuses the
  transport-agnostic core (`createMcpServer`) and the ADR-0112 rate-limit hook verbatim — **zero edits
  to `server.ts`/`coach.ts`/`stdio.ts`**. New `http.test.ts` (~180 LOC): auth-gates-before-transport
  (401), session round-trip, two-Bearers-two-isolated-sessions, rate-limit + `isError` parity.

**C7 — per-tenant encrypted BYOK (`ai-config` + `ai-kit` + a new tenant-key store, ADR-0162)** _(operator lock: build)_:

- Add a per-tenant encrypted provider-key store reusing field-crypto verbatim: a `tenant_ai_credential`
  table via `encryptedColumn()` (`field-crypto/column.ts:108`) + FORCE-RLS policy (`buildTenantPolicySql`),
  mirroring the `PgWrappedKeyStore` append-only pattern (`store.pg.ts:108`). ~1 migration + ~1 store
  module.
- Add a BYOK-flagged lane mode to `ProviderConfigSchema` (a discriminator: env-pointer lane **or**
  per-tenant lane) and thread `accountId` through `ModelResolver`/`buildRegistryResolver` so
  `providerFor` resolves a per-tenant lane by opening `withTenant` → `openField` decrypt → build the SDK
  client, instead of reading `process.env`. Short-lived `(accountId,provider,keyVersion)` client cache
  (don't re-derive HKDF + rebuild an SDK client per call). **Metering/credits path is untouched** — BYOK
  changes only _where the key comes from_; whether a BYOK lane debits credits is a separate pricebook
  policy, explicitly out of scope (ADR-0162 §deferred).
- The tenant-facing key-submission surface (a coach/API endpoint to encrypt-on-write a tenant's key) is
  the P3-24-gated write half — **deferred**; C7 builds the store + read-side resolution + a
  test-injected write, not a buyer UI.

**C2 — optional hygiene (test-only, non-blocking):** a gateway-level soft-cap-doesn't-block assertion
(~20 LOC) + streaming output-guard/PII-restore branch tests (~60 LOC). The literal C2 ask is already
satisfied; include only if cheap.

**C9 — doc reconciliation (`docs/state/readiness-and-backlog.md`):** strike the stale act-trail-debt
bullets for **P4a** (`:236-237`, EVAL/SECURITY now exist — `ac052f3`), **P3 ai-kit** (`:238-239`,
streaming+tests now shipped — `261d7ba`), and the **EU-AI-Act "reserved slot"** language
(`:240-241` + `packages/compliance/README.md:27,33` + `AGENTS.md:27-28`, catalog authored — `e4aaf8a`),
using the file's existing strikethrough+`CLOSED`/`BUILT` convention. `docs/build-state.md` needs no
correctness edit (verified clean).

**Out of scope / firewall:** C8 live external-account seam testing (DEPLOY-class — operator-deferred) ·
the C7 buyer-facing key-submission UI (P3-24-gated write half) · whether a BYOK lane debits credits
(pricebook policy, not mechanism) · OSCAL live push (T15/P7) · the `agent-dev` Next.js inspector
(deferred, ADR-0082 §4) · a bundled local embedding model (would supersede ADR-0067's engine-neutral
non-goal — needs its own ADR) · any `media-pipeline` seed (pro-private firewall; harvest patterns from
PUBLIC `tessera` only) · **replacing** the built PG-atomic `ai-meter` metering with a harvested variant
(operator-locked reference-only) · DEPLOY.

## Three ADRs to author (range 0160–0169)

### ADR-0160 — AI inference driver expansion (Bedrock / Azure OpenAI / Ollama)

Authorizes the port-family expansion. Binding content: drivers plug in at the existing `providerFor()`
switch as `ProviderV2` adapters (Gate-2 single-SDK-import-site invariant intact); the driver contract
stays `LanguageModelV2` (no new Caisson port — extends ADR-0059, doesn't reopen it); all providers
off-by-default / config-opt-in (ADR-0011 "no provider hardcoded"). **The one real design decision the
ADR settles:** `ProviderConfig` has no home for Bedrock's `region` (+ AWS secret/session triple) or
Azure's `apiVersion`/deployment routing. Recommended resolution: add an **optional `region` +
`apiVersion` pair** to `ProviderConfigSchema`, keeping `apiKeyEnv`'s "names the env var, never reads the
value" BYOK contract (a sibling `apiSecretEnv` names Bedrock's secret-key env var). Ollama gets its own
enum value for config self-documentation (one line, maps to the `local` branch, no new switch case).
Follows the `field-crypto/kms.ts:228` "ship the port + doc comment, not the SDK until a buyer opts in"
precedent. Optional local-ai `RentedTransport` drivers (Surface B) noted as a follow-up, not required.

### ADR-0161 — MCP Streamable-HTTP remote transport

Authorizes an HTTP transport beside stdio (implements ADR-0008/0112, does not supersede). Binding
content: reuse the transport-agnostic core unchanged; `StreamableHTTPServerTransport` from the declared
SDK (no new dep); lock the new network attack surface (CORS `allowedOrigins`, DNS-rebinding protection,
TLS-terminated-by-host) as **binding, not deferred** — this is the surface `stdio.ts` deferred for
security reasons, now unblocked by the issuer/rate-limit/entitlement builds (ADR-0110/0112/0113). **The
one design decision the ADR settles — auth model:** (A) stateful session (mirror stdio: authenticate
once per `Mcp-Session-Id` session) vs (B) stateless per-request auth (`sessionIdGenerator: undefined`,
re-`authenticate()` every POST). Recommended **B** — matches ADR-0008's literal "every request
re-validates the token in constant time" text, removes the whole session-map lifecycle/leak class, and
the timing-safe compare is cheap; choose A only if SSE-resumable long streams become a requirement.

### ADR-0162 — per-tenant encrypted BYOK (amends ADR-0011 for BYOK-flagged lanes)

Authorizes a per-tenant provider-key path beside the env-pointer default. Binding content: reuse
field-crypto verbatim for storage (a `tenant_ai_credential` table via `encryptedColumn()` + FORCE-RLS,
mirroring `PgWrappedKeyStore`) — no new crypto. `ProviderConfigSchema` grows a **discriminated lane
mode**: an env-pointer lane (today's contract, unchanged default) or a per-tenant lane; the ADR-0011
"ai-config never reads the key" invariant is **narrowed, not broken** — ai-config still never reads a
key value, it only carries the lane's mode; the decrypt happens at the `providerFor` edge inside
`withTenant`, exactly where the env read happens today. `ModelResolver`/`buildRegistryResolver` grow an
`accountId` parameter so per-tenant resolution is possible; a short-lived per-`(accountId,provider,
keyVersion)` client cache avoids re-deriving HKDF per call. **Metering/credits orthogonal:** BYOK
changes only key provenance; the reserve→reconcile→cap path is untouched. **Deferred (named):** the
buyer-facing encrypt-on-write key-submission surface (P3-24-gated); whether a BYOK lane debits credits
(a pricebook decision, not this mechanism).

## Forks → operator-locked (2026-07-01, BEFORE code)

Per the one-operator rule (`CLAUDE.md` — never auto-decide a fork). All three surfaced with rec +
confidence + evidence; **now locked**:

1. **C7 — per-tenant encrypted BYOK: build vs defer.** (rec was defer) → **LOCKED: BUILD.** The
   operator elected to build the mechanism now. In scope this stream via **ADR-0162**; the env-pointer
   lane stays the unchanged default, BYOK is additive. The buyer-facing key-submission UI + the
   credit-vs-BYOK pricebook question stay deferred (ADR-0162 §deferred).

2. **Harvest AI-lifts: reference-only vs replace metering.** → **LOCKED: reference/pattern-only** (rec
   confirmed). Caisson's shipped PG-atomic `ai-meter` (ADR-0060) is NOT touched; gridwork-core cost-math
   is a pattern reference only. Guards against an ADR-0002 regression for zero capability gain;
   pro-private firewall (PUBLIC `tessera` patterns only) binds regardless.

3. **C8 — external-account seam spend: now vs defer.** → **LOCKED: DEFER (out of stream)** (rec
   confirmed). C5 drivers ship inert/env-gated; live-testing Bedrock/Azure/hosted/ONNX is a separate
   operator-sequenced DEPLOY act, not local-build work.

## Verify commands

- `bun run check` (turbo build·lint·test + standards gate; `--concurrency=50%` for the PGlite fan-out).
- `bun run gate` (standards-gate: license split + open↔commercial no-depend-up + ADR-0002 invariants).
- Per-package during EXECUTE: `bun test packages/compliance apps/compliance` (C3),
  `bun test packages/agent-dev` (C4), `bun test packages/ai-kit packages/ai-config` (C5),
  `bun test packages/mcp-server` (C6).
- Goal-backward (VERIFY): C3 → a HIPAA evidence pack + an OSCAL bundle are generated + asserted in the
  reference app; C4 → two tenants cannot read each other's agent memory (test); C5 → `providerFor`
  returns the right adapter per new enum, all env-gated; C6 → HTTP transport auth-gates before build +
  serves two isolated Bearer sessions.

## Non-goals restated

No live model/network/provider call in CI (every driver's live path is the deliberately un-exercised
seam). No deploy. No edition-vs-package refactor (editions stay compositions, ADR-0003). No new ADR for
C3/C4/C9 — C3/C4 implement existing locks (ADR-0056-0058 / ADR-0073), C9 is doc. Three new ADRs:
**0160** (C5 drivers), **0161** (C6 MCP HTTP), **0162** (C7 BYOK, amends ADR-0011).
