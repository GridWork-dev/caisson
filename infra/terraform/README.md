# infra/terraform — Caisson Cloudflare (DNS + Pages)

Infrastructure-as-code for the Caisson site: the `caisson.sh` DNS records, the Cloudflare Pages
project (marketing + docs, single Next + MDX app), and the apex/`www` custom domains.

**Scope.** The `.sh` registration is external (Cloudflare Registrar doesn't sell `.sh`); the
**zone is hosted on Cloudflare** (nameservers pointed there). This module references the existing
zone by id and owns everything downstream. Neon (data) is provisioned outside this module.

## Prerequisites

- `caisson.sh` added to Cloudflare (zone active) → grab the **Zone ID** + **Account ID** from the
  dashboard overview.
- A scoped **API token**: `Zone → DNS → Edit` + `Account → Cloudflare Pages → Edit` +
  `Account → Access: Apps and Policies → Edit` (the last one for the pre-launch gate below).

## Apply

```bash
cd infra/terraform
export CLOUDFLARE_API_TOKEN=...            # never commit this
cp terraform.tfvars.example terraform.tfvars   # fill account_id + zone_id (gitignored)

terraform init
terraform plan
terraform apply
```

State is local + gitignored (`*.tfstate`). Move it to a remote backend (R2 + a lock) before more
than one operator touches it.

## State (deferred, ADR-0208 #3)

Staying **local** is a deliberate posture, not an oversight: single operator, zero CI-driven
`apply`s today (`ADR-0107`'s go-live checklist step 8 already names this exact migration and
gates it on "if a second operator or CI ever runs apply"). No CI workflow invokes `terraform`.

**Locking-gap finding:** Cloudflare R2 silently ignores S3 conditional-write headers
(`If-None-Match`/`If-Match`), so Terraform ≥1.10's `use_lockfile = true` on the stock `s3`
backend is a **no-op** on R2 — the state upload works, the lock does not. "R2 + a lock" (as
phrased above and in `docs/operations.md`) is not achievable with that backend as-is; there is
also no DynamoDB-equivalent on Cloudflare for the legacy `dynamodb_table` locking path.

**Migration trigger:** a second operator or a CI-driven `apply` shows up. **Real options at that
point** (pick one consciously — don't assume `use_lockfile` protects you on R2):

- **Accept no real locking on R2** — fine for low-apply-frequency, one-writer-at-a-time
  workflows; matches this repo's usage pattern if it stays small.
- **A Worker/Durable-Object HTTP lock backend** — genuine atomic locking, but real infra to
  build and maintain for what is otherwise a P2 backlog item.
- **AWS S3 + DynamoDB instead of R2** — genuine conditional-write + DynamoDB locking today, at
  the cost of a second cloud vendor for this one surface (though AWS creds already exist in this
  repo's ops surface via `infra/worm/provision.ts`'s WORM bucket, so it isn't a net-new vendor
  for the project as a whole).

## What it creates

- `cloudflare_pages_project.site` — the Pages project (`caisson-site`, production branch `main`).
- `cloudflare_pages_domain.{apex,www}` — `caisson.sh` + `www.caisson.sh` on the project.
- `cloudflare_dns_record.{apex,www}` — proxied CNAMEs → `<project>.pages.dev` (apex via CNAME
  flattening).
- `cloudflare_zero_trust_access_application.site_gate` + `cloudflare_zero_trust_access_policy.site_gate`
  — the **pre-launch Access gate** (see below).

## Pre-launch gate (Cloudflare Access)

The site is **provisioned + deployed but private** until launch. `access.tf` puts `caisson.sh` +
`www` behind Cloudflare Access: a visitor must authenticate as a `@gridwork.dev` operator via email
one-time PIN (the built-in `onetimepin` IdP — no OAuth setup). Override the allowed domain with
`-var site_access_email_domain=...`.

**At go-live:** delete `access.tf` (and `terraform apply`), or flip the policy `decision`/`include`
to `everyone`/`bypass`.

**Limitation:** a self-hosted Access app can only cover hostnames in this account's zone, so the
Pages origin `caisson-site.pages.dev` is **not** gated (Cloudflare error 12130 — "domain does not
belong to zone"). The canonical surface is the gated, proxied `caisson.sh`; the pages.dev origin
stays reachable + unlisted. To also seal pages.dev, enable the Pages project's native Access
integration in the Zero Trust dashboard.

## Edge WAF + rate limiting (ADR-0219, `waf.tf`)

`waf.tf` adds a Free Managed Ruleset + one Free-tier rate-limit rule (zone-level
`cloudflare_ruleset`s) fronting the proxied hosts, and `main.tf` flips `docs-api.caisson.sh` to
proxied (`license.caisson.sh` stays grey — deliberately out of scope, see its comment in
`main.tf`). **Before running `apply`:** the token behind `CLOUDFLARE_API_TOKEN` needs **Zone →
WAF → Edit** added in the Cloudflare dashboard — the scope today is DNS + Pages only (see
`versions.tf`), and `cloudflare_ruleset` 403s without it. `docs-api`'s DNS record and the zone's
WAF entry-point ruleset may already exist outside Terraform's state (dashboard-created / CF's
Free-plan default) — `terraform import` them first (commands in the resource comments in
`main.tf` / `waf.tf`) or `plan` will try to create a duplicate. `terraform apply` for this change,
like the DNS proxy flip itself, is a DEPLOY-class operator act — never run inside the autonomous
cycle.

## Deploy (the site app — `apps/site`)

The Pages project is **direct-upload** and the site is a Next.js **static export**
(`output: 'export'`, ADR-0084). CI runs `next build` → `out/` then
`wrangler pages deploy out/ --project-name=caisson-site`. There is **no Cloudflare-side build**, so
`cloudflare_pages_project.site` carries **no `build_config` and no `source`** — that is correct, not
missing. The only deploy pointer is the `out/` argument to wrangler (also set as
`pages_build_output_dir` in `apps/site/wrangler.jsonc`). The deploy job lives in
`.github/workflows/deploy-site.yml` (gated on a green build; `workflow_dispatch` + push to `main`).

> `@cloudflare/next-on-pages` is **not** used — it was npm-deprecated and archived 2025-09-29.
> Static export needs no Next adapter.

## Email deliverability (SPF/DKIM/DMARC, `email.tf`)

`email.tf` brings the SPF/DKIM/MX/DMARC records for caisson.sh's two live mail paths — Proton Mail
(the business mailbox) and Resend, the product's transactional sender (ADR-0324), which rides
Amazon SES infrastructure — `send.caisson.sh` is Resend's custom MAIL-FROM subdomain — under
Terraform. **Every record in `email.tf` already
exists live in the zone** (hand-created before this module existed): adopt each one with
`terraform import` before the first `plan`/`apply` touches this file, or `plan` will try to CREATE
duplicates of records that are already routing real mail.

### 1. Find each record's ID

```bash
export ZONE_ID=...        # var.cloudflare_zone_id
export CF_API_TOKEN=...   # same scoped token as CLOUDFLARE_API_TOKEN (needs DNS:Read at minimum)

curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=caisson.sh&type=TXT"
# ^ returns BOTH the SPF and the protonmail-verification TXT (same name+type) — match the `id` to
#   the right resource below by its `content` field.

curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=caisson.sh&type=MX"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=_dmarc.caisson.sh&type=TXT"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=resend._domainkey.caisson.sh&type=TXT"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=send.caisson.sh&type=TXT"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=send.caisson.sh&type=MX"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=protonmail._domainkey.caisson.sh&type=CNAME"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=protonmail2._domainkey.caisson.sh&type=CNAME"
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=protonmail3._domainkey.caisson.sh&type=CNAME"
```

### 2. Import each resource

```bash
terraform import cloudflare_dns_record.apex_spf                     "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.apex_protonmail_verification "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.apex_mx_primary              "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.apex_mx_secondary            "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.protonmail_dkim              "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.protonmail2_dkim             "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.protonmail3_dkim             "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.resend_dkim                  "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.send_spf                     "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.send_mx                      "$ZONE_ID/<record-id>"
terraform import cloudflare_dns_record.dmarc                        "$ZONE_ID/<record-id>"
```

### 3. Enable Cloudflare DMARC Management (optional, recommended)

Free zone-level feature: Cloudflare ingests DMARC aggregate reports on your behalf instead of (or
alongside) a self-hosted `rua` inbox.

```bash
curl -s -X PATCH -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/auth/dmarc-reports" \
  -d '{"enabled":true}'
```

Then read the 32-hex token either from `GET` on the same endpoint, or from the zone's own
`_dmarc` record (Cloudflare appends its `mailto:<token>@dmarc-reports.cloudflare.net` to the live
record once enabled — **do not let that stand as the unmanaged value**: `email.tf`'s `dmarc`
resource is Terraform's declared owner of this record's content, so the token belongs in the
variable below, not in a Cloudflare-side edit that Terraform would otherwise fight or revert).

### 4. Set the token variable

```bash
# terraform.tfvars (gitignored)
dmarc_rua_cloudflare_token = "<the 32-hex token from step 3>"
```

Leave it `""` (the default) to skip Cloudflare DMARC Management entirely — the record then carries
only `rua=mailto:admin@gridwork.dev`, matching what's live today.

### 5. Plan before apply

`terraform plan` MUST show **no create and no destroy** for any `cloudflare_dns_record.*` in
`email.tf` — only in-place updates are expected on first apply after import (TTL normalizing from
each record's current live value to `1`/Auto, and `dmarc`'s content picking up the token from step
4 if set). If plan shows a **create or destroy** for any record above, STOP: the import in step 2
didn't target the right record, or the live value has drifted since this file was written —
reconcile before `apply`.

`terraform apply` for this file is a DEPLOY-class operator act, same as every other change in this
module — never run inside the autonomous cycle.
