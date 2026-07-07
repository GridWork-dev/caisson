# Caisson site infrastructure — DNS for caisson.sh. STAGE-2 cutover (ADR-0114/0139): the marketing +
# docs + dashboard app moved from Cloudflare Pages (static export) to a Railway Docker service
# (caisson-site). This module now points DNS at Railway. `access.tf` (the pre-launch Access gate over
# caisson.sh + www) is UNCHANGED — apex/www stay proxied so Access still gates them.
#
# The Railway targets + _railway-verify tokens below are the per-custom-domain values Railway returned
# from `railway domain <name>` (public DNS values, not secrets). Zone SSL mode stays "strict": for the
# proxied apex/www, Cloudflare terminates client TLS with its edge cert for caisson.sh and connects to
# the Railway origin over the *.up.railway.app cert; for grey-cloud license.caisson.sh, Railway issues
# its own Let's Encrypt cert (CAA already allows letsencrypt.org), exactly like docs-api.caisson.sh.

# Cloudflare Pages project (caisson-site) TORN DOWN 2026-07-01 after the Railway cutover soaked:
# apex/www serve from Railway (CNAMEs below), custom domains were detached, then the empty Pages
# project was destroyed. Nothing references it now. (Stage-2 step 10 complete.)

# --- apex + www → caisson-site on Railway (PROXIED so Cloudflare Access still gates, ADR-0107) ---
resource "cloudflare_dns_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CNAME"
  content = "uljabg7n.up.railway.app"
  proxied = true
  ttl     = 1
  comment = "Caisson site (apex → Railway caisson-site) — managed by Terraform"
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.zone_name}"
  type    = "CNAME"
  content = "1sbzv9jz.up.railway.app"
  proxied = true
  ttl     = 1
  comment = "Caisson site (www → Railway caisson-site) — managed by Terraform"
}

# Railway custom-domain ownership proof (read via DNS regardless of proxy) so Railway routes the
# preserved Host header for the proxied apex/www.
resource "cloudflare_dns_record" "apex_railway_verify" {
  zone_id = var.cloudflare_zone_id
  name    = "_railway-verify"
  type    = "TXT"
  content = "railway-verify=4f0ee10f934ae1d0b976dbef64c906e0f76d1cf584cd42b726b3493da9d708aa"
  ttl     = 1
  comment = "Railway custom-domain ownership (apex) — managed by Terraform"
}

resource "cloudflare_dns_record" "www_railway_verify" {
  zone_id = var.cloudflare_zone_id
  name    = "_railway-verify.www"
  type    = "TXT"
  content = "railway-verify=dc37c60b83a6cba8034c2780685b9d5fb7a3266a08a5dede3287b86bb0bcd8df"
  ttl     = 1
  comment = "Railway custom-domain ownership (www) — managed by Terraform"
}

# --- license.caisson.sh → caisson-license on Railway (DNS-only / grey — UNCHANGED by ADR-0219) ---
# NOT proxied + NOT Access-gated: the Paddle Merchant-of-Record webhook endpoint Paddle's servers
# must reach directly. DNS-only lets Railway issue + serve its own cert (docs-api.caisson.sh's OLD
# pattern, before ADR-0219 flipped docs-api to proxied above — license intentionally keeps it).
# ASSERTION (ADR-0219 Fork A(a), hard constraint): `proxied` stays `false` here. Because this
# record never routes through Cloudflare's edge, NO ruleset in waf.tf — WAF managed rules or the
# rate-limit rule — can ever evaluate against a request to this host, regardless of what any rule
# expression matches. This is the mechanism (not a path-expression promise) that keeps Paddle's
# webhook un-rate-limited and un-challenged. Do not flip this to `true` without a new superseding
# ADR (see SPEC-cloudflare-front-rate-limit.md Fork A(b)) and a first-priority Paddle IP skip rule.
resource "cloudflare_dns_record" "license" {
  zone_id = var.cloudflare_zone_id
  name    = "license.${var.zone_name}"
  type    = "CNAME"
  content = "9sk3np1b.up.railway.app"
  proxied = false
  ttl     = 1
  comment = "Caisson license issuer + Paddle webhook (→ Railway caisson-license) — managed by Terraform"
}

resource "cloudflare_dns_record" "license_railway_verify" {
  zone_id = var.cloudflare_zone_id
  name    = "_railway-verify.license"
  type    = "TXT"
  content = "railway-verify=1839aaf6efdfadfa516d00e30cbe7d12cfa8ae1590c48c95b3e3c0ea91a42c65"
  ttl     = 1
  comment = "Railway custom-domain ownership (license) — managed by Terraform"
}

# --- admin.caisson.sh → caisson-admin on Railway (PROXIED — kept orange for CF's WAF/DDoS edge) ---
# The operator control-plane (ADR-0138), gated by its OWN in-app GitHub OAuth + numeric-id
# allowlist (ADR-0283 — supersedes the CF-Access-alone posture of ADR-0140; the app is its own
# gate now, no separate Access application/policy for admin.caisson.sh in access.tf).
resource "cloudflare_dns_record" "admin" {
  zone_id = var.cloudflare_zone_id
  name    = "admin.${var.zone_name}"
  type    = "CNAME"
  content = "or2ptvy0.up.railway.app"
  proxied = true
  ttl     = 1
  comment = "Caisson admin control-plane (admin → Railway caisson-admin) — managed by Terraform"
}

resource "cloudflare_dns_record" "admin_railway_verify" {
  zone_id = var.cloudflare_zone_id
  name    = "_railway-verify.admin"
  type    = "TXT"
  content = "railway-verify=23f1ec9133c0dfe19383db6c6e90d6f55faf1eaed7c46075eba08a1ebe299f58"
  ttl     = 1
  comment = "Railway custom-domain ownership (admin) — managed by Terraform"
}

# --- docs-api.caisson.sh → caisson-docs on Railway (PROXIED — ADR-0219 CF-1, Fork A(a)) ---
# Flipped from grey/DNS-only to proxied so the WAF Free Managed Ruleset + the expensive-path
# rate-limit rule (waf.tf) front /query. This is the ONLY host this SPEC flips: license.caisson.sh
# stays grey below, deliberately untouched — its grey/DNS-only posture is what keeps Paddle's
# webhook out of CF's path entirely (no rule expression can ever see traffic that never reaches
# the edge). Do not add proxied/Access/ruleset config for license as part of this change.
#
# This record previously lived outside tracked terraform (see README.md "Current state" /
# ADR-0219 §Current state) — before `apply`, either `terraform import` the existing record:
#   terraform import cloudflare_dns_record.docs_api '<zone_id>/<existing-record-id>'
# (record ID from the Cloudflare dashboard → DNS → docs-api CNAME, or the DNS records list API)
# or delete the existing record first. Skipping this makes `apply` try to CREATE a record that
# already exists and it will conflict on the duplicate CNAME name.
resource "cloudflare_dns_record" "docs_api" {
  zone_id = var.cloudflare_zone_id
  name    = "docs-api.${var.zone_name}"
  type    = "CNAME"
  content = var.docs_api_railway_target
  proxied = true
  ttl     = 1
  comment = "Caisson docs API - Railway caisson-docs - Terraform-managed (ADR-0219 proxied)"
}

resource "cloudflare_dns_record" "docs_api_railway_verify" {
  zone_id = var.cloudflare_zone_id
  name    = "_railway-verify.docs-api"
  type    = "TXT"
  content = var.docs_api_railway_verify_txt
  ttl     = 1
  comment = "Railway custom-domain ownership (docs-api) — managed by Terraform"
}
