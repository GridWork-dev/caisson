# Zone Bot Management — Bot Fight Mode + JS Detections KILLED (ADR-0313, 2026-07-10).
#
# WHY: the first error-level Lighthouse evidence (ADR-0309, run 29072745113) attributed 676ms
# of EVERY page's bootup CPU to the injected /cdn-cgi/challenge-platform/scripts/jsd/main.js
# (Bot-Fight-Mode JS detections) — about half the homepage TBT — plus the best-practices cap
# at 0.78 (the script fails the `deprecations` + `inspector-issues` audits for every visitor).
# Same zone-injection class as the CAISSON-50 RUM beacon killed in web-analytics.tf; pinned
# here so a dashboard toggle cannot silently re-arm it.
#
# ai_bots_protection: the zone was found set to "block" (dashboard default), which BLOCKS AI
# crawlers — directly contradicting ADR-0303 (marketing/docs/llms.txt made public precisely so
# AI engines can index the site) and the whole AEO program. Set to "disabled" to align with
# the ADR-0303 posture. The finer-grained ai_training/ai_search/ai_user fields were already
# "disabled" on the zone.
#
# RE-ARM TRIGGER (ADR-0313): real bot pressure at/after launch (scraping, credential stuffing,
# form abuse) — flip fight_mode/enable_js back with a superseding ADR. Pre-launch posture holds
# without it: CF-Access gates commerce (ADR-0303), the edge rate-limits in waf.tf are
# 429-proven (CAISSON-15), and the WAF managed rulesets stay on.
#
# Singleton per zone — import before first apply:
#   terraform import cloudflare_bot_management.caisson 6bd5c8b1a404cbb7522e064872bf4c09
# Token scope: the API token needs Zone → Bot Management → Edit (add in the CF dashboard
# BEFORE apply, same drill as the WAF rulesets in versions.tf).
resource "cloudflare_bot_management" "caisson" {
  zone_id = var.cloudflare_zone_id

  fight_mode         = false
  enable_js          = false
  ai_bots_protection = "disabled"
}
