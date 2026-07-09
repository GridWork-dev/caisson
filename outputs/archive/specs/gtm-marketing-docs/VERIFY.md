# VERIFY — goal-backward (Act 4)

Re-asked the SPEC goal against the built diff + a **live Cloudflare preview** (`wrangler pages dev out/`).
**Verdict: PASS** (full scaffold; copy/media passes deferred per scope).

| Goal criterion (SPEC / kickoff exit gate)                          | Result                                                                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `bun install` clean                                                | ✓ 1152 pkgs                                                                                                      |
| `@caisson/site` static build (`output: 'export'`)                  | ✓ 52 static routes → `out/`                                                                                      |
| lint + test through `tooling/`                                     | ✓ eslint clean; 11 AA contrast tests pass                                                                        |
| repo-wide `bun run check` (build·lint·test + conformance gate)     | ✓ 47/47 turbo tasks; gate ✓                                                                                      |
| `format:check` (prettier)                                          | ✓ clean (added `out/` + `.source/` to `.prettierignore`)                                                         |
| import-boundary: no package imports the framework                  | ✓ Next only in `apps/site`; gate green                                                                           |
| `/` serves locked hero on `--cs-*` theme                           | ✓ H1 "Fail-closed by construction." + tagline + RLS/WORM/audit-chain subhead verbatim                            |
| `/docs/*` navigable + searchable per-package tree                  | ✓ 19 docs routes 200; static Orama index served (`/api/search`)                                                  |
| dark/light toggle                                                  | ✓ `data-theme="dark"` default + `cs-theme` no-flash + `.cs-seg` toggle in served HTML                            |
| WCAG AA                                                            | ✓ 11 text/UI pairs ≥ AA (dark + light), `contrast.ts` test; visible focus ring; `prefers-reduced-motion` honored |
| waitlist: `.strict()` body, `fetchWithTimeout`, secret server-side | ✓ POST → 202 (seam); unknown field → 422; secret absent from `out/`; in-function security headers present        |
| static-asset CSP + security headers (`_headers`)                   | ✓ full CSP + `X-Frame-Options: DENY` applied by the preview                                                      |
| SEO + agent-readable                                               | ✓ `sitemap.xml`, `robots.txt`, OG image, JSON-LD, `llms.txt`/`llms-full.txt`/per-page `content.md`               |
| `terraform` reconciled                                             | ✓ stale next-on-pages note fixed (main.tf + README)                                                              |
| ADR per locked fork (≥0045) + board rows                           | ✓ ADR-0045..0048 + 4 board rows                                                                                  |
| zero hard-coded hex / banned words in `apps/site`                  | ✓ (sole hex exception: the OG raster generator, documented)                                                      |
| no locked decision relitigated                                     | ✓ name/hero/voice/design/framework/hosting all honored                                                           |

**Partial/deferred (by scope, not gaps):** full long-form marketing copy, media/video, first-party
Plausible proxy, CSP script-src hash hardening, live Resend account wiring, and `terraform apply` +
production deploy (the operator-gated DEPLOY act). None block the scaffold goal.
