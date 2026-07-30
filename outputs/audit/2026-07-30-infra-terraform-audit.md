# infra/ audit — Terraform + provisioners (2026-07-30)

First full read of `infra/` (nobody had audited this tree). Scope: every file under
`infra/terraform/`, `infra/kms/provision.ts`, `infra/discord/provision.ts`, plus the adjacent
`infra/worm/provision.ts` and `infra/license-issuer/` since they share the tree. READ-ONLY lane:
no `terraform` command was run — `plan` requires `CLOUDFLARE_API_TOKEN` (a credential) **and** the
local `terraform.tfstate`, which lives gitignored in the operator's main checkout only (this
worktree has neither, by design). Findings only; no remediation performed.

## 1. What each file provisions

| File                                          | Provisions                                                                                                                                                                                                                                                                                                 | Notes                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `main.tf`                                     | DNS for the Railway fleet: proxied CNAMEs apex + `www` (caisson-site), `admin` (caisson-admin), `docs-api` (caisson-docs, proxied per ADR-0219); grey/DNS-only `license` (caisson-license — deliberately off CF's edge so Paddle's webhook can never be rate-limited/challenged); 5 `_railway-verify` TXTs | `docs_api` target/verify come from required no-default variables (operator tfvars) |
| `access.tf`                                   | The pre-launch Cloudflare Access gate (ADR-0303, **scoped**): one allow policy (`@gridwork.dev` email OTP), one self-hosted app over `/dashboard*` + `/cart*` on apex + www, plus the `caisson-e2e-prober` service token + its `non_identity` policy                                                       | This is the launch-gate surface — see §3                                           |
| `bot-management.tf`                           | Zone Bot Management singleton pinned OFF: `fight_mode`/`enable_js` false (ADR-0313, 676ms TBT), `ai_bots_protection`/`crawler_protection` disabled (AI Labyrinth kill, session Q)                                                                                                                          | Pins exist so a dashboard toggle cannot silently re-arm                            |
| `caa.tf`                                      | 6 CAA records (issue + issuewild for letsencrypt.org, pki.goog, ssl.com)                                                                                                                                                                                                                                   | Imported 2026-07-16; deliberately no `comment` fields to match live                |
| `dmarc-authz.tf`                              | RFC 7489 §7.1 external-destination authorization TXT `caisson.sh._report._dmarc.gridwork.dev` — **in the gridwork.dev zone** via a `data.cloudflare_zones` lookup                                                                                                                                          | Cross-zone: see finding D5                                                         |
| `email.tf`                                    | 11 mail records: apex SPF (Proton), Proton verification TXT, 2 MX, 3 Proton DKIM CNAMEs, Resend DKIM TXT, `send.caisson.sh` SPF + MX (SES return-path), `_dmarc` TXT (p=quarantine, optional CF report-ingest token via variable)                                                                          | The known-gotcha file — see finding D1                                             |
| `waf.tf`                                      | Zone rulesets: Free Managed Ruleset execute + the single Free-tier rate-limit rule (`/query`, `/api/auth/*`, `/@caisson*`, `/-/*`; 150 req / fixed 10s / block)                                                                                                                                            | Path-only matching spans all proxied hosts — zone-unique paths are load-bearing    |
| `status-page.tf`                              | `status.caisson.sh` CNAME → Better Stack (grey — Better Stack terminates TLS)                                                                                                                                                                                                                              | ADR-0348                                                                           |
| `web-analytics.tf`                            | The RUM site object with `auto_install = false` **and** `enabled = false` (the field that actually stops the beacon — CAISSON-50/51 root kill), `prevent_destroy`                                                                                                                                          | Imported 2026-07-08                                                                |
| `outputs.tf` / `variables.tf` / `versions.tf` | `site_urls` output; variables (token, ids, docs-api target/verify, rate-limit threshold, DMARC token); cloudflare provider `~> 5.0`, lock file pins 5.22.0                                                                                                                                                 | Lock file is committed — good                                                      |
| `infra/kms/provision.ts`                      | **Print-only** (KMS-2=B2): emits the tag-scoped ABAC IAM statements to ADD to the existing WORM prover principal (KMS-1=A1). No AWS call, no creds, no persistent resource                                                                                                                                 | AWS KMS only — see finding G1 (Azure)                                              |
| `infra/discord/provision.ts`                  | Idempotent Discord guild provisioner (ADR-0109): roles, 6 categories, ~20 text channels, server identity; prints the NAME→ID map for the bot env                                                                                                                                                           | See finding D6 (four-editions taxonomy)                                            |
| `infra/worm/provision.ts`                     | S3 Object-Lock WORM bucket (ADR-0201): create + public-access block + proof-prefix lifecycle reaper; prints (does not create) the prover IAM policy                                                                                                                                                        | Operator-run with sourced env                                                      |
| `infra/license-issuer/ISSUER_PUBLIC_KEY.md`   | Doc only — the Ed25519 issuer public key record                                                                                                                                                                                                                                                            | Not provisioning                                                                   |

