# infra/terraform — Caisson Cloudflare (DNS + Pages)

Infrastructure-as-code for the Caisson site: the `caisson.sh` DNS records, the Cloudflare Pages
project (marketing + docs, single Next + MDX app), and the apex/`www` custom domains.

**Scope.** The `.sh` registration is external (Cloudflare Registrar doesn't sell `.sh`); the
**zone is hosted on Cloudflare** (nameservers pointed there). This module references the existing
zone by id and owns everything downstream. Neon (data) is provisioned outside this module.

## Prerequisites

- `caisson.sh` added to Cloudflare (zone active) → grab the **Zone ID** + **Account ID** from the
  dashboard overview.
- A scoped **API token**: `Zone → DNS → Edit` + `Account → Cloudflare Pages → Edit`.

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

## What it creates

- `cloudflare_pages_project.site` — the Pages project (`caisson-site`, production branch `main`).
- `cloudflare_pages_domain.{apex,www}` — `caisson.sh` + `www.caisson.sh` on the project.
- `cloudflare_dns_record.{apex,www}` — proxied CNAMEs → `<project>.pages.dev` (apex via CNAME
  flattening).

## Not yet wired (lands with the site app)

The Pages project is **direct-upload** (deploy via Wrangler/CI). When the Next + MDX site app is
built, add its build/deploy config (`compatibility_date`, the `@cloudflare/next-on-pages` /
OpenNext output) to `cloudflare_pages_project.site` and a deploy step to CI.
