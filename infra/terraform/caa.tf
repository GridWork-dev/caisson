# CAA records for caisson.sh — pin which CAs may issue certificates for the zone.
# Three CAs, issue + issuewild each: Let's Encrypt (Railway/CF edge certs), Google Trust
# Services (pki.goog — Cloudflare's default edge CA partner), SSL.com. Created by hand in the
# CF console before this module existed; adopted via `terraform import` 2026-07-16 (the same
# hygiene pass that imported email.tf — see README.md "Email deliverability" for the runbook
# pattern). No `comment` fields on purpose: the live records carry none, and matching live
# exactly keeps `plan` clean.
#
# NOTE (registry.caisson.sh AAAA): the one other live DNS record with no terraform resource is
# registry.caisson.sh AAAA 100:: — that is Cloudflare's OWN custom-domain record for the
# caisson-registry Worker (Workers custom domains auto-manage their DNS). It is expected to be
# absent from terraform; do not import or declare it.

resource "cloudflare_dns_record" "caa_letsencrypt_issue" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "letsencrypt.org"
  }
}

resource "cloudflare_dns_record" "caa_letsencrypt_issuewild" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issuewild"
    value = "letsencrypt.org"
  }
}

resource "cloudflare_dns_record" "caa_pki_goog_issue" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "pki.goog"
  }
}

resource "cloudflare_dns_record" "caa_pki_goog_issuewild" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issuewild"
    value = "pki.goog"
  }
}

resource "cloudflare_dns_record" "caa_ssl_com_issue" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issue"
    value = "ssl.com"
  }
}

resource "cloudflare_dns_record" "caa_ssl_com_issuewild" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "CAA"
  ttl     = 1
  data = {
    flags = 0
    tag   = "issuewild"
    value = "ssl.com"
  }
}
