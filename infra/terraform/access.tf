# --- Cloudflare Access: pre-launch gate -------------------------------------------------------
# The site is fully provisioned + deployed, but PRIVATE until launch: caisson.sh + www are served
# behind Cloudflare Access, and every visitor must authenticate as a @gridwork.dev operator via
# email one-time PIN (the built-in `onetimepin` IdP — no OAuth setup needed). At go-live, remove
# ONLY the `site_gate` policy/application below (or flip `site_gate`'s policy to a `bypass`/
# `everyone` include). Go-live posture: ADR-0082.
#
# admin.caisson.sh's own CF-Access application/policy (formerly here, ADR-0138/0140) was REMOVED
# by ADR-0283 — the admin control-plane gates itself now (in-app GitHub OAuth + a numeric-id
# allowlist), so there is no separate admin Access resource in this file to avoid touching.
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

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.site_gate.id
      precedence = 1
    },
    {
      id         = cloudflare_zero_trust_access_policy.site_gate_service_auth.id
      precedence = 2
    },
  ]
}

# --- E2E prober service token -------------------------------------------------------------------
# Lets the automated Playwright/live-verification harness reach the GATED prod site without
# weakening the human gate: the OTP policy above stays untouched; only requests carrying this
# token's `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers pass, via Service Auth
# (decision "non_identity"). Rotate by tainting the token resource; the paired env vars live in
# ~/.gridwork/caisson.env (CAISSON_E2E_CF_CLIENT_ID / CAISSON_E2E_CF_CLIENT_SECRET).
resource "cloudflare_zero_trust_access_service_token" "e2e_prober" {
  account_id = var.cloudflare_account_id
  name       = "caisson-e2e-prober"
}

resource "cloudflare_zero_trust_access_policy" "site_gate_service_auth" {
  account_id = var.cloudflare_account_id
  name       = "Caisson site - e2e prober service token"
  decision   = "non_identity"
  include = [{
    service_token = {
      token_id = cloudflare_zero_trust_access_service_token.e2e_prober.id
    }
  }]
}

output "e2e_prober_client_id" {
  value       = cloudflare_zero_trust_access_service_token.e2e_prober.client_id
  sensitive   = true
  description = "CF-Access-Client-Id header value for the e2e prober."
}

output "e2e_prober_client_secret" {
  value       = cloudflare_zero_trust_access_service_token.e2e_prober.client_secret
  sensitive   = true
  description = "CF-Access-Client-Secret header value for the e2e prober."
}

output "site_access_app_id" {
  value       = cloudflare_zero_trust_access_application.site_gate.id
  description = "Cloudflare Access application gating the pre-launch site (caisson.sh + www)."
}
