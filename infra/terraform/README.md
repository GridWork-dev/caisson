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
