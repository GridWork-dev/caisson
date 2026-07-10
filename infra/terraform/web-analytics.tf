# Disable Cloudflare's zone-level Web Analytics (RUM) auto-injection (CAISSON-51, and — per the
# live evidence below — CAISSON-50).
#
# What's happening today: the caisson.sh zone has a Cloudflare Web Analytics "site" configured
# with automatic setup (dashboard-created, NOT under Terraform — no `cloudflare_web_analytics_site`
# exists in this module's state). Automatic setup makes Cloudflare's edge append a
# `<script defer src="https://static.cloudflareinsights.com/beacon.min.js/...">` tag as the literal
# last child of `<body>` on a sampled subset of real-browser HTML responses (confirmed live
# 2026-07-08: present on a `/login` fetch with browser-realistic headers, absent on a same-session
# `/` fetch — auto-injection is NOT deterministic per route, it's sampled per request). We already
# run Plausible (cookieless, ADR-0118) as the actual analytics stack, so this beacon does nothing
# useful — and it is a genuine problem, not just noise:
#   1. CAISSON-51: the site's own CSP `script-src` (next.config.ts) does not allow
#      static.cloudflareinsights.com, so the browser blocks the load and logs a console error on
#      every page it lands on.
#   2. CAISSON-50: because the injected `<script>` lands OUTSIDE React's own rendered tree (added
#      to the raw HTML stream after our server already sent its response), React's hydration walk
#      over `document` finds an unexpected extra node and throws minified error #418 (args
#      `["HTML", ""]` — a root-level `<html>`/`<body>` mismatch). Reproduced live on `/login`
#      twice, and NEVER reproduced against the same code path with Cloudflare out of the path
#      (local dev / `next start` / the real standalone `server.js`, 8-iteration loop, all clean) —
#      the injected script is the root cause, not application code. It's sampled, which also
#      explains why only some prod-routes.live.test.ts runs (and only some routes within a run)
#      show it.
#
# Disabling auto-injection at the zone fixes BOTH tickets at the root: no injected node, no CSP
# violation, no extra `<body>` child for React to trip over on hydration.
#
# APPLIED 2026-07-09 (operator-approved). The import + `auto_install = false` apply landed
# 2026-07-08 — and DID NOT stop the injection: the site's underlying injection ruleset
# (`ruleset.enabled` on the RUM site object) stayed `true`, and the beacon kept landing on every
# real-browser page (the 2026-07-09 714-shot harness saw its CSP error on 100% of non-email
# shots). `auto_install` alone is NOT the mechanism, despite the provider docs' framing — the
# `enabled` field is what pauses the deployed ruleset, and the RUM API accepts
# `{"auto_install": false, "enabled": false}` together without complaint (proven live via
# `PUT /accounts/{account_id}/rum/site_info/{site_tag}`: `ruleset.enabled` flipped to `false` and
# the beacon disappeared from /login, /, /pricing, /reset-password, /glossary, /marketplace on
# immediate re-probe). Both fields are therefore pinned `false` below so a future apply can never
# silently revert the flip. The `KNOWN_NOISE` beacon filter in
# apps/site/live/prod-routes.live.test.ts was removed in the same change — any beacon signal that
# sweep sees now is a real regression (the ruleset got re-enabled).
resource "cloudflare_web_analytics_site" "caisson" {
  account_id   = var.cloudflare_account_id
  zone_tag     = var.cloudflare_zone_id
  host         = var.zone_name
  auto_install = false
  # Pauses the deployed zone-level injection ruleset — the field that actually stops the beacon
  # (see header; `auto_install = false` alone demonstrably did not).
  enabled = false

  lifecycle {
    prevent_destroy = true
  }
}
