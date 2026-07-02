# Strix pentest findings — 2026-07-01

First Strix run against Caisson. Engine: OpenRouter `gpt-5.5`, deep mode, read-only intent,
white-box (source) + black-box (live site origin, `license.caisson.sh`, `docs-api.caisson.sh`).
483 LLM requests, 79.8M input tokens. Run artifacts (raw report + per-finding PoCs):
`~/lab/caisson-strix-runs/strix_runs/code-tree_4f1a/`.

**6 validated findings — 1 critical, 2 high, 3 medium.** Each was reproduced with a PoC before
filing. These are runtime-security findings (a different class from PR#40's design/standards audit),
so they are largely **net-new**, not duplicates.

## Findings

### 🔴 CRITICAL — vuln-0004 · DNS-rebinding bypasses SSRF guards

- **Where:** `packages/alerting/src/channels.ts` (`assertSafeUrl` / `safeHttpsUrl`, `createWebhookChannel`), `packages/ai-kit/src/providers.ts` (`assertSafeBaseUrl` / `providerFor`) — CWE-918, CVSS 9.1.
- **Bug:** the guards reject _literal_ private hosts/localhost/IP ranges but never **resolve the hostname**. A public-looking host that resolves (or rebinds) to `127.0.0.1`/private space passes, then reaches `fetchWithTimeout` (alert webhook) and the Vercel AI SDK provider (BYOK base URL — tenant-influenced). Server sends attacker-directed POSTs + provider auth material to internal/loopback services.
- **Fix:** resolve the hostname and re-check the resolved IP(s) against the private/loopback/link-local/metadata ranges _before_ the fetch, and pin the destination IP for the actual connection (guard against TOCTOU rebinding). Apply to both the alerting and ai-kit URL sinks.

### 🟠 HIGH — vuln-0003 · Admin business dashboard has no in-app auth

- **Where:** `apps/admin` — `/business` page + `readAdmin` (`SET LOCAL ROLE admin`, cross-tenant reads) — CWE-306, CVSS 7.5.
- **Bug:** admin relies on Cloudflare Access as the _sole_ auth boundary; no middleware, session check, or CF Access JWT validation in-app. If the origin is reached directly or the Access policy is misconfigured/bypassed, an unauthenticated caller renders cross-tenant tenant/credit/entitlement/license data. (Note: this is the ADR-F041-style "CF Access is the only gate" posture — Strix flags it as a single point of failure with no fail-closed app check.)
- **Fix:** validate the `Cf-Access-Jwt-Assertion` JWT (or a shared internal bearer) in an admin middleware, fail-closed. This also removes the origin-direct exposure the pentest used.

### 🟠 HIGH — vuln-0006 · Seat members can modify org-level BYOK keys & compliance attestations

- **Where:** `apps/site/app/api/byok/route.ts` (`POST /api/byok`), `apps/site/lib/attestations.ts` (`attestSlot`/`clearSlot`) — CWE-863, CVSS 7.6.
- **Bug:** member-management correctly gates on `role === "owner"` (`assertCanManageMembers`, ADR-0176), but `/api/byok` and the compliance server actions only check for a non-null session. A `seat` member resolves to the shared org `accountId`, so RLS scopes the write correctly but doesn't distinguish owner vs seat → a seat can rotate the org BYOK provider key and create/clear compliance attestations.
- **Fix:** add the owner-only role check (`assertCanManageMembers(session.role)` or equivalent) to the BYOK submit path and the attestation server actions. Relates to ADR-0198 (BYOK per-action allowlist).

### 🟡 MEDIUM — vuln-0002 · Paddle subscription-update webhooks grant a full credit cycle

- **Where:** Paddle event mapper (`@caisson/billing`), consumed by `services/license` `applyBillingEvent` — CWE-840, CVSS 6.5.
- **Bug:** the mapper turns every subscription-linked `transaction.completed` whose `origin != "subscription_charge"` into `billingReason: "subscription_cycle"`. Paddle emits `origin: "subscription_update"` for prorations/updates — these get mapped to a granting reason, so the license service grants full plan credits despite comments saying updates should grant nothing until the next cycle. PoC: a signed `subscription_update` credited 1000.
- **Fix:** map `origin: "subscription_update"` (and other non-charge origins) to a non-granting reason; only `subscription_charge`/renewal invoices should grant.

### 🟡 MEDIUM — vuln-0005 · Multi-item Paddle checkout grants only the first item

- **Where:** Paddle webhook parser `readItemPriceId` reads `obj.items[0].price.id`; `parsePaddleEvent` emits a single `purchase.completed` with a scalar `priceId`; `applyBillingEvent` → `resolvePurchase` once — CWE-840, CVSS 5.4.
- **Bug:** the cart opens a multi-line Paddle checkout, but only the first line item is fulfilled. Buyer is charged for all items, receives only the first entitlement/credits. PoC: compliance + ai-kit + credit-pack cart granted only `["compliance"]`, 0 credits.
- **Fix:** iterate `data.items[]` and emit one grant per paid line (or a multi-item event); fulfill every purchased line.

### 🟡 MEDIUM — vuln-0001 · Rate-limit bypass via spoofable forwarding header

- **Where:** `services/docs/src/rate-limit.ts` `clientIp()` (reads `x-envoy-external-address` and trusts it), used by `services/docs/src/app.ts` `POST /query` before auth — CWE-770, CVSS 5.3.
- **Bug:** the pre-auth rate-limit bucket key is an attacker-suppliable header. Rotating `X-Envoy-External-Address` mints a fresh bucket per request → the per-IP limiter is bypassed. Live-confirmed: 25 rotated-header requests all `401`, none `429`.
- **Fix:** derive the client IP from a trusted edge signal (strip inbound `x-envoy-external-address` at ingress and set it only at the trusted proxy), or use the real socket/CF-connecting-IP for the bucket key.

## Not confirmed (report explicitly cleared these)

No exploitable SQL injection, path traversal, unauthenticated docs-retrieval bypass, Ed25519 license
signature bypass, Paddle HMAC bypass, or anonymous dashboard data exposure. Cryptographic foundations
(Ed25519 verify, raw-body Paddle HMAC) reviewed as sound — the billing bugs are business-logic, not crypto.

## Coverage gaps — improve the next run

- **admin.caisson.sh live** was not black-box tested (origin 502 — see runbook). vuln-0003 is
  source-only; re-scan admin live once the cert is fixed.
- **No authenticated sessions.** vuln-0006 and buyer-dashboard IDOR/BFLA were validated via source +
  local PoC only; the run had no real better-auth sessions. Next run: supply test **owner**, **seat**,
  and **buyer** credentials so authenticated live flows (checkout, dashboard, member ops) are exercised.
- **support-bot** (Discord, no HTTP ingress) was out of scope — review its command surface separately.
- **Registry Worker** (Cloudflare, license-keyed gating) was not a target — add its URL next time.
- **DoS / body-size** limits only observed via safe ramps, not exploited (flagged as hardening, not filed).
- **Dependency / supply-chain** (CVEs, mutable GH Action refs) noted as an opportunity, not deep-scanned.
- **Cost/engine:** this was gpt-5.5 (79.8M tokens). A GLM-5.2 or ChatGPT-sub run is cheaper but may
  find less — treat a cheap pass as a floor, not a replacement.

## Relationship to the PR#40 audit

PR#40 (whole-repo audit rounds 1–5, ADR-0197–0199) was design/UI + standards-gate focused. These 6
are runtime app-security findings — **net-new**, minimal overlap. vuln-0006 (seat BYOK) is adjacent to
ADR-0198 (BYOK per-action allowlist); vuln-0004 (SSRF) is adjacent to the ai-kit hardening themes but
the DNS-rebinding vector is new. Recommend filing all 6 as Linear issues (Platform & Infra / Editions
& Registry) referencing the relevant ADRs, per the Linear-owns-WORK boundary.
