# Email deliverability DNS for caisson.sh — SPF/DKIM/DMARC across the two mail paths this zone
# actually sends through: Proton Mail (the business mailbox, admin@/founder mail) and Resend (the
# product's transactional sender, ADR-0324). Resend rides Amazon SES infrastructure:
# send.caisson.sh is Resend's custom MAIL-FROM (return-path) subdomain, so it carries its own
# amazonses SPF + feedback MX — envelope-from alignment without touching the apex's reputation.
#
# EVERY record below already exists live in the zone (hand-created before this module existed) —
# see README.md "Email deliverability" for the mandatory `terraform import` adoption runbook.
# Skipping it makes `apply` try to CREATE duplicates of records that are already live and serving
# mail; `plan` will show a create for any resource here that wasn't imported first.

# --- apex (caisson.sh) SPF — authorizes Proton's outbound relay to send as @caisson.sh ---
# DKIM/SPF/DMARC alignment is what keeps mail out of spam: SPF lists which servers may claim to
# send from this domain, DKIM (below) proves the message wasn't altered in transit, DMARC (below)
# tells receivers what to do when either check fails.
resource "cloudflare_dns_record" "apex_spf" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "TXT"
  content = "v=spf1 include:_spf.protonmail.ch ~all"
  ttl     = 1
  comment = "Apex SPF — authorizes Proton Mail's servers to send as @caisson.sh — managed by Terraform"
}

# Proton's one-time domain-ownership proof (not a rotating value — Proton never asks for a re-verify
# once this is live, so this record is stable, unlike the DKIM CNAMEs which Proton could rotate).
resource "cloudflare_dns_record" "apex_protonmail_verification" {
  zone_id = var.cloudflare_zone_id
  name    = var.zone_name
  type    = "TXT"
  content = "protonmail-verification=aab8126030ce667a8f7991e315faf0022eab0260"
  ttl     = 1
  comment = "Proton Mail domain-ownership verification — managed by Terraform"
}

# --- apex MX — routes inbound mail for @caisson.sh to Proton's servers (primary + backup) ---
resource "cloudflare_dns_record" "apex_mx_primary" {
  zone_id  = var.cloudflare_zone_id
  name     = var.zone_name
  type     = "MX"
  content  = "mail.protonmail.ch"
  priority = 10
  ttl      = 1
  comment  = "Proton Mail primary MX for @caisson.sh — managed by Terraform"
}

resource "cloudflare_dns_record" "apex_mx_secondary" {
  zone_id  = var.cloudflare_zone_id
  name     = var.zone_name
  type     = "MX"
  content  = "mailsec.protonmail.ch"
  priority = 20
  ttl      = 1
  comment  = "Proton Mail backup MX for @caisson.sh — managed by Terraform"
}

# --- Proton DKIM (3 keys — Proton rotates across protonmail/protonmail2/protonmail3 selectors) ---
# Each CNAME points the selector at Proton's own DNS, where Proton hosts + rotates the actual RSA
# public key without needing a Terraform change here. All three must be present for Proton's DKIM
# signing to validate — a receiver checks whichever selector the outbound message's signature names.
resource "cloudflare_dns_record" "protonmail_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "protonmail._domainkey.${var.zone_name}"
  type    = "CNAME"
  content = "protonmail.domainkey.dpnkcxij2y26fx2xmxsdwzlqutupneadexvc63ppvw3iooark5igq.domains.proton.ch"
  proxied = false
  ttl     = 1
  comment = "Proton Mail DKIM selector 1 (delegated to Proton's DNS) — managed by Terraform"
}

resource "cloudflare_dns_record" "protonmail2_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "protonmail2._domainkey.${var.zone_name}"
  type    = "CNAME"
  content = "protonmail2.domainkey.dpnkcxij2y26fx2xmxsdwzlqutupneadexvc63ppvw3iooark5igq.domains.proton.ch"
  proxied = false
  ttl     = 1
  comment = "Proton Mail DKIM selector 2 (delegated to Proton's DNS) — managed by Terraform"
}

