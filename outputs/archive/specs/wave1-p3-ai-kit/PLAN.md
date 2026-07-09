# PLAN — Wave 1 · P3: AI Production Kit

Act 2 (PLAN) for `outputs/specs/wave1-p3-ai-kit/SPEC.md`. Atomic tasks, one commit each. Each lists
the files it touches, its per-task verify, and routing (`agent_type` + `model`). Golden-fixture tasks
precede their logic task where ADR-0013 applies. Iterate to green before committing.

**Build order rationale:** base seams first (kernel `EventSink`/`GuardrailError`, credits ADR-0074
event types) unblock everything → the four base primitives are leaf-parallel (each depends only on
base) and run in **isolated worktrees** → the `@caisson/ai-kit` gateway composes all four (serializes
after them) → reference app + full green. **Critical path:** `T1/T2 base seams → T7+T8 ai-meter
(the heaviest, reserve/reconcile) → T13/T14 gateway → T18 reference app → T20 green.`

## Phase A — base seam extensions (down-only; land first)

### T1 — kernel: `EventSink` port + shared observability schemas · scope `kernel` (ADR-0075)

- Files: `packages/kernel/src/events.ts` (the `EventSink` port: `emit(event)`; default seam = a
  no-op/in-memory driver, OTel→Postgres backing documented), `packages/kernel/src/obs-schemas.ts`
  (Zod `.strict()` `usage-metering`, `eval-result`, `guardrail-block` event schemas — the P3-owned
  shared shapes; redaction applied at the sink, never per edition), `src/index.ts` exports, tests.
