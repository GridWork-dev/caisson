terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Token-scoped auth (never an account-wide key). Source it from the environment as
# CLOUDFLARE_API_TOKEN, or pass -var. Needs: Zone:DNS:Edit + Account:Cloudflare Pages:Edit +
# Zone:WAF:Edit (ADR-0219 — required for the cloudflare_ruleset resources in waf.tf; widen the
# token in the CF dashboard BEFORE apply or cloudflare_ruleset 403s).
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
