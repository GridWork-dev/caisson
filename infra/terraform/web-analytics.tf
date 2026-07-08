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
# NOT currently Terraform-managed (no matching resource in terraform.tfstate) — this resource
# ADOPTS the existing dashboard-created site. Before `apply`:
#   1. Find the site id: Cloudflare dashboard → Analytics & Logs → Web Analytics → the caisson.sh
#      site → the id is in the page URL, or list it via
#      `GET /accounts/{account_id}/rum/site_info/list` (account-scoped API token).
#   2. terraform import cloudflare_web_analytics_site.caisson '<account_id>/<site_id>'
#   3. terraform plan — expect only `auto_install`/`enabled` flipping to `false`, nothing else
#      (the `lifecycle.prevent_destroy` below stops an accidental site delete+recreate if the
#      import target is wrong).
# Skipping the import makes `apply` try to CREATE a second Web Analytics site for the same host.
#
# AUTHORING ONLY here: `terraform apply` is a separate operator DEPLOY act (never run inside the
# autonomous cycle — same posture as waf.tf and the docs-api proxy flip in main.tf). Once applied,
# the `KNOWN_NOISE` filter and its explanatory comment in
# apps/site/live/prod-routes.live.test.ts should come out — the beacon will no longer exist to
# filter.
resource "cloudflare_web_analytics_site" "caisson" {
  account_id   = var.cloudflare_account_id
  zone_tag     = var.cloudflare_zone_id
  host         = var.zone_name
  auto_install = false
  enabled      = false

  lifecycle {
    prevent_destroy = true
  }
}
