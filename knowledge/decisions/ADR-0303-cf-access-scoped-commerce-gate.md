# ADR-0303 — CF-Access gate scoped to the commerce surface (public-read marketing/docs pre-launch)

- **Status:** accepted (operator-locked 2026-07-10, close-out fork round 1)
- **Domain:** Infra / GTM
- **Chain:** amends the A2 fork lock ("keep gated until real checkout works") and ADR-0082's
  gate posture; executes the 2026-07-09 AEO audit's top finding
  (`outputs/research/aeo-audit-2026-07-09.md`); go-live still removes the gate entirely per the
  launch runbook.

## Decision

The pre-launch Cloudflare Access `site_gate` application narrows from the whole apex + www
hosts to the **commerce/buyer-private surface only**: `caisson.sh/dashboard*`, `/cart*` (and the
www equivalents). Everything else — marketing, marketplace, compare, docs, glossary, legal,
`llms.txt`/`llms-full.txt`/`robots.txt`/`sitemap.xml`, and `/api` — serves publicly,
pre-launch.

## Why

The 2026-07-09 AEO citation audit measured **zero** AI-engine citations of caisson anywhere
(0/9 cross-vendor probes, 0/~40 SERP results, an empty Exa index for the domain) with a single
root cause: the full-host gate served the Access login page to every crawler, llms.txt and
robots.txt included. Every gated week is index/citation time lost to competitors while the AEO
surface itself (llms.txt, JSON-LD, sitemap) is already built and excellent. The original A2
rationale ("don't show a buyable site whose checkout isn't real") is preserved at the exact
seam where money would change hands: buy CTAs land on the **gated** `/cart`, so a visitor can
read everything and purchase nothing.

## Shape

- `infra/terraform/access.tf`: `site_gate` destinations = the four host/path entries above;
  the OTP allow policy + the e2e-prober service-token policy ride unchanged on the narrowed app.
- `/api` is deliberately public: every route self-protects per `identity/security.md`
  (Bearer/session at route level, strix round-1 tested), and gating it would 302 the sitewide
  `GET /api/auth/get-session` fetch that fires on every public page render.
- Go-live delta shrinks: the CF-Access flip in the launch runbook now removes only the
  dashboard/cart gate (buyer auth already lives in better-auth).

## Consequences

- AI/search indexing starts pre-launch; the directory-listing batch's trigger ("CF gate drops")
  is PARTIALLY fired — held until checkout is production-real per its own row.
- The public site shows committed prices with a checkout that cannot complete for visitors —
  accepted deliberately by the operator over the audit's evidence.
- Auth pages (`/login`, `/forgot-password`, `/reset-password`) are public; they were built for
  public exposure at launch and better-auth already rate-limits/validates.
