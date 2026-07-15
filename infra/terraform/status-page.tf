# Better Stack public status page custom domain (ADR-0348).
# The page itself lives in Better Stack (id 255425, vendor URL caisson.betteruptime.com);
# this CNAME makes it reachable at status.caisson.sh. Must stay DNS-only (proxied = false):
# Better Stack terminates TLS for custom status-page domains and a proxied record breaks
# their cert issuance (per betterstack.com/docs/uptime/custom-subdomain/).
resource "cloudflare_dns_record" "status_page" {
  zone_id = var.cloudflare_zone_id
  name    = "status.${var.zone_name}"
  type    = "CNAME"
  content = "statuspage.betteruptime.com"
  proxied = false
  ttl     = 1
  comment = "Better Stack status page (id 255425) — managed by Terraform"
}
