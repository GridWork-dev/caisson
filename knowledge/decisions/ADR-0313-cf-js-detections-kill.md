# ADR-0313 — Cloudflare JS-detections (Bot Fight Mode script) killed at the zone

- **Status:** locked (operator pick, 2026-07-10 perf/mobile picker)
- **Context:** the ADR-0309 error-level lighthouse evidence (run 29072745113) attributed
  676ms of every page's bootup CPU to Cloudflare's injected
  `/cdn-cgi/challenge-platform/scripts/jsd/main.js` (the Bot-Fight-Mode/JS-detections
  script) — roughly half the homepage TBT — plus the best-practices cap at 0.78 (the script
  fails the `deprecations` and `inspector-issues` audits for every visitor). Same
  zone-injection class as the CAISSON-50 RUM beacon, which was root-killed via terraform.

## Decision

Turn zone JS-detections/Bot Fight Mode **off**, pinned in terraform (`infra/terraform/`,
alongside the web-analytics beacon kill) so a dashboard toggle cannot silently re-arm it.

Pre-launch posture holds without it: commerce surfaces sit behind CF-Access (ADR-0303), the
edge rate-limits are terraformed and 429-proven (CAISSON-15), and the WAF managed rulesets
stay on. **Re-arm trigger:** real bot pressure at/after launch (scraping, credential
stuffing, form abuse) — re-enable in the same terraform file with a superseding ADR.

After the kill is live-verified (the `challenge-platform` script absent from served pages),
the lighthouse best-practices floor returns 0.75 → 0.9 in `apps/site/lighthouserc.json`
(the 0.75 floor existed only to name this cap).

## Consequences

Recovers ~676ms TBT on every page and most of the best-practices category; loses the
bot-scoring signal while off. The perf gate stops carrying a documented third-party excuse —
reds become entirely page-owned.
