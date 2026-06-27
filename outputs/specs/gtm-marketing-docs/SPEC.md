# SPEC — Caisson GTM: marketing site + docs site (`apps/site`)

Status: active · 2026-06-27 · Wave 2 (GTM). Kickoff: `outputs/kickoffs/gtm-marketing-docs.md`.
Tags: `ui` · `frontend` · `infra` · `external-system` (waitlist → Resend).

## Goal (the thing VERIFY re-asks)

A single Next.js (App Router) app at `apps/site` that serves **both** the marketing surface
(`/`, compliance-led hero) **and** the product docs (`/docs/*`, per-package), static-exported and
deployable to Cloudflare Pages on `caisson.sh`, themed **entirely** against the locked `--cs-*`
contract (ADR-0042) and written in the locked voice (`specs/04`). Success = a green static build
that, under a local Cloudflare preview (`wrangler pages dev out/`), serves the compliance-led hero
with the verbatim H1 **"Fail-closed by construction."** + tagline + the locked RLS/WORM/audit-chain
subhead, and a navigable + searchable per-package docs tree — both on the cold-steel theme with a
working dark/light toggle, WCAG AA verified, zero hard-coded color hex, zero banned voice words, and
no relitigation of any locked decision.

This pass is the **full scaffold, not the final launch artifact**: locked copy verbatim, light
first-pass real section copy from specs, clearly-marked placeholders where long-form copy / media /
video isn't locked. Full copy pass + media are later sessions. **No live deploy this session.**

## Why

For this buyer — a founding engineer evaluating production-grade infrastructure — the site _is_ the
first proof. It must read as production-grade, not a marketing template, or the "fail-closed by
construction" thesis dies on the homepage. Wave 2 is decoupled from product code (Waves 0–1 build
the packages); this session builds the storefront + the manual that converts the compliance wedge.

## Locked inputs (do not relitigate)

- **Name / scope / domain** — Caisson · `@caisson/*` · `caisson.sh` (ADR-0041).
- **Hero positioning** — compliance wedge under a production-rigor umbrella; buyer firewall; sequenced
  launch; EU-AI-Act gated add-on sold worldwide (ADR-0040).
- **Voice + brand** — tagline, H1, subhead, banned-word list, per-edition voice (specs/04).
- **Design foundation** — Palette A cold-steel teal + type Structural (Hubot Sans + Martian Mono);
  the `--cs-*` `tokens.css` contract; theme-not-fork; depth = tonal surface + hairline borders, never
  shadows; accent ≤10%; WCAG AA floor (ADR-0042).
- **App framework** — Next.js App Router; packages stay framework-free (ADR-0044 / ADR-0022).
- **Hosting** — Cloudflare Pages, `caisson.sh` zone via Terraform (`infra/terraform`).
- **Engineering invariants** — TS strict, Bun, Zod `.strict()`, no `any`, no `console.log`,
  `fetchWithTimeout`, `crypto.timingSafeEqual`, single `tooling/` gate (ADR-0002 / ADR-0016 / ADR-0022).

## Forks resolved this session (→ ADR-0045..0048)

| Fork             | Lock                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| Docs framework   | **Fumadocs** (headless, MIT, themed onto `--cs-*` via an `fd-bridge` layer)            |
| Deploy mode      | **Next static export (`output:'export'`) → Cloudflare Pages direct-upload**            |
| App topology     | **Single app**, route split `/` + `/docs`                                              |
| Content source   | **In-repo MDX** (Fumadocs MDX collections, `content/docs/**`)                          |
| Next/React line  | **Next 16 + Fumadocs 16 + React 19.2** (greenfield clean path; studio stays on 15)     |
| Waitlist         | **Cloudflare Pages Function → Resend Segments** (`POST /contacts` + `segments:[{id}]`) |
| Analytics        | **Plausible** (direct cloud script now; first-party proxy = later hardening)           |
| Hero SKU surface | **SKU structure shown, prices deferred to waitlist** (no hard prices)                  |

## Surfaces to build

- **Marketing** (`(marketing)` route group): `/` (hero + evidence + editions overview + SKU + waitlist
  CTA), `/compliance` (deep hero-edition page), `/ai-kit` `/local-first` `/agentic-dev` (lighter edition
  pages), `/pricing` (SKU structure, no prices).
- **Docs** (`/docs/*`): Fumadocs `DocsLayout`, getting-started spine + per-package stub pages for the
  published set (base substrate + 4 editions' packages), static Orama search, `llms.txt` /
  `llms-full.txt` / per-page `content.md`.
- **Seams:** `functions/api/waitlist.ts` (Resend Segments) + `functions/_middleware.ts` (headers);
  `public/_headers` (CSP + security headers for static assets); Plausible script; SEO (`sitemap`,
  `robots`, OG image, `SoftwareApplication` JSON-LD).
- **Infra:** reconcile the two stale `next-on-pages`/OpenNext comments; add `wrangler.jsonc`
  (`pages_build_output_dir:"out"`); a CI deploy job (Wrangler direct-upload, gated green,
  `workflow_dispatch`/main-only — never auto-deploy from a PR).
- **Docs/state:** 4 ADRs + board rows; `site` commit scope added to `CLAUDE.md`.

## Non-goals / firewall

- No commerce, license issuance, support-bot, or buyer dashboard (deferred wave). Pricing = SKU
  _display_ + waitlist, not checkout.
- No `@caisson/*` product feature code. Docs code samples are MDX, not implementations.
- No forking `@caisson/ui` or duplicating the token layer — theme via `--cs-*`; new token → add to
  `packages/ui/src/tokens/` + regen, never hand-edit `tokens.css`.
- Pro-private firewall: nothing from `media-pipeline` seeds code here.
- No second build/lint/test toolchain — everything routes through `tooling/`.
- **No `terraform apply`, no production deploy** — DEPLOY is a separate operator-gated act. SHIP ends
  at the green, merged PR.

## Exit gate

Per the kickoff "Exit gate": clean `bun install`; green `@caisson/site` build (static export) + lint +
test through `tooling/`; `bun run check` clean; import-boundary lint shows no package importing the
framework; local Cloudflare preview serves both surfaces with the locked hero + a navigable/searchable
docs tree on the `--cs-*` theme with a working toggle; contrast check confirms AA; visible focus ring;
`prefers-reduced-motion` honored; waitlist validates a `.strict()` body, calls Resend with
`fetchWithTimeout`, keeps the secret server-side; `terraform validate` passes + README reconciled; an
ADR per locked fork (≥0045) with board rows; `grep` confirms zero hard-coded hex / banned words in
`apps/site`.