- Note: the evidence-pack schema (P2's) is NOT added here. If a cross-cutting session already landed
  `EventSink`, this task reduces to adding the three P3 schemas.
- Verify: `bun test packages/kernel/src/events.test.ts packages/kernel/src/obs-schemas.test.ts` green; `bun run gate` green.
- Routing: **opus** (main-thread — base contract every edition emits through; cross-cutting).

### T2 — kernel: `GuardrailError` (HTTP 422) · scope `kernel` (ADR-0063 amends ADR-0019)

- Files: `packages/kernel/src/errors.ts` (+`GuardrailError extends CaissonError`, code/status 422,
  redaction-safe envelope), `src/index.ts` export, `errors.test.ts` (+`toErrorResponse` shape).
- Verify: `bun test packages/kernel/src/errors.test.ts` green; `bun run gate` green.
- Routing: **gw-typescript-pro / sonnet** (bounded, ~30 LOC, clear spec).

### T3 — credits: ADR-0074 generic `feature_debit`/`feature_grant` + `feature` tag · scope `credits`

- Files: `packages/credits/src/credits.ts` (add `feature_debit` to `DEBIT_EVENT_TYPES`, `feature_grant`
  to `GRANT_EVENT_TYPES`; optional validated `feature` tag on inputs — Zod `.strict()`, no base-enum
  change per edition), `schema.ts` if a `feature` column is needed, `credits.integration.test.ts`
  (+ a `feature_grant` refund + `feature_debit` reserve path; idempotency preserved on the ADR-0024
  index). Integer-only; CHECK(amount<>0) intact (a zero-delta reconcile writes no row).
- Verify: `bun test packages/credits/src` green (PGlite); `bun run gate` green.
- Routing: **opus** (main-thread — touches the shared billing ledger contract; reserve/reconcile depends on it).

## Phase B — prompt-registry primitive (ADR-0061) · parallel-worktree after Phase A

### T4 — prompt render golden fixture (golden-before-logic, ADR-0013) · scope `ai-kit`

- Files: `packages/prompt-registry/src/__golden__/render.json` (fixed `{messages, vars}` →
  deterministic rendered message array; an injection-attempt var stays inert/escaped).
- Verify: fixture is valid JSON + deterministic (no clock/randomness); referenced by T5's test.
- Routing: **haiku** (fixture authoring).

### T5 — `@caisson/prompt-registry`: schema + versioning + addressing + templating · scope `ai-kit`

- Files: `packages/prompt-registry/src/schema.ts` (append-only `prompt_version` + mutable
  `prompt_alias` tables, FORCE-RLS via `buildTenantPolicySql`, numbered migration ADR-0014/0070),
  `src/registry.ts` (`supersedes_id` chain reusing `kernel/versioning.ts`; `name@version` resolve;
  `alias→version` get/set — promotion mutates only the pointer), `src/render.ts` (typed `.strict()`
  var schema + escaping interpolator, no raw untrusted interpolation), `src/index.ts`, tests +
  `render.test.ts` (matches T4 golden; injection var cannot escape its slot), `manifest.ts`,
  `package.json`, configs, `AGENTS.md`, `README.md`.
- Verify: `bun test packages/prompt-registry/src` green incl. golden (`BLESS` unset) + RLS integration;
  `bun run gate` + `bunx eslint packages/prompt-registry` green.
- Routing: **gw-typescript-pro / sonnet** (bounded; isolation: worktree). Depends on T1.

## Phase C — ai-meter primitive (ADR-0060) · parallel-worktree after Phase A

### T6 — price-book normalization golden fixture (golden-before-logic) · scope `ai-kit`

- Files: `packages/ai-meter/src/__golden__/cost.json` (fixed per-provider `usage` shape + price-book
  entry → fixed **integer** micro-USD + credit units; cache-token accounting per provider).
- Verify: valid JSON, deterministic; referenced by T8's test.
- Routing: **haiku**.

### T7 — `@caisson/ai-meter`: metering store schema + migrations · scope `ai-kit`

- Files: `packages/ai-meter/src/schema.ts` — append-only `usage_event` (tokens + `cost_micro_usd`
  integer, FK `prompt_version_id`), atomic `tenant_spend_window` counter, `spend_policy` (unit·scope·
  window·soft·hard), circuit-breaker state; all FORCE-RLS in numbered migrations (ADR-0014/0070).
- Verify: `bun test packages/ai-meter/src/schema.test.ts` (PGlite: tables + RLS policies apply) green.
- Routing: **gw-typescript-pro / sonnet** (bounded; isolation: worktree). Depends on T1, T3.

### T8 — `@caisson/ai-meter`: estimate→reserve→reconcile + price book + caps + breaker · scope `ai-kit`

- Files: `packages/ai-meter/src/estimate.ts` (heuristic chars/4 token estimate for the reserve),
  `src/pricebook.ts` (bundled versioned $/token, `forge.config`-overridable; integer micro-USD →
  integer credits, never floats), `src/meter.ts` (`reserve()` = `credits.debit` `feature_debit`
  pre-call atomic 402; `reconcile()` = `feature_grant` refund / `feature_debit` shortfall, idempotent
  keys `${callId}:reserve|:reconcile`; spend counter via atomic `UPDATE…RETURNING`), `src/breaker.ts`(soft warn / hard block; stored state checked **before every reserve**, open→402),`src/index.ts`,
`manifest.ts`+ configs +`AGENTS.md`, `meter.integration.test.ts`(PGlite +`withTenant`:
  reserve-before-call, 402 on short wallet writes nothing, reconcile trues up, retry settles once,
  hard cap trips breaker→402, matches T6 cost golden).
- Verify: `bun test packages/ai-meter/src` green incl. integration + golden (`BLESS` unset);
  `bun run gate` + `bunx eslint packages/ai-meter` green.
- Routing: **gw-typescript-pro / sonnet** (the heaviest primitive; isolation: worktree). Depends on T7.

## Phase D — guardrails primitive (ADR-0063) · parallel-worktree after Phase A

### T9 — `@caisson/guardrails`: `Moderator` port + PII engine + fail-closed + event emit · scope `ai-kit`

- Files: `packages/guardrails/src/moderator.ts` (`Moderator` port + a `local` regex driver + a
  test-doubled `provider` driver + `custom` hook; `forge.config` policy block, Zod `.strict()`),
  `src/pii.ts` (TS-native regex detector set email/SSN/CC-Luhn/phone + mask/hash/**reversible
  tokenize** via field-crypto `sealField`/`openField`; built fresh, no media-pipeline seed),
  `src/guard.ts` (input-moderate+PII-redact / output-moderate; **fail-closed** default + per-policy
  `failOpen`; cheap regex before model checks; throws `GuardrailError` 422; emits a `guardrail-block`
  event to the ADR-0075 `EventSink` on a typed bus — no edition up-import), `src/index.ts`,
  `manifest.ts` + configs + `AGENTS.md`, tests (`guard.test.ts`: moderator timeout→fail-closed block;
  `failOpen` honored only when set; `pii.test.ts`: tokenize→provider-placeholder→restore round-trip).
- Verify: `bun test packages/guardrails/src` green; `bun run gate` + `bunx eslint packages/guardrails` green.
- Routing: **gw-typescript-pro / sonnet** (bounded; isolation: worktree). Depends on T1, T2; consumes field-crypto.

## Phase E — eval harness + CI gate (ADR-0062) · after Phase B (binds prompt versions)

### T10 — eval baseline + dataset fixtures (the BLESS-style baseline before the gate) · scope `ai-kit`

- Files: `packages/ai-evals/__evals__/baseline.json` (committed score baseline), `__evals__/*.case.json`
  (input+expected, FK to a `prompt_version_id`), `__cassettes__/*.json` (recorded judge responses for
  CI replay — no live calls/secrets).
- Verify: valid JSON, deterministic; referenced by T11/T12.
- Routing: **haiku**.

### T11 — `@caisson/ai-evals`: harness + grader taxonomy + regression comparator · scope `ai-kit`

- Files: `packages/ai-evals/src/define-eval.ts` (`defineEval({data, task, scorers, threshold})` over
  `@caisson/testing` `matchGolden`), `src/graders.ts` (deterministic: exact/regex/JSON-shape/schema +
  model-graded via a `Judge` port; **injection as its own grader class** so a graded input can't
  loosen the rubric), `src/judge.ts` (`Judge` port + cassette record/replay driver = CI default;
  live driver injected locally — never imports the ai-kit edition, no up-dependency), `src/baseline.ts`
  (regression-vs-committed-baseline comparator + `bless` re-baseline path), `src/index.ts`, `manifest.ts`
  - configs + `AGENTS.md`, tests (cassette-replayed, deterministic; worse-than-baseline fails).
- Verify: `bun test packages/ai-evals/src` green (no network/secret); `bun run gate` + eslint green.
- Routing: **gw-typescript-pro / sonnet** (bounded; isolation: worktree). Depends on T5, T10.

### T12 — turbo `eval` task + monorepo CI job (NOT a buyer-repo required job) · scope `tooling`

- Files: `turbo.json` (+`eval` task), `package.json` (+`"eval"` script), `.github/workflows/ci.yml`
  (+ a monorepo-only `eval` job; comment cites ADR-0072 — never injected into a generated buyer repo).
- Verify: `bun run eval` green locally; CI yaml lint/parse clean.
- Routing: **gw-typescript-pro / sonnet** (bounded). Depends on T11.

## Phase F — the gateway (ADR-0059), composes B+C+D · serializes after the primitives

### T13 — provider-SDK boundary: confine `@ai-sdk/*` to `ai-kit` · scope `tooling` (ADR-0022 Gate-2)

- Files: `tooling/eslint-config/boundaries.js` (add `@ai-sdk/openai`/`-anthropic`/`-google`/`-openrouter`
  - the `ai` core to `PROVIDER_SDKS`; `PROVIDER_EXEMPT` already names `ai-config`|`ai-kit`),
    `tooling/standards-gate/src/checks.ts` (provider-reachability allow-set comment if needed). Record
    the Vercel AI SDK (Apache-2.0) dep intent.
- Verify: `bunx eslint .` green; `bun run gate` green; a deliberate base-package `@ai-sdk/*` import
  fails the lint (assert in a comment/test note).
- Routing: **gw-typescript-pro / sonnet** (bounded; gates T14's clean import).

### T14 — `@caisson/ai-kit`: the `infer()` gateway · scope `ai-kit` (ADR-0059)

- Files: `packages/ai-kit/src/gateway.ts` (`infer(lane, messages, opts)`; `createProviderRegistry`
  over `ai-config` lanes; `wrapLanguageModel` middleware; ordered pipeline
  `resolve→render→input-guard→cap/credit-check→provider call→record usage→output-guard→reconcile`;
  **async-iterable-capable signature, ship request/response first**; the backing model is **injected**
  — tests pass a mock `LanguageModelV2`, zero network), `src/index.ts`, `manifest.ts`
  (`kind:"edition"`, `editions:["ai-kit"]`, paid, dep `@caisson/{ai-meter,prompt-registry,guardrails,
ai-config,kernel,tenancy-rls,credits}` + `ai`/`@ai-sdk/*`), `package.json`, configs, `AGENTS.md`,
  `README.md`. Composes the four primitives; SDK hidden behind `infer()` (swappable).
- Verify: `bun test packages/ai-kit/src/gateway.test.ts` green; `bun run gate` (manifest↔package.json,
  down-only) + `bunx eslint packages/ai-kit` green.
- Routing: **opus** (main-thread — cross-package composition, context-bearing). Depends on T5, T8, T9, T13.

### T15 — gateway end-to-end integration test (mock provider) · scope `ai-kit`

- Files: `packages/ai-kit/src/gateway.integration.test.ts` (PGlite + `withTenant` + mock model:
  full pipeline reserve→call→reconcile; empty wallet→402 with no call; hard cap→breaker→402; guardrail
  block→`GuardrailError` 422; prompt resolved by `name@version`; render→usage→eval linkage recorded).
- Verify: `bun test packages/ai-kit/src/gateway.integration.test.ts` green (no network).
- Routing: **gw-typescript-pro / sonnet** (bounded test authoring). Depends on T14.

## Phase G — agent-assisted setup coach (ADR-0076 / P3-24) · after T14

### T16 — `@caisson/mcp-server`: coach tools (approval-gated, secrets-safe) · scope `mcp`

- Files: `packages/mcp-server/src/coach.ts` (register `inspect_env`/`propose_ai_config`/
  `write_forge_config`/`validate_setup` via the ADR-0076 tool-registration seam + per-tool entitlement;
  **approval-gated** writes; writes env-var **NAMES** + `.env.example`, **never secret values**, keys
  **never via agent tool args**; AI-provider lanes only — DB/deploy defer to P5; no shell), wire into
  `server.ts`, `coach.test.ts`, a static `AGENTS.md` fallback (coach-by-docs when no MCP agent).
- Verify: `bun test packages/mcp-server/src` green; `bun run gate` green. **Threats to model (T16):**
  a coach tool must never receive or echo a secret value; entitlement-gate each tool; timing-safe
  Bearer reused; no shell/subprocess — SHIP **security audit** target.
- Routing: **gw-typescript-pro / sonnet** (bounded; **security-tagged**; isolation: worktree). Depends on T14 (ai-config lane shape).

## Phase H — manifests, reference app, full green

### T17 — manifests + golden dirs + ledger backfill for all 5 new packages · scope `registry`

- Files: confirm `manifest.ts` + golden dirs for `ai-meter`/`prompt-registry`/`guardrails`/`ai-evals`
  (primitives) + `ai-kit` (edition) (template = `packages/field-crypto/manifest.ts`); `priceCents`
  **placeholders** pending the Pricing lock (paid⟹priceCents>0 is a hard refine — a number is
  mandatory to validate); add `registry/ledger.jsonl` rows (incremental backfill, ADR-0069) +
  rebuild `registry/index.json`.
- Verify: `bun run gate` green (all 5 manifests↔package.json agree, golden dirs present, down-only);
  `bun registry/scripts/build-index.ts && git diff --exit-code registry/index.json` (byte-identical).
- Routing: **gw-typescript-pro / sonnet** (bounded).

### T18 — `apps/ai-kit`: Next.js reference app (the P3 exit artifact) · scope `ai-kit` (ADR-0044)

- Files: `apps/ai-kit/*` (App Router): coach-configure a lane → resolve a prompt `name@version` →
  `infer()` through the gateway (mock/local backend) → meter reserve/reconcile → demonstrate a hard
  cap → 402 + a guardrail block; an eval passes in the `eval` task. Thin wiring shell only (no buyer
  dashboard — that is a later GTM wave). `apps/` is not a registry module (gate exempts it).
- Verify: `bun run build` (app builds); `bun test apps/ai-kit` green (wiring smoke, mock provider).
- Routing: **gw-typescript-pro / sonnet** (bounded Next.js wiring). Depends on T14, T16.

### T19 — provider/secrets threat-model doc inline + SECURITY targets · scope `ai-kit`

- Files: append the threat table to this surface's SWEEP/SECURITY scope (no new product code).
  **Threats to model (security/secrets/external-system):** TM1 runaway overspend (reserve-before-spend
  - breaker→402); TM2 provider-key leak (BYOK env-pointer; ai-config never reads the key; coach writes
    NAMES only); TM3 prompt-injection via untrusted render vars (typed `.strict()` + escaping boundary);
    TM4 PII egress to a provider (input-redact before egress; reversible-tokenize via field-crypto);
    TM5 fail-open moderator outage (fail-closed default; `failOpen` explicit-only); TM6 live provider
    call / secret in CI (model injected/mock; eval cassettes; `fetchWithTimeout` on any real outbound);
    TM7 cross-tenant usage/spend read (FORCE-RLS on every meter table); TM8 provider-SDK boundary escape
    (base package importing `@ai-sdk/*` fails the gate); TM9 eval-gate gamed (injection grader is its
    own class, can't loosen the rubric).
- Verify: SECURITY audit (SHIP) has concrete targets; no code change.
- Routing: **haiku** (doc).

### T20 — full-repo green + VERIFY / SWEEP / EVAL / SHIP · scope `ai-kit`

- Verify: `bun install` clean; `bun run check` green; `bun run gate` green; `bun run eval` green;
  `bun test` green repo-wide; all goldens matched `BLESS` unset; `bunx eslint .` + depcruise/down-only
  clean (provider-SDK confined to `ai-kit`); `git diff --exit-code registry/index.json` byte-identical.
  Then VERIFY (goal-backward vs SPEC exit gate) → SWEEP → EVAL (ai tag) → SHIP (REVIEW + SECURITY audit;
  PR open, CI green). **No DEPLOY.**
- Routing: **opus** (main-thread — goal-backward verify + ship orchestration).

## Dependency notes

- **Phase A (T1–T3) blocks everything** — the four primitives each import the extended base
  (`EventSink`, `GuardrailError`, generic credit event types). Land A first.
- **Parallel writers (isolated worktrees):** T5 (prompt-registry), T7+T8 (ai-meter), T9 (guardrails)
  have no cross-dependency and run concurrently after A. T11 (ai-evals) waits on T5 (prompt-version FK).
- **Serialization:** T14 (gateway) composes T5+T8+T9 and must follow them; T13 (boundary) precedes
  T14 so the `@ai-sdk/*` import lands clean. T16 (coach) + T18 (app) follow T14. T17 (manifests) can
  run once each package's `package.json`/deps are final; T20 is last.
- **Golden-before-logic (ADR-0013):** T4→T5 (render), T6→T8 (cost), T10→T11/T12 (eval baseline).
- **Every task:** TypeScript strict · Bun (never npm/yarn) · Zod `.strict()` at boundaries · integer
  credits · `crypto.randomUUID()` · `fetchWithTimeout` on every outbound fetch · `crypto.timingSafeEqual`
  for secret compares · fail-closed · no `any`/`console.log` · **no live cloud/model/network in CI
  (test-doubled)** · pro-private firewall (PUBLIC patterns only) · ships through `tooling/` (manifest +
  golden + down-only depcruise) · conventional atomic commit.