## 2. Drift / unimported relative to real state (unverified where stated)

State posture first, because it frames everything: **state is local + gitignored** (ADR-0208 #3,
deliberate; README documents the R2-locking gap honestly). It exists only in the operator's main
checkout. Nothing here could be verified against live without credentials, so each item below
carries its verification status.

- **D1 — email.tf import status is contested between two sources of truth.** The file header and
  README both state all 11 resources (plus the 6 CAA) were terraform-imported 2026-07-16 with a
  clean plan ("blanket applies are safe"). Project memory from a later sitting
  (agent-runtime/sandbox-locks era) records the opposite gotcha: email.tf resources **unimported
  in tfstate, requiring a targeted apply**. Both cannot be true of the same state file. Since
  these records route real mail, the stop-rule in README §5 stands: the first `plan` after any
  change must show **no create and no destroy** for any `email.tf` record — a create means the
  import claim is wrong for the state file actually in use, and applying would attempt duplicate
  records on live mail DNS. UNVERIFIED here (no state, no token). Treat every blanket apply as
  suspect until one clean plan is captured and filed.
- **D2 — docs_api DNS record + both waf.tf rulesets are declared import-first.** Their own
  comments say the live objects may predate Terraform (dashboard-created / CF Free-plan default
  entry-point ruleset) and must be `terraform import`ed or plan will try to create duplicates.
  Whether that import ever happened is not recorded in any file in this tree (unlike email/caa,
  which carry "ADOPTED" headers). UNVERIFIED; same stop-rule applies.
- **D3 — bot-management singleton: import documented (with the literal id in the comment), token
  needs Zone → Bot Management → Edit.** No "adopted" stamp in the file. UNVERIFIED.
- **D4 — README.md + terraform.tfvars.example are materially stale (Pages era).** README "What it
  creates" still lists `cloudflare_pages_project.site`, `cloudflare_pages_domain.{apex,www}` and
  pages.dev CNAMEs; the Deploy section describes static-export + `wrangler pages deploy`. The
  Pages project was torn down 2026-07-01 (ADR-0114/0115; main.tf header says so). The
  tfvars.example offers `pages_project_name` / `production_branch` overrides — **those variables
  no longer exist in variables.tf** — and its trailing comment claims a rate-limit default of 60
  vs the real 150. README's go-live instruction is also stale — see §3. Doc drift only, but this
  is the runbook an operator will follow at launch.
- **D5 — dmarc-authz.tf silently widens the required token scope.** It creates a record in the
  **gridwork.dev** zone via `data.cloudflare_zones`. The README prerequisites describe a token
  scoped to the caisson.sh zone; a token scoped that narrowly fails the zone lookup (or the
  cross-zone write) at plan/apply time. Nothing in README or versions.tf mentions the second
  zone. Doc gap; also means "scoped token" is in practice a multi-zone DNS token.
- **D6 — discord/provision.ts models the retired four-edition taxonomy.** Roles/channels
  Compliance / AI Production Kit / Local-first AI / Agentic-Dev predate ADR-0257/0258 (four
  editions dissolved into six bundles, 2026-07-06). Any purchase→role automation keyed on today's
  six-bundle SKUs has no role to map to for Provenance/Everything and a stale mapping for the
  rest. The script is idempotent-by-name so re-running it neither fixes nor breaks this.
- **Non-drift, recorded to prevent a false finding:** `registry.caisson.sh` AAAA `100::` is
  Cloudflare's own Workers-custom-domain record — deliberately absent from Terraform (caa.tf
  comment); do not import it. The registry Worker's WAF exposure comes via its wrangler `routes`,
  not main.tf.

## 3. The Cloudflare Access flip — what launch mechanically requires

