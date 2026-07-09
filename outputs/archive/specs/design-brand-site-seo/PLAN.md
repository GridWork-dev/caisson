# PLAN — Caisson site build (Design·Brand·SEO·Copy P0)

**Status:** plan-ready · 2026-06-27. **Implements:** SPEC.md P0 + ADR-0078/0079/0080/0081. **Baseline:**
`bun run check` GREEN (56 turbo tasks + kernel gate; static export builds ~16s; 26 RSC `.txt` siblings
normalized). **Network:** up (npm + Google Fonts reachable). **Turbo:** local 2.5.8 (safe; global 2.10
SIGBUS — never invoke `bunx turbo`). **Scope:** P0 launch-blocking only; P1/P2 (programmatic engine,
dashboards) are follow-ups. **Tags:** `ui` `frontend` `seo` `copy` `security` → SHIP runs UI review +
security audit.

## Execution model — staged workflow fanout

Coupling is high (every page depends on the token + component contract), so this is a **pipeline with a
barrier**, not a flat fanout:

```
Phase F — FOUNDATION (1 agent, sequential)  → main-thread review + `bun run check` green
Phase P — SURFACES (parallel agents, disjoint file ownership, no worktree isolation needed)
Phase I — INTEGRATION (main thread): bun run check + build + screenshot verify + fix
Phase A — AUDIT (parallel): UI review + security audit  → VERIFY (goal-backward) + SWEEP → SHIP (PR)
```

Parallel writers own **disjoint files** (one page each) → no overlapping writes → **no worktree isolation
needed** (cheaper). Only Phase F touches `package.json`/lockfile/`global.css`/shared components/tokens;
Phase P agents only write their own page/route files against the locked contract.

## The contract (Phase F output — Phase P codes against this)

### Token additions (`packages/ui/src/tokens` + `gen-tokens-css.ts`)

- `foundation.motion`: `duration.{fast:120ms,base:180ms,slow:240ms}`, `ease.{out:"cubic-bezier(0,0,0.2,1)",
reveal:"cubic-bezier(0.23,1,0.32,1)"}` → emit `--cs-duration-*`, `--cs-ease-*`.
- `foundation.elevation`: `shadow.{sm,md,lg}` (dark-tuned, low-alpha) → `--cs-shadow-*`; plus a per-theme
  `--cs-glow-accent` (accent-tinted, emitted in the semantic block so it tracks theme).
- `theme.fonts.monoCode` (JetBrains Mono stack) → `--cs-font-mono-code`. Martian Mono stays `--cs-font-mono`
  (brand/labels/numerals).
- `foundation.fontWeight.body` 350 → **400** (ADR-0078 §8). Re-run `bun run gen:tokens` → commit `tokens.css`.

### Component + class layer (`apps/site/components/` + `app/global.css`)

New React components (props frozen here): `Hero({eyebrow,title,lede,ctas,artifact,motion})`,
`Section({eyebrow,title,lede,band})`, `Card({accent,interactive})`, `CodeBlock({code,frame,tint,lang,label})`,
`SkuGrid`, `StatusChip({state,label})`, `EditionCard`, `CredentialStrip`, `NavCTA`, `MobileNav`, `Reveal`
(fade-up-once, reduced-motion-safe), `Icon` (lucide re-export + bespoke domain glyphs). New `.cs-*` classes:
`.cs-display`, `.cs-cta-row`, `.cs-card--interactive` (tonal hover + elevation), `.cs-terminal` (chrome),
`.cs-band` (toned section), `.cs-reveal`. global.css gains: elevation/glow utilities, hover transitions on
the motion tokens, intermediate breakpoints (1024/680) + mobile-nav, `clamp()` display type, skip-link,
forced-colors block, `@media print`, reduced-motion reveal fallback (content never `opacity:0`).

### Shared infra

- `lib/metadata.ts` → `buildMetadata({title,description,path,ogImage,type})` (canonical/OG/twitter). All pages
  - docs use it.
- `lib/jsonld.ts` → root `@graph` (Organization + WebSite) + per-page helpers (SoftwareApplication w/
  indicative Offer price per ADR-0081, TechArticle, BreadcrumbList, FAQPage where real).
- `lib/pricing.ts` → the ADR-0081 indicative anchors (single source).
- Brand assets: `app/icon.svg` (waterline-over-chamber), `app/apple-icon.png`, `app/manifest.ts`,
  `public/` favicon set, `theme-color`. Wordmark component. `~8–12` bespoke domain glyph SVGs.
- Fonts: `next/font` self-host (Hubot Sans + Martian Mono + JetBrains Mono), drop the Google `<link>` +
  `preconnect`; externalize the no-flash theme script to `/theme-init.js` (CSP `script-src 'self'`).
- `DESIGN.md` (brand book + anti-boilerplate is/is-not law).
- `bun add lucide-react` (apps/site) — only Phase F mutates the lockfile.

## Phase P — surface agents (parallel, disjoint ownership)

