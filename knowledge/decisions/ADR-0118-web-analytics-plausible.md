# ADR-0118 — Web analytics: Plausible

Status: accepted · 2026-06-30 (operator lock — closes the **analytics fork**.) Append-only; supersede
with a later ADR, never edit.

The marketing + dashboard surfaces of the unified Next app (ADR-0114) use **Plausible Analytics**.
The tracking snippet is included in the app root layout, **env-gated on `PLAUSIBLE_DOMAIN`** (no-op
when unset, so dev/CI emit nothing). Privacy-friendly, cookieless, no consent banner.

## Why

- **Cookieless + no PII + GDPR/ePrivacy-aligned** — needs no cookie-consent banner, which is the
  correct posture for a product that _sells EU-AI-Act / compliance tooling_ (ADR-0095). Google
  Analytics or a full PostHog session-capture would undercut that positioning and add a consent
  surface.
- **Lightweight** — the script is <1 KB and async, so the ADR-0079 Core-Web-Vitals/SEO budget is
  preserved on the SSG marketing pages.
- **Scope-correct** — analytics answers "what are _users_ doing" (page views, conversion on the
  pricing → checkout funnel); it is **not** system observability (that's OTel/SigNoz, ADR-0117). Two
  separate sinks, deliberately.

## Scope — what changes, what does NOT

**Build now:** the env-gated Plausible script include in the unified app's root layout (a small
client component or `next/script`), inert unless `PLAUSIBLE_DOMAIN` is set; optional typed custom
events on the purchase CTA (`Checkout: edition`) using Plausible's `plausible()` queue. No cookies,
no `localStorage`, no PII.

**Unchanged:** no analytics on the buyer's _generated_ product (this is the operator's own marketing
site only); the dashboard's authed `/dashboard` routes may set `PLAUSIBLE_DOMAIN` but never send
tenant identifiers — only coarse route names.

## Relations

- **New.** Complements **ADR-0117** (observability) — usage analytics vs system telemetry are
  distinct. Fits **ADR-0079** (CWV/SEO — the script is async + tiny) and **ADR-0095** (compliance
  positioning — cookieless is on-brand).

## Build-now vs DEPLOY-class

**Buildable now:** the env-gated script + custom-event hook; inert until configured.

**DEPLOY-class (operator-gated):** a Plausible account (Plausible **Cloud** for go-live simplicity,
or self-hosted **Plausible CE** on Railway for full ownership — the operator's call at deploy); set
`PLAUSIBLE_DOMAIN=caisson.sh`. Runbook: `docs/state/p6-deploy-runbook.md`.

## Binding

Web analytics is Plausible (cookieless, env-gated, marketing + dashboard surfaces of the unified
app), kept separate from OTel/SigNoz observability. Switching analytics vendor, or adding a
cookie-based / session-capture analytics tool, requires a superseding ADR.