The tracker row ("Public release: keep cart/dashboard/checkout Cloudflare-gated; at launch remove
the gates…") resolves to exactly one Terraform surface: the `site_gate` application + its two
policies in `access.tf`. Checkout has no separate path — it is the Paddle overlay opened from the
gated `/cart` page; `/api` (including `/api/checkout/started`) is deliberately ungated because
every route carries its own session auth (verified: `/api/checkout/started` 401s without a
session; `/dashboard` keeps its `requireDashboardSession` app-level gate after the flip, so Access
is defense-in-depth, not the only lock).

Mechanics, in order:

1. **The flip must go through Terraform, not the ZT dashboard.** If the operator deletes the
   Access app in the dashboard, state still holds it — the **next blanket `terraform apply`
   recreates the gate and takes the commerce surface back down**, silently. The safe change is:
   remove (or conditionalize) `cloudflare_zero_trust_access_application.site_gate` +
   `cloudflare_zero_trust_access_policy.site_gate` + `site_gate_service_auth` in `access.tf`,
   then plan + apply from the checkout that owns `terraform.tfstate`.
2. **Do NOT follow README's "delete access.tf" instruction** — stale twice over: it describes the
   whole-host gate (pre-ADR-0303), and the file now also carries the `caisson-e2e-prober` service
   token + outputs. Deleting the whole file destroys the prober token too. Post-gate the prober no
   longer needs it to pass, so destroying it is a choice, not an accident to make — the live e2e
   harness env (`CAISSON_E2E_CF_CLIENT_ID/SECRET` in `~/.gridwork/caisson.env`) and any test that
   asserts gate behavior should be updated in the same act.
3. **Token scope:** the apply needs Account → Access: Apps and Policies → Edit (already listed in
   variables.tf's token description). No DNS change, no cache purge, no cert implication — the
   apex/www records stay proxied regardless.
4. **Plan hygiene at the same moment:** because the flip's plan runs against the full module, any
   D1/D2 unimported resource surfaces HERE as an unrelated create. Per this repo's convention a
   targeted apply (`-target=cloudflare_zero_trust_access_application.site_gate` + the two
   policies) is the correct containment if the plan is not otherwise clean — the email.tf
   precedent.
5. **Post-flip:** the tracker couples the flip to recording GOVERNANCE→COMPLIANCE WORM evidence;
   that is outside this module (audit-worm), but the flip is the trigger. Verify anonymously that
   `/cart` + `/dashboard` render without OTP and `/dashboard` still demands app login.
6. `terraform apply` here is DEPLOY-class (module convention, stated in README and waf.tf) —
   operator act, never the autonomous cycle.

## 4. Secret/credential handling vs the security floor

- **S1 (finding) — the e2e prober secret lives in plaintext tfstate.** `access.tf` outputs
  `e2e_prober_client_secret` (`sensitive = true` only masks CLI display); the service token's
  secret is in `terraform.tfstate` regardless. Today that file is local + gitignored on a
  single-operator box — acceptable under the documented ADR-0208 posture. The README's own
  migration path ("move state to R2") would put a live credential in a remote bucket with no
  state encryption; the migration note does not say so. If/when state moves: encrypt or rotate
  the prober token out first.
- **S2 (clean) — no hardcoded secrets anywhere in the tree.** Every literal in the .tf files is
  public DNS material (railway-verify tokens, DKIM public keys, protonmail-verification, CNAME
  targets). The API token comes from `CLOUDFLARE_API_TOKEN` env or a gitignored tfvars;
  `terraform.tfvars` and `*.tfstate` are gitignored (verified via `git check-ignore`).
  `versions.tf` explicitly forbids the account-wide key.
- **S3 (clean) — provisioners:** `kms/provision.ts` is print-only, zero creds, tag-scoped ABAC
  statements (request-tag for CreateKey, resource-tag for ops, `kms:RequestAlias` for the
  untaggable-alias CAISSON-14 fix). `discord/provision.ts` takes `DISCORD_TOKEN` from env and
  exits when absent, uses `fetchWithTimeout` + bounded 429 backoff; hardcoded guild/bot ids are
  identifiers, not secrets. `worm/provision.ts` uses the SDK default credential chain with
  operator-sourced env. All three are ops one-shots outside the package gates (`console.log`
  permitted there).
- **S4 (observation) — waf.tf's single shared rate-limit rule** spans hosts by path; its own
  zero-headroom comment is accurate. Any future site/admin/docs route under `/query`,
  `/api/auth`, `/@caisson`, or `/-/` gets silently rate-limited — a naming constraint on FOUR
  apps enforced only by a comment. Not a violation; a standing trap worth knowing.

## 5. Gaps against the two open launch gates

- **G1 — Azure Key Vault has no infra/ counterpart at all.** The field-crypto Azure KV adapter is
  code-complete (`packages/field-crypto/src/kms-azure.ts`, T6 "complete" in the tracker), but
  `infra/kms/provision.ts` is AWS-only and print-only. Arming a real vault (vault, key,
  RBAC/access policy, the env the adapter reads) is entirely manual with no runbook anywhere
  under `infra/`. If launch requires an armed vault, this tree gives the operator nothing —
  neither IaC nor a printed checklist. Recommend an `infra/kms/azure` runbook or provisioner as a
  tracked launch item.
- **G2 — the Access flip's blast radius is coupled to D1/D2.** The one Terraform act launch
  requires runs a plan over a module with two unresolved import-status questions on live-mail DNS
  and WAF. Capturing one clean full `plan` (operator act, minutes) **before** launch week
  decouples them; §3.4's targeted apply is the fallback, not the plan.

## Disposition

Findings D1–D6, S1, G1–G2 are documentation/state/process findings — none require a code change
in this lane, none block the F3/F5 fixes shipped alongside this audit. Highest-value operator
acts, in order: capture one clean `terraform plan` (settles D1/D2/D3 in one shot), rewrite
README's go-live section to the ADR-0303 + Terraform-first flip (D4/§3), decide the Azure KV
arming path (G1).