resource "cloudflare_dns_record" "protonmail3_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "protonmail3._domainkey.${var.zone_name}"
  type    = "CNAME"
  content = "protonmail3.domainkey.dpnkcxij2y26fx2xmxsdwzlqutupneadexvc63ppvw3iooark5igq.domains.proton.ch"
  proxied = false
  ttl     = 1
  comment = "Proton Mail DKIM selector 3 (delegated to Proton's DNS) — managed by Terraform"
}

# --- Resend DKIM — signs transactional/dashboard mail sent via Resend from the apex ---
# Unlike Proton's delegated CNAMEs, Resend's key is a literal RSA public key TXT record: no
# rotation delegation, so if Resend ever rotates this key the new value has to land here by hand.
resource "cloudflare_dns_record" "resend_dkim" {
  zone_id = var.cloudflare_zone_id
  name    = "resend._domainkey.${var.zone_name}"
  type    = "TXT"
  content = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQChnK/KAAdZEAT3609FcGWvcodr/CO5h9s/J0VABza+BLBRpRL+h+WHDtNgETJd2MXJOWceB7T985l75YpaGQI8B8+IfYRa0Ey9tiQU4Zhq4abCQ5KVTCLNoAq3TyGMwoECBhHLykeuej7ih7L3P7a6Nvm34nMzCtW+UGvKik2ttwIDAQAB"
  ttl     = 1
  comment = "Resend DKIM key (dashboard/app mail signing) — managed by Terraform"
}

# --- send.caisson.sh — Resend's custom MAIL-FROM (return-path) subdomain, riding Amazon SES ---
# The envelope-from of Resend transactional mail is @send.caisson.sh: its own SPF authorizes SES,
# and the MX receives SES bounce/complaint feedback — keeping envelope alignment and feedback off
# the apex's SPF/DKIM/DMARC reputation.
resource "cloudflare_dns_record" "send_spf" {
  zone_id = var.cloudflare_zone_id
  name    = "send.${var.zone_name}"
  type    = "TXT"
  content = "v=spf1 include:amazonses.com ~all"
  ttl     = 1
  comment = "SES feedback subdomain SPF — managed by Terraform"
}

resource "cloudflare_dns_record" "send_mx" {
  zone_id  = var.cloudflare_zone_id
  name     = "send.${var.zone_name}"
  type     = "MX"
  content  = "feedback-smtp.us-east-1.amazonses.com"
  priority = 10
  ttl      = 1
  comment  = "SES feedback subdomain MX (bounce/complaint ingest) — managed by Terraform"
}

# --- DMARC policy for caisson.sh ---
# p=quarantine/sp=quarantine (not p=reject) is deliberate: quarantine routes SPF/DKIM failures to
# spam instead of hard-rejecting them, while `rua` reports keep landing so misconfigurations show
# up before a mail path is cut off outright. Tightening to p=reject is a later, deliberate step —
# only after DMARC reports have been watched for a while and every legitimate sender aligns clean.
#
# rua always includes admin@gridwork.dev; when dmarc_rua_cloudflare_token is set, Cloudflare's free
# zone-level DMARC Management report ingest (mailto:<token>@dmarc-reports.cloudflare.net) is folded
# in FIRST. That feature is enabled out-of-band (PATCH /zones/{zone_id}/email/auth/dmarc-reports —
# see README.md) and would otherwise have Cloudflare's system silently rewrite this same DNS record
# to append its own rua — since Terraform is the declared owner of this record's full content, the
# token is threaded through a variable instead, so Terraform's plan never fights Cloudflare's
# rewrite (or reverts it on the next apply).
resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc.${var.zone_name}"
  type    = "TXT"
  content = var.dmarc_rua_cloudflare_token != "" ? "v=DMARC1; p=quarantine; sp=quarantine; rua=mailto:${var.dmarc_rua_cloudflare_token}@dmarc-reports.cloudflare.net,mailto:admin@gridwork.dev" : "v=DMARC1; p=quarantine; sp=quarantine; rua=mailto:admin@gridwork.dev"
  ttl     = 1
  comment = "DMARC policy (quarantine, not yet reject) — managed by Terraform"
}
