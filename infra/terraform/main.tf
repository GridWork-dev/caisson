# Caisson site infrastructure — Cloudflare Pages + DNS for caisson.sh.
# The zone already exists on Cloudflare (referenced by id); this module owns the Pages project,
# its custom domains, and the DNS records that point at it. Data (Neon) is reached over HTTP and
# is provisioned outside this module.

# The Pages project for the marketing + docs site. Direct-upload model (deploy via Wrangler/CI),
# so no `source` (Git-integration) block. Build + deployment config (compatibility_date, the
# next-on-pages / OpenNext output dir) is wired here once the site app exists.
resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.production_branch
}

# Custom domains on the project (apex + www). Cloudflare issues the edge certificate once the
# matching DNS records below validate.
resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = var.zone_name
}

resource "cloudflare_pages_domain" "www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  name         = "www.${var.zone_name}"
}

# DNS → the Pages project, proxied (orange-cloud). Apex relies on CNAME flattening.
# ttl = 1 means automatic (TTL is ignored for proxied records).
resource "cloudflare_dns_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CNAME"
  content = "${cloudflare_pages_project.site.name}.pages.dev"
  proxied = true
  ttl     = 1
  comment = "Caisson site (apex → Pages) — managed by Terraform"
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www.${var.zone_name}"
  type    = "CNAME"
  content = "${cloudflare_pages_project.site.name}.pages.dev"
  proxied = true
  ttl     = 1
  comment = "Caisson site (www → Pages) — managed by Terraform"
}
