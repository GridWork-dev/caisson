variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token: Zone:DNS:Edit + Account:Cloudflare Pages:Edit + Account:Access(Apps and Policies):Edit + Zone:WAF:Edit (ADR-0219, for the cloudflare_ruleset resources in waf.tf) on the caisson.sh zone/account."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the caisson.sh zone + Pages project."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID for caisson.sh (Cloudflare dashboard → caisson.sh → Overview → Zone ID). The .sh registration is external; the zone is hosted on Cloudflare."
}

variable "zone_name" {
  type        = string
  default     = "caisson.sh"
  description = "Apex domain."
}

# --- ADR-0219 (CF front rate-limit + WAF, Fork A(a): flip docs-api to proxied, license stays grey) ---

variable "docs_api_railway_target" {
  type        = string
  description = <<-EOT
    Railway-issued CNAME target for the caisson-docs service (the same kind of value as the
    literal `content` fields on the apex/www/admin records above, e.g. "xxxxxxxx.up.railway.app").
    docs-api.caisson.sh was provisioned directly against Railway before this DNS record was
    brought under Terraform (infra/terraform/README.md "Current state") — read the current value
    from the Cloudflare dashboard (DNS > docs-api CNAME) or `railway domain` on caisson-docs
    before apply. No default on purpose: guessing this value risks a wrong CNAME.
  EOT
}

variable "docs_api_railway_verify_txt" {
  type        = string
  description = <<-EOT
    Railway custom-domain ownership TXT value for docs-api (same _railway-verify.<host> pattern
    as apex/www/admin/license below). Read the current value from the Cloudflare dashboard or
    `railway domain` on caisson-docs before apply.
  EOT
}

variable "rate_limit_requests_per_period" {
  type        = number
  default     = 150
  description = "Requests allowed per counting window before the expensive-path rate-limit rule blocks (Free tier: window is fixed at 10s, see waf.tf). Sized for the largest legitimate burst: a full everything-bundle install is ~46 packages x (packument + tarball) = ~92 concurrent registry requests from one IP (bun's default network concurrency is 48, so they land inside one window), plus retry headroom (CAISSON-87). Known caveat: the key is (colo, ip.src), so multiple buyers behind one corporate/VPN egress IP share the counter — two simultaneous everything installs (~184) would trip it, degrading to a retried install (429 plus Retry-After), never a hard fail; raise toward 200-250 if telemetry shows NAT'd buyers hitting it. Raising this also loosens /query and /api/auth/* — the one Free rule shares its threshold across all matched paths."
}

# --- Email deliverability (email.tf) ---

variable "dmarc_rua_cloudflare_token" {
  type        = string
  default     = ""
  description = <<-EOT
    Cloudflare DMARC Management report-ingest token, folded into the _dmarc TXT record's `rua=`
    list ahead of admin@gridwork.dev when set. Empty by default (the record then carries only the
    admin@gridwork.dev rua, matching what's live today). To obtain it: enable DMARC Management
    once for this zone — either the dashboard toggle, or `PATCH
    /zones/{zone_id}/email/auth/dmarc-reports {"enabled":true}` — then read the 32-hex token
    either from the zone's own _dmarc record (Cloudflare appends
    mailto:<token>@dmarc-reports.cloudflare.net to it once enabled) or from `GET
    /zones/{zone_id}/email/auth/dmarc-reports`. See README.md "Email deliverability" for the full
    runbook.
  EOT
}
