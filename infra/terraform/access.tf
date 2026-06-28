# --- Cloudflare Access: pre-launch gate -------------------------------------------------------
# The site is fully provisioned + deployed, but PRIVATE until launch: caisson.sh + www are served
# behind Cloudflare Access, and every visitor must authenticate as a @gridwork.dev operator via
# email one-time PIN (the built-in `onetimepin` IdP — no OAuth setup needed). At go-live, remove
# this gate (or flip the policy to a `bypass`/`everyone` include). Go-live posture: ADR-0082.
#
# Limitation: a self-hosted Access app can only cover hostnames in a zone this account owns, so the
# Pages origin URL `caisson-site.pages.dev` cannot be gated here (Cloudflare API error 12130
# "domain does not belong to zone"). The canonical public surface is the proxied, gated caisson.sh;
# the pages.dev origin stays reachable + unlisted (don't advertise it). To also seal pages.dev,
# enable the Pages project's native Access integration in the Zero Trust dashboard.

variable "site_access_email_domain" {
  type        = string
  default     = "gridwork.dev"
  description = "Email domain allowed through the pre-launch Access gate (operator + team), via email OTP."
}

# Reusable allow-policy: anyone with a @<site_access_email_domain> email, verified by one-time PIN.
resource "cloudflare_zero_trust_access_policy" "site_gate" {
  account_id = var.cloudflare_account_id
  name       = "Caisson site - pre-launch operators (${var.site_access_email_domain})"
  decision   = "allow"
  include = [{
    email_domain = {
      domain = var.site_access_email_domain
    }
  }]
}

# Self-hosted Access application over the apex + www custom domains.
resource "cloudflare_zero_trust_access_application" "site_gate" {
  account_id           = var.cloudflare_account_id
  name                 = "Caisson site (pre-launch gate)"
  type                 = "self_hosted"
  session_duration     = "24h"
  app_launcher_visible = false

  destinations = [
    { type = "public", uri = var.zone_name },
    { type = "public", uri = "www.${var.zone_name}" },
  ]

  policies = [{
    id         = cloudflare_zero_trust_access_policy.site_gate.id
    precedence = 1
  }]
}

output "site_access_app_id" {
  value       = cloudflare_zero_trust_access_application.site_gate.id
  description = "Cloudflare Access application gating the pre-launch site (caisson.sh + www)."
}
