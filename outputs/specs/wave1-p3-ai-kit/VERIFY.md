# VERIFY — Wave 1 · P3: AI Production Kit (goal-backward)

Act 4. Re-asks the SPEC's stated goal against the merged diff + tests — not a task checklist. Merged
green via PR#11; this closes the VERIFY/SWEEP debt. Assessed by reading source + tests (CI already
green on main — `bun run check` / package tests not re-run per the dist-glob + turbo-contention gotcha).

## Goal restated

One metered-inference gateway (`infer()`) as the enforced chokepoint for every AI feature — token
metering with reserve→reconcile, hard spend caps + a runaway-loop breaker, a versioned injection-safe
prompt registry, fail-closed guardrails (moderation + PII), an eval gate vs a committed baseline, and
a setup coach — proving cost control + reproducible prompts + content safety + regression gating **by
construction**, all with a **test-doubled** provider (zero live model/network in CI).

## Did the code achieve the goal? — PARTIAL (pass-with-seams)

Every exit-gate criterion maps to a passing test against a test-doubled provider; the only
un-exercised paths are the live transports the SPEC deliberately stubbed (see Seams). PARTIAL — not
PASS — because those live transports are never exercised and two sub-claims are structural, not tested.

| Exit-gate claim                                                                                          | Evidence (read)                                                                                                                                                                         | Verdict       |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Metered `infer()` reserves BEFORE the call; reconciles to actual (refund/shortfall)                      | `meter.integration.test.ts:131,160`; `gateway.integration.test.ts:200`; `meter.ts:260` reserve / `:349` reconcile                                                                       | ✅            |
| Empty/short wallet → **402**, call never fires, nothing written                                          | `meter.integration.test.ts:178`; `gateway.integration.test.ts:278` (`doGenerateCalls`=0, no `usage_event`)                                                                              | ✅            |
| Same-`callId` retry settles **exactly once** (both legs idempotent)                                      | `meter.integration.test.ts:205,222`; `gateway.integration.test.ts:246`; `usage_event (account,call_id)` UNIQUE                                                                          | ✅            |
| Hard cap **trips the breaker** → next reserve 402; cost → **integer credits** (golden)                   | `meter.integration.test.ts:251`; `gateway.integration.test.ts:297`; `breaker.ts:53,63`; `pricebook.ts:87` BigInt + `__golden__/cost.json` (`pricebook.test.ts:41`)                      | ✅            |
| Atomic spend counter mutates only via `UPDATE…RETURNING`                                                 | `meter.ts:193` `bumpSpend` (INSERT…ON CONFLICT…RETURNING / negative-delta UPDATE)                                                                                                       | ⚠️ structural |
| Guardrail input/output **422 fail-closed** on moderator error/timeout; `failOpen` only when set          | `guard.test.ts:87,105,115,129`; `guard.ts:104` (deadline→block), `:58` metadata-only emit                                                                                               | ✅            |
| PII reversible-tokenize round-trips via field-crypto `sealField`/`openField`; cross-tenant can't restore | `pii.test.ts:85,110`; `pii.ts:159` tokenize / `:184` detokenize (`PII_COLUMN_CONTEXT` AAD)                                                                                              | ✅            |
| Guardrail block emits a typed `guardrail.blocked` event to the `EventSink` (no content)                  | `guard.test.ts:54`; `gateway.integration.test.ts:331`; `guard.ts:67` `guardrailBlockSchema.parse`                                                                                       | ✅            |
| Prompt resolves by `name@version`; alias swap changes the live prompt with **no code change**            | `registry.integration.test.ts:119,151`; `registry.ts:245` setAlias (pointer-only) / `:320` resolvePrompt                                                                                | ✅            |
| Versions append-only (no UPDATE/DELETE); untrusted render var **cannot escape its slot**                 | `registry.integration.test.ts:89`; `render.test.ts:36,47`; `render.ts:91` escapeValue (single-pass)                                                                                     | ✅            |
| Eval gate = regression-vs-committed-baseline, cassette-replayed (no secret/network)                      | `evals.test.ts:173,192`; `baseline.ts:81,178`; `judge.ts:63` cassette fail-closed-on-miss; injection grader its own class `graders.ts:136` (TM9)                                        | ✅            |
| Eval is a distinct turbo `eval` task, **absent** from a generated buyer's required CI (ADR-0072)         | `turbo.json:7`; `package.json:17`; `.github/workflows/ci.yml:70` (monorepo-only job, ADR-0072 comment `:66`); `eval.cli.ts`                                                             | ✅            |
| 5 packages green through `tooling/`; `@ai-sdk/*` confined to `ai-config`\|`ai-kit`                       | manifests present (4 `primitive` + 1 `edition`); `boundaries.js:43-46` PROVIDER_SDKS, `:56-59` PROVIDER_EXEMPT; every meter/prompt table FORCE-RLS (`schema.ts` `buildTenantPolicySql`) | ✅            |
| A base package importing `@ai-sdk/*` fails the gate                                                      | rule present (`boundaries.js`), but **no automated negative assertion** (T13 left it a comment/note)                                                                                    | ⚠️ untested   |
| Each new locked package has a ledger backfill row; PR open + CI green                                    | `registry/ledger.jsonl:3-7` (all 5); merged green via PR#11                                                                                                                             | ✅            |

## Acknowledged seams (by design — recorded, NOT failures)

- **Live provider transport** — `providers.ts:20` `providerFor` / `:46` `defaultProviders` (the real
  `@ai-sdk/*` adapters) is the ONE path no test reaches. Every test injects `MockLanguageModelV2`
  (`gateway.test.ts:34`, `gateway.integration.test.ts:49`); the gateway hides the SDK behind `infer()`.
- **`provider` Moderator driver** — `moderator.ts:76` wraps an INJECTED check; the real HTTP call (a
  buyer's `fetchWithTimeout` adapter) is test-doubled. Guardrails itself makes no outbound call.
- **Live `Judge` driver** — CI replays a committed cassette (`judge.ts:63`); a live LLM judge is
  injected locally (`recordingJudge`, `:94`) to mint a cassette, then reviewed + committed.
- **Streaming** — the gateway ships request/response (`generateText`); the signature is
  async-iterable-capable but streaming is deferred by design (ADR-0059 "ship request/response first").
- **`ai-config` is thin** — 47-LOC `resolveProvider` (env-pointer BYOK, ADR-0011); the per-tenant
  encrypted BYOK (P3-25) stays the locked env-pointer contract — a deferred fork, out of scope.

## Gaps / follow-ups (low severity, test-depth — non-blocking)

- **Atomic-under-concurrency** (criterion 5) is a structural guarantee (atomic SQL), not exercised by a
  concurrent-execution test. Queue a contention test.
- **No negative boundary test** that a base package importing `@ai-sdk/*` fails the lint — only the rule
  - a comment. Queue a fixture/assert.
- **Soft-cap warning path** (`softExceeded`) is computed but no test asserts warn-without-block; only the
  hard cap is exercised.
- **Eval suite depth** — 2 committed eval cases (cassette + deterministic graders). Thin by design; deepen
  the dataset as the editions land real prompts.

## Verdict: PARTIAL (pass-with-seams)

The test-doubled goal is fully achieved — reserve-before-spend, 402 breaker, fail-closed PII/moderation,
`name@version` + alias swap, and a regression-vs-baseline eval gate all hold end-to-end on PGlite with
zero network. PARTIAL rather than PASS because the live provider/moderator/judge transports are
by-design seams never exercised, and two sub-claims are structural not tested. Proceed to SWEEP + SHIP;
wire the seams + close the test-depth gaps in follow-on phases (no DEPLOY).
