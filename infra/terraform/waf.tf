# Cloudflare edge WAF + rate-limiting for the Railway fleet (ADR-0219, CF-2: Free tier).
#
# Scope: these rulesets are ZONE-level (kind = "zone"), so Cloudflare only ever evaluates them
# for a request that already reached its edge — i.e. only for the PROXIED hosts (caisson.sh,
# www.caisson.sh, admin.caisson.sh, docs-api.caisson.sh — main.tf). `license.caisson.sh` stays
# `proxied = false` (grey/DNS-only, main.tf) precisely so its traffic — including Paddle's
# webhook POSTs to `/webhook` — never reaches Cloudflare's edge and therefore can NEVER be
# matched, rate-limited, or challenged by anything in this file. No rule expression below
# references `/webhook` or the license host; that omission is deliberate and load-bearing, not
# an oversight — do not add one without a new ADR (see main.tf's license resource comment).
#
# Free plan constraints driving both rulesets (SPEC-cloudflare-front-rate-limit.md §1, verified
# live 2026-07-02): 1 rate-limit rule per zone, no `http.host` match field (path-only — safe here
# because /query and /api/auth/* are zone-unique paths today), fixed 10s counting window, and the
# Free Managed Ruleset only (not the full Cloudflare Managed Ruleset — that needs Pro+).
#
# Both resources require CLOUDFLARE_API_TOKEN to carry Zone:WAF:Edit (versions.tf) — absent that
# scope, `apply` 403s. AUTHORING ONLY here: `terraform apply` is a separate operator DEPLOY act.

# --- WAF: Cloudflare Free Managed Ruleset (baseline CVE protection, $0 on every plan) ---
# Applies to all proxied traffic on the zone (apex/www/admin/docs-api). Declared explicitly
# (rather than relying on Cloudflare's dashboard-default deployment) so it's tracked + drift-
# checked like every other resource here. If the zone already has an implicit entry-point
# ruleset for this phase, `terraform import` it first (same caveat as docs-api in main.tf):
#   terraform import cloudflare_ruleset.waf_free_managed '<zone_id>/<existing-ruleset-id>'
resource "cloudflare_ruleset" "waf_free_managed" {
  zone_id     = var.cloudflare_zone_id
  name        = "Caisson zone WAF — Free Managed Ruleset"
  description = "Baseline high-severity CVE protection (ADR-0219 CF-2, Free tier). Upgrade path: swap in the full Cloudflare Managed Ruleset id if/when Fork B lands Pro."
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [{
    ref         = "execute_cloudflare_free_managed_ruleset"
    description = "Execute the Cloudflare Free Managed Ruleset for all incoming zone traffic"
    expression  = "true"
    action      = "execute"
    action_parameters = {
      # Cloudflare Free Managed Ruleset — available on every plan (Free included).
      # https://developers.cloudflare.com/waf/managed-rules/ "Available managed rulesets"
      id = "77454fe2d30c4220b5701f6fdfb893ba"
    }
  }]
}

# --- Rate limit: the single Free-tier expensive-path rule ---
# Free allows exactly one http_ratelimit rule per zone with no host-field disambiguation, so both
# origin-$/abuse targets from the SPEC's Design §3 "Expensive-path rule" share one rule/threshold:
#   - /query          (services/docs  — OpenRouter embedding spend, docs-api.caisson.sh)
#   - /api/auth/*     (apps/site      — better-auth login, currently zero rate limiting anywhere)
# Zero-headroom note (SPEC Risk 1): a future service reusing either path on another proxied host
# would silently widen this rule's blast radius — there is no 2nd Free rule to isolate it, and no
# `http.host` field to scope this one. Re-evaluate at Fork B (Pro) if that happens.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "Caisson zone rate limiting — expensive paths (Free tier)"
  description = "Edge-side complement to the in-process X-Real-IP limiters (ADR-0204); the only layer that stays correct across a multi-replica deploy. ADR-0219 CF-2."
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [{
    ref         = "rl_expensive_paths"
    description = "Rate limit /query (docs embedding spend) and /api/auth/* (site login) by source IP"
    expression  = "(http.request.uri.path eq \"/query\") or (http.request.uri.path matches \"^/api/auth/\")"
    action      = "block"
    ratelimit = {
      characteristics = ["cf.colo.id", "ip.src"]
      # Free plan supports only a fixed 10s counting window (SPEC §1 plan-tier table) — not
      # tunable; do not turn this into a variable until Fork B upgrades the plan.
      period              = 10
      requests_per_period = var.rate_limit_requests_per_period
      mitigation_timeout  = var.rate_limit_mitigation_timeout_seconds
    }
  }]
}
