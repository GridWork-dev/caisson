# RFC 7489 §7.1 external-destination authorization for cross-domain DMARC reporting.
#
# caisson.sh's DMARC record (email.tf) sends aggregate reports to admin@gridwork.dev — a
# DIFFERENT organizational domain. Receivers (Gmail, Microsoft, Yahoo) verify the destination
# consents before delivering: they query `caisson.sh._report._dmarc.gridwork.dev` and drop the
# report silently if no `v=DMARC1` TXT answers. That record was missing (found by the
# 2026-07-17 audit follow-up sweep, P2 — aggregate reports likely never delivered), so DMARC
# monitoring for caisson.sh was blind. gridwork.dev is on the same Cloudflare account
# (houston/sarah NS), reached here via a zone lookup rather than a second zone_id variable.
data "cloudflare_zones" "gridwork_dev" {
  name = "gridwork.dev"
}

resource "cloudflare_dns_record" "gridwork_dev_dmarc_report_authz" {
  zone_id = data.cloudflare_zones.gridwork_dev.result[0].id
  name    = "caisson.sh._report._dmarc.gridwork.dev"
  type    = "TXT"
  content = "v=DMARC1"
  ttl     = 1
  comment = "Authorize caisson.sh DMARC reports to admin@gridwork.dev (RFC 7489 s7.1) — caisson Terraform"
}
