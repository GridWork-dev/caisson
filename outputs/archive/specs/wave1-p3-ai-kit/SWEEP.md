# SWEEP — Wave 1 · P3: AI Production Kit (downstream impact)

Act 5. What else the P3 diff touches: unblocked work, extended base seams, stale docs, queued
follow-ups. Recorded retroactively (the phase merged green via PR#11 carrying only SPEC + PLAN).

## Base seams extended (down-only) — new consumers across the monorepo

| Seam (this diff)                                                                       | Lands in                                    | Downstream consumers                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventSink` port + `usage-metering`/`eval-result`/`guardrail-block` schemas (ADR-0075) | `kernel/event-sink.ts` + `observability.ts` | guardrails emits `guardrail.blocked`; any edition's observability rides the same typed bus; the future P6 cost/safety dashboard reads these shapes |
| `GuardrailError` 422 (ADR-0063 amends ADR-0019)                                        | `kernel/errors.ts:104`                      | the gateway maps a guard block to a 422 envelope (metadata only)                                                                                   |
| Generic `feature_debit`/`feature_grant` + `feature` tag (ADR-0074)                     | `credits/src/credits.ts`                    | the meter's reserve/reconcile legs ride these; any future per-feature metering reuses the envelope (no per-edition enum change)                    |

## Downstream now unblocked / affected

| Surface                                         | Unblocked / affected by                                | Consumes                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **P4 / future editions needing metered AI**     | the `infer()` chokepoint + the four primitives         | `@caisson/{ai-meter,prompt-registry,guardrails,ai-evals}` as base deps (down-only, ADR-0003)                                 |
| **P5 generator / coach**                        | the ADR-0076 coach-tool registration seam              | `mcp-server/coach.ts` (`inspect_env`/`propose_ai_config`/`write_forge_config`/`validate_setup`) — approval-gated, NAMES-only |
| **P6 cost / safety dashboard (later GTM wave)** | the append-only `usage_event` + the `EventSink` events | per-tenant spend, `cost_micro_usd`, `guardrail.blocked` — all FORCE-RLS, read-only                                           |

## Docs reconciled (this diff)

- New ADRs `ADR-0059..0063` (gateway · metering/spendcap · prompt-registry · eval-harness · guardrails). ✅
- `tooling/eslint-config/boundaries.js` — `@ai-sdk/*` added to `PROVIDER_SDKS`; `PROVIDER_EXEMPT` = `ai-config`\|`ai-kit`\|`apps/ai-kit`. ✅
- `registry/ledger.jsonl` — 5 incremental backfill rows (ADR-0069); `registry/index.json` rebuilt. ✅
- Per-package `AGENTS.md` + `README.md` for each new primitive/edition. ✅

## New surfaces (note for future audits)

- **`packages/ai-kit/src/providers.ts` is a LIVE external-egress seam** — the only place a vendor SDK
  (`@ai-sdk/{openai,anthropic,google}` + OpenRouter via OpenAI-compat baseURL) is imported. **Nothing
  ships a live call in P3** (every test injects a mock); when a buyer wires a real provider key
  (`apiKeyEnv` BYOK), each provider host becomes a real external sink and is the buyer's surface, not
  gridwork's. ai-config never reads the key — the adapter does, at the edge.
- **`usage_event` / `tenant_spend_window` / `spend_policy` / `spend_breaker` / `prompt_version` /
  `prompt_alias`** are new FORCE-RLS tables (TM7) — every cross-tenant read is RLS-blocked.
- **The `eval` turbo task is monorepo-only** (ADR-0072) — it must NEVER be emitted into a generated
  buyer repo's required CI; `create-caisson` (P5) must not copy the `eval` job.

## Queued follow-ups (non-blocking)

1. **Wire the live transports** — the real provider adapter, the `provider` Moderator HTTP path, and a
   live `Judge` driver (each behind its seam; `fetchWithTimeout` mandatory on any real outbound).
2. **Streaming** — extend `infer()` from request/response to the async-iterable path (signature already
   admits it; meter reserve/reconcile must straddle a streamed call).
3. **Test-depth gaps** (from VERIFY) — a concurrency test for the atomic spend counter; a negative
   boundary fixture (base package `@ai-sdk/*` import fails the gate); a soft-cap warn-without-block test.
4. **Eval dataset depth** — grow beyond the 2 committed cases as editions ship real prompts; keep the
   injection grader its own fail-closed class.
5. **Pricing lock** — `priceCents` is the 49900 placeholder anchor; finalize under the open Pricing board
   fork (out of P3 scope).
6. **Per-tenant encrypted BYOK** (P3-25) — deferred fork; the locked env-pointer contract holds until then.

## Post-audit (Act 7 SHIP)

The SPEC declared `security` + `secrets` + `external-system` + `ai` tags → SECURITY audit + EVAL fired
at SHIP with the T19 threat model (TM1 overspend · TM2 key-leak · TM3 prompt-injection · TM4 PII egress ·
TM5 fail-open outage · TM6 live-call-in-CI · TM7 cross-tenant read · TM8 SDK-boundary escape · TM9
eval-gaming) as concrete targets. Each TM maps to enforced code: reserve-before-spend + breaker (TM1),
NAMES-only coach + env-pointer BYOK (TM2), escaping render boundary (TM3), redact-before-egress tokenize
(TM4), fail-closed default (TM5), injected mock + cassettes (TM6), FORCE-RLS (TM7), `PROVIDER_EXEMPT`
allow-set (TM8), injection grader as its own class (TM9).

## No regressions

Merged green via PR#11 (all `tooling/` gates green, index byte-identical, goldens matched BLESS unset);
the four base-seam extensions are additive (no locked enum/contract edited); no service touched (no DEPLOY).
