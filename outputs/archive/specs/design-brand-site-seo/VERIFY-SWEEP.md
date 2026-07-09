# VERIFY (goal-backward) + SWEEP — Caisson site build

**Date:** 2026-06-27. **Branch:** `design/brand-site-seo`. **Implements:** SPEC.md P0 + ADR-0078/0079/0080/0081.
**Method:** re-ask the SPEC "Goal" against the merged diff (commits `2a6256f` Phase F · `78e7a3d` Phase P+I ·
`51954cd` Phase A), not a task checklist.

## VERIFY — did the build achieve the SPEC goal?

> Goal: take `apps/site` from a clean scaffold to a **production-grade, brand-complete, SEO-instrumented,
> copy-finished** compliance-led marketing + docs surface — without relitigating the locked hero/name.

**Verdict: PASS.**

| Goal dimension                       | Evidence                                                                                                                                                                                                                                                                                                                                   | Verdict |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **Brand-complete**                   | Token additions (motion/elevation/glow/code-mono, weight 400); waterline logomark + favicon/apple-icon/manifest; icon system (Lucide + 7 bespoke domain glyphs) — **zero leftover Unicode box glyphs**; `DESIGN.md` authored; expressive tokenized hero motion; elevation+glow scale shipped. Verified in desktop+mobile screenshots.      | ✅      |
| **SEO-instrumented**                 | `buildMetadata` on all 14 pages (canonical/OG/twitter); root `@graph` + per-page JSON-LD (XSS-safe); per-edition OG images; sitemap `lastmod`; allow-all robots; Lighthouse CWV/a11y CI baseline. Home↔/compliance cannibalization resolved. **Home `<title>` blocker found + fixed** (verified in built HTML).                            | ✅      |
| **Copy-finished**                    | Dev-kit-noun register (no "platform"/"automate compliance"); technical-vs-administrative honesty boundary on **every** edition/framework/legal page (no certification implication); retrofit $-figures; smoke-detector line; named-engineer note; control+clause tags; pricing indicative + "subject to change" frame; consent microcopy.  | ✅      |
| **Compliance-led**                   | Compliance is the featured-lead/hero on home + nav + editions; the other three read subordinate under the umbrella (ADR-0040 intact).                                                                                                                                                                                                      | ✅      |
| **Locked hero/name not relitigated** | "Fail-closed by construction." signature present (layout, home, security); name **Caisson** unchanged.                                                                                                                                                                                                                                     | ✅      |
| **4 launch-gate bundles (P0)**       | Legal (privacy/terms/license, operator-review framed) · Security (CSP tightened with honest residual + security.txt + /security trust page + waitlist honeypot + fail-closed Turnstile seam) · Errors+a11y (404/error/loading/global-error + skip-link + `<h1>` fix) · Content-cadence (changelog + RSS + email templates + /procurement). | ✅      |
| **Quality gates**                    | `bun run check` green (56 turbo tasks + kernel standards gate); static export builds 67 pages; **UI craft review** PASS (blocker+majors fixed); **security audit** PASS-WITH-NOTES (1 LOW fixed).                                                                                                                                          | ✅      |

No partial/failed dimensions. The locked decisions (ADR-0040 hero, ADR-0041 name) were not reopened.

## SWEEP — downstream impact + follow-ups

### DEPLOY steps (operator-gated — NOT done in this PR; ship stops at the merged PR)

1. **Cloudflare Pages env bindings:** `RESEND_API_KEY` + `RESEND_SEGMENT_ID` (waitlist → Resend; inert 202 seam until set); `TURNSTILE_SECRET` + `NEXT_PUBLIC_TURNSTILE_SITEKEY` (+ mount the client widget — see P1); a `WAITLIST_RL` Workers-KV binding for the documented per-IP rate-limit.
2. **Plausible:** confirm the `caisson.sh` domain is registered in Plausible.
3. **DNS + deploy:** point `caisson.sh` at CF Pages; `wrangler pages deploy out`. Re-run the Lighthouse CI workflow against the deployed origin.

### P1 — launch polish (queued)

- Turnstile **client widget** (server verify seam already fail-closed); optional affirmative **consent checkbox** if legal prefers it over the passive notice (security audit LOW — currently reworded to match the passive mechanism).
- Docs surface: 3-col TOC + grouped sidebar + CMD-K + callouts + code-block tabs + docs landing hub.
- CF **content-signals** in robots (deferred — `MetadataRoute.Robots` has no custom-field slot; needs a static robots augmentation); per-doc OG; section-rhythm bands; accent-card density audit per viewport.

### P2 — post-launch / pilot-gated

- Programmatic `/frameworks/{soc2,hipaa}` × control engine (measure indexation at 90 days), then `/use-cases` · `/guides` · `/glossary`; dashboard/cockpit surfaces.

### Open operator fork (unchanged)

- **Pricing FINAL numbers + grandfathering** remain operator-owned. Indicative placeholders shipped per ADR-0081 with the "subject to change before launch" frame on every surface.

### Residuals documented honestly (not defects)

- CSP keeps `script-src/style-src 'unsafe-inline'` — Next static export inlines its hydration bootstrap with no nonce path; the site's own scripts are externalized to same-origin. Stated plainly in `_headers` and on `/security`; the security audit ruled it acceptable.
