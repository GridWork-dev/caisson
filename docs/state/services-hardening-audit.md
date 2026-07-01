# Services hardening audit — go-live punch-list

Status: **audit complete 2026-06-30** (gw-security-auditor, read-only). Surfaces: `services/docs`,
`services/license`, `services/support-bot`, `registry/worker`, `packages/mcp-server`, + the
billing-webhook reception in `apps/base`. Verdict: **strong core, thin edges** — timing-safe compares,
Zod `.strict()`/pydantic boundaries, `withTenant` RLS fail-closed, fail-closed boot, `fetchWithTimeout`/
bounded-httpx egress, offline fail-safe `verifyLicense`, registry `private/no-store+Vary` all correct.
Gaps are at the **network edges + deploy composition**, fixed before public exposure.

## Punch-list (ranked)

| #   | Sev      | Surface                              | Gap                                                                                                                                                                                                                                  | Fix                                                                                                                                                                                                                                                 | Blocks go-live?                     |
| --- | -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | **HIGH** | `services/docs/src/app.ts`           | No rate-limit on any route. Grey origin (no CF WAF), reachable at `*.up.railway.app`. `/llms*.txt` = unauth full-corpus scrape; `/query` = live OpenRouter spend per hit (cost-amplification)                                        | Per-**IP** token bucket in the handler (ADR-0112 store is per-account; docs has no account → IP limiter), or front origin with a CF Worker/Access rule                                                                                              | **Yes** (cost-DoS)                  |
| 2   | MED      | `packages/mcp-server`                | ADR-0112 rate-limit hook built + tested but **wired nowhere in production** (`createMcpServer({checkRateLimit})` never called outside tests) → throttle inert                                                                        | Pass `checkRateLimit: createRateLimitHook({db, onStoreError})` at the served composition; sink `onStoreError` to telemetry                                                                                                                          | **Yes**                             |
| 3   | MED      | `apps/base/src/server.ts:51`         | Webhook header **hardcoded `stripe-signature`** but go-live MoR = Paddle (`Paddle-Signature`) → every webhook fails parse. AND `handleBillingWebhook` (entitlement grant) is **bound to no server** — only the credit grant is bound | Bind the Paddle webhook (read `Paddle-Signature`, timing-safe HMAC) at `services/license` (= `license.caisson.sh/webhook`, the configured Paddle destination); route to **both** credit grant + `handleBillingWebhook` (entitlement); rate-limit it | **Yes** (purchases won't provision) |
| 4   | MED      | `services/license/src/app.ts`        | No rate-limit on `/issue` (bearer-gated signing endpoint) or the webhook receiver                                                                                                                                                    | Per-IP limit; bearer/HMAC stay primary                                                                                                                                                                                                              | recommended                         |
| 5   | LOW-MED  | `services/support-bot/.../rag.py:92` | RAG isolation is **delimiter-based, not structural** — retrieved chunks + untrusted user question concatenated into one `user` message. Blast radius small (tool-less, secret-less, single public corpus)                            | Fenced `<context>…</context>` blocks role-separated from the user turn + lightweight output check (drop replies leaking system prompt). **Keep the bot tool-less**                                                                                  | recommended                         |
| 6   | LOW      | `services/docs/src/app.ts:41`        | `/llms*.txt` set no `Cache-Control` → no edge absorption (artifacts are byte-stable)                                                                                                                                                 | `Cache-Control: public, max-age=…`                                                                                                                                                                                                                  | nice                                |
| 7   | LOW      | `apps/base/src/server.ts:16`         | `json()` helper omits HSTS (docs/license include it)                                                                                                                                                                                 | Add `Strict-Transport-Security`                                                                                                                                                                                                                     | nice                                |

## Prompt-injection posture (support-bot)

Blast radius is **genuinely small by construction**, not by filtering: the RAG pipeline is
`retrieve→ground→generate→reply` with **no tool-calling**, **no tenant data** (single operator-authored
public corpus), **no secrets in model context** (OpenRouter key rides the HTTP header, never the
prompt), and **mod/escalation actions are separate Discord slash commands** gated by permissions +
`member_can_manage_role` — not model-reachable. Worst realistic injection outcome = an off-topic answer
or the model paraphrasing its (non-secret) system prompt. Grounding instruction + refusal sentinel +
12k context cap are present. The thinness is structural fencing (item #5). **If buyer-facing tools are
ever added to this model, re-rate to HIGH** (allow-list tools + per-tool entitlement gating).

## Sequencing

- **#1, #6** (`services/docs`) — independent, build any time.
- **#4** (`services/license` `/issue`), **#7** (`apps/base` HSTS), **#5** (support-bot RAG) — independent.
- **#2, #3** — depend on the **deploy composition** (the ADR-0114+ unified-app/Railway entrypoint, built
  by Phase 2). Confirm/build against the actual deploy wiring; #3's home is `services/license` under the
  locked one-service-each topology. **These two gate commerce go-live** and must be verified before the
  Paddle webhook + MCP are publicly exercised.

Full findings (per-surface tables + credits): session transcript 2026-06-30; this doc is the actionable digest.
