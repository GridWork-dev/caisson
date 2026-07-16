# SPEC — Public status page + /trust page + subprocessor list

- **Date:** 2026-07-13 · **Status:** SHIPPED — locked by ADR-0348 (2026-07-13), EXECUTED 2026-07-15 (PR 242: /trust + subprocessor table + Worker /health; Better Stack page 255425 live; status.caisson.sh CNAME applied same day). Verification gate met: 4 named monitors public, /trust links the page, zero certif/compliant hits.
- **Tags:** `ui` `product` (`ui` fires the UI review at SHIP)
- **Source:** Kickoff T banner item 8 (AUDIT-SYNTHESIS §D HIGH gap): a compliance-infrastructure
  vendor selling trust artifacts has no public availability surface and no subprocessor
  disclosure — a table-stakes gap buyers check before procurement.
- **Authored by:** the platform session (Kickoff T). apps/site is frozen this wave (Kickoff S owns
  it), so this spec is the deliverable now; EXECUTE rides a later session against the site tree.

## Goal

A buyer evaluating caisson can, without asking: (1) see live + historical availability of the
surfaces they'd depend on (site, registry, license service, docs-RAG), and (2) read exactly which
third parties process what data, from a page that also anchors the security-posture claims the
evidence packs already make. WHY: procurement checklists ask for a status page URL and a
subprocessor list verbatim; absence reads as immaturity in exactly the segment caisson sells to.

## Scope

1. **Better Stack public status page** (free tier — the account and the CAISSON-53 alert path
   already exist; `services/betterstack-adapter` relays its incident webhooks to Discord today).
   Monitors over the existing public health surfaces — all already live and unauthenticated:
   - `caisson.sh` `app/healthz` (the site — `apps/site/app/healthz/route.ts`)
   - `license.caisson.sh` `/health` (`services/license/src/app.ts:594`)
   - docs-RAG `/health` (`services/docs/src/app.ts:124` — deliberately un-rate-limited for probes)
   - `registry.caisson.sh` (the Worker — pick its cheapest read route at EXECUTE)
     Status page slug: `status.caisson.sh` (CNAME to Better Stack) or the vendor-hosted URL —
     resolve at EXECUTE; CNAME preferred (custom domains are on the free tier per Better Stack's
     current pricing page — re-verify at EXECUTE).
2. **`/trust` page on apps/site**: one page linking the status page, the security docs the repo
   already ships (`docs/security/`, evidence-pack story, WORM/anchoring claims at their honest
   grade), the subprocessor list, and the security contact (`security@caisson.sh`, ADR-0324
   roles). Copy obeys ADR-0080 laws: readiness/posture language only — never "certified/compliant".
3. **Subprocessor list** (rendered on `/trust`, maintained as data not prose): enumerate at
   EXECUTE from the live fleet — expected set: Railway (app hosting + Postgres), Cloudflare (DNS/
   proxy/WAF/Workers/R2), Paddle (merchant of record — payment data never touches caisson),
   Resend + Amazon SES (transactional email), PostHog (product analytics), Grafana Cloud
   (observability), Better Stack (status/uptime), OpenRouter (AI inference for docs-RAG/support
   surfaces), GitHub (source + CI), Discord (support community). Each row: processor, purpose,
   data categories, region where stated. The list is a maintained artifact — a new external sink
   lands a row the same change (mirrors the gridwork security-surfaces invariant).

## Non-goals

- No SLA commitments, no uptime guarantees in copy — the page shows measured availability, it
  does not promise numbers (pricing/legal implications are the operator's call, out of scope).
- No DPA/ToS rewrites (legal pages stay as shipped; the ADR-0319 engagement owns legal language).
- No self-hosted status infrastructure — Better Stack free tier is the whole build; if it ever
  constrains, that is a new fork, not silent scope growth.
- No status API/webhook consumption back into the product (the adapter Worker already covers
  alerting; this spec is the public-facing surface only).

## Operator gates

- Better Stack monitor + status-page creation is an external-system act (operator or
  operator-gated main-thread act with the existing Better Stack credentials).
- The status-page CNAME (`status.caisson.sh`) lands in `infra/terraform` alongside the email
  records when chosen (same import/apply runbook posture — apply stays operator-gated).
- Forks LOCKED (ADR-0348): status page domain = **`status.caisson.sh` CNAME** (terraform,
  operator-gated apply; re-verify Better Stack free-tier custom-domain support at EXECUTE) ·
  registry Worker gets a **dedicated unauthenticated `/health` route** (200 + version).

## Verification (goal-backward, when built)

An anonymous browser: loads the status page and sees ≥4 named monitors with history; loads
`/trust` and finds the subprocessor table, the security contact, and a working status-page link;
greps the rendered `/trust` copy for "certif"/"compliant" and finds zero hits (ADR-0080). A
deliberately-taken-down staging monitor shows red on the page within its check interval (proves
the page is live data, not decoration).