| Agent              | Owns (writes)                                                                                             | Work                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home`             | `app/(marketing)/page.tsx`                                                                                | split hero + framed terminal + install cmd + signature motion · credential strip · evidence proof-lines + clause tags · featured-lead editions · SKU matrix w/ indicative prices · CI proof strip · named-engineer note |
| `compliance`       | `compliance/page.tsx`                                                                                     | apply components · smoke-detector line · retrofit $-figures · technical-vs-administrative boundary · FAQ block · indicative pricing                                                                                     |
| `ai-kit`           | `ai-kit/page.tsx`                                                                                         | tighten H1 ≤7w · failing-eval-gate artifact · components · FAQ                                                                                                                                                          |
| `local-first`      | `local-first/page.tsx`                                                                                    | resolve the AGPL available-now-vs-waitlist contradiction (GitHub-led) · components                                                                                                                                      |
| `agentic-dev`      | `agentic-dev/page.tsx`                                                                                    | add the missing hero CTA · components                                                                                                                                                                                   |
| `pricing`          | `pricing/page.tsx`                                                                                        | indicative numbers + "subject to change" frame · edition×module matrix · own-vs-subscribe sharpen                                                                                                                       |
| `shell`            | `components/site-nav.tsx`,`site-footer.tsx`,`waitlist-form.tsx`,`app/layout.tsx`,`(marketing)/layout.tsx` | nav CTA + mobile menu · footer Legal column · form consent + post-signup + honeypot + focus-mgmt + Turnstile seam · root metadata/JSON-LD wiring · skip-link                                                            |
| `legal`            | `app/legal/{privacy,terms,license}/page.tsx` + content                                                    | privacy (Resend PII/GDPR basis) · terms · commercial EULA (ADR-0023) — operator-review framed                                                                                                                           |
| `errors`           | `app/not-found.tsx`,`error.tsx`,`loading.tsx`,`global-error.tsx`                                          | branded routes + real 404 status (verify normalize-export)                                                                                                                                                              |
| `security-surface` | `public/_headers`,`public/.well-known/security.txt`,`app/security/page.tsx`,`functions/api/waitlist.ts`   | CSP harden (externalize no-flash, drop gfonts, tighten img-src; document residual unsafe-inline) · security.txt · trust page · waitlist honeypot+rate-limit+Turnstile-verify seam                                       |
| `content-cadence`  | `app/changelog/page.tsx`,`app/changelog/rss.xml/route.ts`,`emails/*`                                      | changelog + RSS · branded transactional/nurture email template · CISO/procurement section+route                                                                                                                         |
| `seo-tech`         | `app/sitemap.ts`,`robots.ts`,`opengraph-image.tsx` + per-edition `*/opengraph-image.tsx`                  | sitemap lastmod + reciprocal links · robots content-signals + linked llms.txt + noindex md mirror · per-edition OG                                                                                                      |
| `eu-ai-act`        | `app/frameworks/eu-ai-act/page.tsx`                                                                       | the "EU AI Act-ready" page (ADR-0040 slot, ships now)                                                                                                                                                                   |
| `ci-quality`       | `.github/workflows/ci.yml` or a new `lighthouse.yml`, a11y config                                         | CWV + a11y Lighthouse CI baseline + budget                                                                                                                                                                              |

13 surface agents. Each imports the Phase-F contract read-only; none touches `package.json`/lockfile/tokens/
global.css/shared components. `seo-tech` + `shell` lightly overlap on metadata wiring → `shell` owns
`layout.tsx` root metadata, `seo-tech` owns sitemap/robots/OG only (disjoint).

## Risks + mitigations

1. **CSP `script-src 'unsafe-inline'`** — Next static export emits some inline bootstrap. Mitigation:
   externalize the no-flash script (`'self'`), drop the Google Fonts entries after self-host, tighten
   `img-src` off blanket `https:`. Full `script-src` removal may not be achievable on Next static export;
   **document the residual honestly**; the **security audit rules on it** (don't claim more than shipped).
2. **Turnstile + rate-limit** need CF secrets/KV the operator provisions. Ship the **honeypot now** (works)
   - Turnstile widget + server `siteverify` **behind an env seam** (inert without keys, like the Resend seam)
   - a documented KV rate-limit binding. No fake "protected" claim.
3. **Fonts** — `next/font` self-host downloads at build (network ✓). If a build-sandbox loses network, fall
   back to vendored `next/font/local` woff2 (OFL). Verify the LCP win post-build.
4. **Legal copy** — privacy/terms/EULA authored as structured, on-voice pages **flagged "operator legal
   review required"**; not legal advice. EULA mirrors ADR-0023 (fully-commercial, no-resale).
5. **Lockfile** — only Phase F runs `bun add`; commit `bun.lock`. CI runs `--frozen-lockfile`.
6. **Expressive motion + CSP** — the hero animation is CSS / a React client component, never inline script;
   honors `prefers-reduced-motion`.
7. **Build is the integration gate** — agents write code; Phase I runs `bun run check` + `next build` ONCE
   and fixes type/lint/format errors centrally (agents don't each build).

## Verify / audit (Phase A → VERIFY → SWEEP → SHIP)

- **Phase I:** `bun run check` green (56+ tasks + gate) · `next build` static export clean · `bun run
format:check` · screenshot the rendered home/editions/pricing/docs/404 (Playwright headless) for craft.
- **Phase A (parallel):** UI review (impeccable rubric vs the rendered pages) + **security audit** (the
  `security` tag — CSP, waitlist endpoint, legal/PII basis, headers, no secret leak).
- **VERIFY (goal-backward):** re-ask the SPEC goal vs the diff — brand-complete? SEO-instrumented?
  copy-finished? all 4 launch gates present? no relitigating ADR-0040/0041? Partial → enumerate gaps.
- **SWEEP:** downstream notes (P1/P2 backlog, DEPLOY steps for the operator: provision Turnstile/Resend/
  Plausible/CF env, then `wrangler pages deploy`).
- **SHIP:** one PR for the `design/brand-site-seo` branch (docs + build). Operator merges after CI green.
  **No DEPLOY** (no `wrangler pages deploy`, no service restart).

## Done-when

P0 ships green through `bun run check` + standards gate + UI review + security audit, behind one PR; the 4
launch-gate bundles present (legal · security · error/a11y · content-cadence); brand foundation + visual
shell + all 6 marketing pages + SEO technical floor + copy pass complete; residual CSP unsafe-inline (if any)
documented; P1/P2 queued. No DEPLOY.
