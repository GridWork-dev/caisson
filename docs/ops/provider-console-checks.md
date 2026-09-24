---
updated: 2026-09-24
status: live
grounds:
  - docs/ops/probe-accounts.md
  - docs/ops/operator-walkthrough.md
  - docs/ops/launch-runbook.md
  - docs/ops/db-restore.md
  - docs/state/outstanding-work.md
  - docs/state/production-readiness.md
  - docs/state/providers.md
  - docs/state/decisions-and-forks.md
  - docs/security/paid-tooling-roi.md
  - docs/ops/live-transport-checklist.md
  - infra/terraform/email.tf
  - infra/terraform/variables.tf
  - outputs/research/infra-provider-audit-2026-07-16.md
  - outputs/research/provider-cost-rollup-2026-07-12.md
  - tooling/scripts/vault-parity-check.ts
  - tooling/scripts/railway-env-sync.ts
  - packages/ai-kit/src/providers.test.ts
---

# Provider console checks (Gate D)

Seven checks four docs name and none specify: `docs/ops/operator-walkthrough.md:50-58`,
`docs/ops/launch-runbook.md:211-213`, `docs/state/outstanding-work.md:68`,
`docs/state/production-readiness.md:97-99`. `docs/state/providers.md:114-130`'s CLI
toolbox confirms none of the installed CLIs (`railway`, `wrangler`, `grafanactl`, `gh`,
`resend`, `stripe`) expose these seven reads — every one of them is a provider-console
page, an email inbox, or (for the parity check) a CLI a human must sign in to
interactively. This runbook gives each one an exact page, a number to read, a bar to
clear, and a line to record. Re-run the whole set on the Gate D cadence (post-launch
operator program, `docs/ops/launch-runbook.md:209-218`) or whenever a check's own
rotation column below fires.

Do not print secret values anywhere in this runbook's execution — names, counts, and
statuses only, per `identity/security.md`.

---

## 1. Railway backup recency

### Console + path

Railway dashboard → the `caisson-prod` project → the Postgres service → **Backups** tab
(`docs.railway.com/volumes/backups` — confirmed current as of this check). This is the
same tab the PITR banner would appear on; PITR itself stays declined
(`docs/state/decisions-and-forks.md:189`, `docs/ops/db-restore.md:44`) so the tab shows
scheduled snapshots only, not a datetime picker.

### What to read

The date stamp on the most recent backup row, and the configured schedule (service
settings panel → Backups tab → schedule field: Daily/Weekly/Monthly).

### Pass bar

Daily snapshots present, most recent snapshot **less than 25 hours old** (one missed
daily cycle is the ceiling before this is a red flag, not "eventually consistent"), **plus**
a rehearsed logical restore inside the last 90 days. The restore half is not this
console read — it is the `pg_dump`/`pg_restore` rehearsal in `docs/operations.md §9`,
last proven 2026-07-11 (`docs/ops/db-restore.md:12-19`). A fresh snapshot with a stale
restore rehearsal is a partial pass: record both dates separately.

### Evidence to record

Append to `docs/deploy/STATE.md` under a dated heading:

```
## 2026-MM-DD — Gate D: Railway backup recency verified

Postgres service `caisson-prod` Backups tab: most recent snapshot 2026-MM-DD HH:MMZ
(schedule: Daily), age <25h at check time. Logical restore last rehearsed 2026-07-11
(docs/ops/db-restore.md) — {still <90d / re-rehearse now}.
```

### Safe for a browser agent, or human-only

Safe for a browser agent. Read-only page, no credential material visible, no mutation
in scope (do not click Restore).

---

## 2. Arnica findings

### Console + path

`app.arnica.io` → **Code risks** page, direct link `app.arnica.io/#/risks/code`
(confirmed current — Arnica's own docs link this exact path for reviewing findings).
Filter the `Type` column for the categories Arnica's free tier actually covers per
`docs/security/paid-tooling-roi.md:36-45`: SAST, SCA, IaC, license, secrets, and the
git-posture inventory reports (SBOM, excessive-permissions, stale users/repos) — not
identity/permission anomaly detection, which sits behind the paid Enterprise tier and is
out of scope for this account.

### What to read

Open-finding count by severity (Critical/High/Medium/Low) on the `caisson-sh` org
covering both `caisson` and `caisson-oss`, plus whether any ticket auto-filed via the
Jira/Azure-DevOps integration (`docs.arnica.io` Ticket Management) is still open.

### Pass bar

Zero open Critical or High findings. Medium/Low findings are informational — this repo
already runs Semgrep/Trivy/osv/TruffleHog/nuclei/ZAP as the primary gate
(`docs/security/paid-tooling-roi.md:6-7`); Arnica is "a fifth detection opinion," kept
free and silent (`docs/security/paid-tooling-roi.md:42-45`), not a blocking gate. This
threshold is **proposed** — the repo sets no explicit Arnica bar today.

### Evidence to record

```
## 2026-MM-DD — Gate D: Arnica findings verified

app.arnica.io/#/risks/code (caisson-sh org): N open findings (0 Critical, 0 High, N
Medium/Low). Ticket integration: {no open tickets / N open, linked}.
```

### Safe for a browser agent, or human-only

Safe for a browser agent. Read-only findings review; the account is already
operator-installed and org-API-verified (`docs/security/paid-tooling-roi.md:32-34`).

---

## 3. Grafana Cloud quota

### Console + path

`grafana.com` → sign in → **My Account** (lands on the Cloud Portal) → left menu
**Cost Management and Billing** app → **Usage** tab. This is deliberately NOT
`caisson.grafana.net` (the stack UI) — the org-admin billing portal is the only place
that shows quota consumption; `GRAFANA_TOKEN`/`grafanactl` can only manage
dashboards/datasources/rules, not read usage
(`docs/state/providers.md:120`; confirmed as a blocked check in
`outputs/research/infra-provider-audit-2026-07-16.md:66`: "Grafana exact quota GB (needs
the org-admin portal, not GRAFANA_TOKEN)").

### What to read

Per-product consumption vs. included limit for the products this stack actually uses —
metrics, logs, traces (`caisson.grafana.net`, US-West `prod-us-west-0`,
`docs/state/providers.md:80,156`) — for the current billing period.

### Pass bar

Every product under 80% of its included-plan limit. No repo-set threshold exists for
Grafana specifically; this bar is **proposed**, chosen to leave headroom before an
overage bill rather than a hard cap the free stack has already accepted (contrast with
Blacksmith below, where the repo did explicitly accept overage).

### Evidence to record

```
## 2026-MM-DD — Gate D: Grafana Cloud quota verified

Cloud Portal → Cost Management and Billing → Usage (caisson.grafana.net,
prod-us-west-0): metrics N% of limit, logs N%, traces N%. All <80%.
```

### Safe for a browser agent, or human-only

Safe for a browser agent. Read-only billing/usage view.

---

## 4. Blacksmith minutes

> **Superseded for this repository on 2026-09-10 (re-read 2026-09-24).** No workflow references
> Blacksmith any more: every Linux job runs on `vars.CI_RUNNER_LINUX`, set to
> `ubicloud-standard-2` on 2026-09-10 (estate R33/R257/R258, recorded in `ci.yml`'s runner-lineage
> comment), and the macOS leg is back on GitHub `macos-15`. This check therefore reads a provider
> caisson no longer runs CI on. Its Ubicloud replacement (console path, pass bar) has not been
> written — an operator item, not something this runbook defines by inference. The procedure below
> is kept as the record of the July baseline.

### Console + path

`app.blacksmith.sh` usage page — the exact path the operator used to resolve PF2-1
(`outputs/research/provider-cost-rollup-2026-07-12.md:44`: "Operator: read the usage page
at app.blacksmith.sh"). This is dashboard-only; there is no CLI or API surface for it
(`outputs/research/infra-provider-audit-2026-07-16.md:67`: "Blacksmith authoritative
minutes (external SaaS — dashboard only)").

### What to read

Effective 4vCPU-minutes consumed this billing cycle against the free-tier allotment
(3,000 min/mo per the ADR-0326 research memo), and the current linked-payment-method
overage rate.

### Pass bar

**Approximately $79/month is accepted through launch, with the alert re-baselined to $120.**
ADR-0390 supersedes PF2-1's earlier ~$4-8/month acceptance after the 2026-07-26 usage read measured
9,805 effective 4-vCPU-minutes for 2026-07-01..26 at approximately $0.008/minute: $66.35 due and
$79.11 projected at month-end. CI stays heavy and full. Revisit the baseline after launch.

Moving jobs to GitHub-hosted runners is not a cheaper fallback: this private repository's Free plan
includes 2,000 minutes and then charges a comparable per-minute rate on runners with half the vCPUs.
The check here is drift beyond the new accepted baseline. A projection above $120 reopens the cost
fork; a projection near $79 does not.

### Evidence to record

```
## 2026-MM-DD — Gate D: Blacksmith minutes verified

app.blacksmith.sh usage page: N effective 4vCPU-min this cycle (3,000 free), projected
month-end spend $N. Within the ADR-0390 accepted ~$79 baseline and below the $120 alert:
{yes / no — reopen fork}. Revisit after launch.
```

### Safe for a browser agent, or human-only

Safe for a browser agent. Read-only usage page.

---

## 5. DMARC reports

### Not a console — a mailbox

This is the odd one out: `infra/terraform/email.tf:127-146` sets
`rua=mailto:admin@gridwork.dev` and `dmarc_rua_cloudflare_token` is an unset
Terraform variable (`infra/terraform/variables.tf:54`, confirmed empty in
`infra/terraform/terraform.tfstate` — the applied record has no
`dmarc-reports.cloudflare.net` address folded in). So today, DMARC aggregate (RUA)
reports land as raw XML `.gz`/`.zip` attachments in the `admin@gridwork.dev` inbox —
there is no Cloudflare dashboard aggregating them yet
(`outputs/research/infra-provider-audit-2026-07-16.md:78`: "email deliverability
(bounce/DMARC aggregate)" is listed as a surface this audit did not cover). Reading
this check means opening that inbox and a DMARC-XML viewer (or eyeballing the XML),
not a provider console.

### What to read

Each report's `<record>` rows: source IP, message count, and `dkim`/`spf` alignment
result (`pass`/`fail`) for every sending path — the two documented mail paths per
`infra/terraform/email.tf` header (Proton Mail + the app's transactional sender).

### Pass bar

100% of reported volume aligns `pass` on at least one of DKIM/SPF for every legitimate
sending IP. Any `fail` row from an IP that should be legitimate is a deliverability
regression to chase before ever moving the policy from `p=quarantine` to `p=reject`
(`email.tf:127-131`: "only after DMARC reports have been watched for a while and every
legitimate sender aligns clean"). No repo-set numeric threshold exists beyond
"clean" — this 100% bar is **proposed**.

### Proposed upgrade

Set `dmarc_rua_cloudflare_token` and `terraform apply` — that folds Cloudflare's free
zone-level DMARC Management report ingest in ahead of the mailto (`email.tf:133-135`),
turning this into an actual dashboard read (Cloudflare dash → the zone → Email → DMARC
Management) instead of manual XML inbox review. Not applied here — a Terraform apply is
out of this task's file scope.

### Evidence to record

```
## 2026-MM-DD — Gate D: DMARC reports verified

admin@gridwork.dev inbox, N reports covering 2026-MM-DD..2026-MM-DD: N total messages,
100% DKIM-or-SPF pass. {No anomalies / anomalies: <detail>}.
```

### Safe for a browser agent, or human-only

**Human-only.** This is a personal email inbox (`admin@gridwork.dev`), not a scoped
service account or a read-only provider console — an agent should not be granted
inbox access to review it.

---

## 6. AWS Bedrock access

### Console + path

AWS Console → **Amazon Bedrock** → the region the deployed AI lane actually runs in
(`AWS_REGION` on whichever Railway service has a `bedrock` AI-config lane armed — check
`railway variables -s <svc>` for that name before opening the console, region is not
repo-pinned: `packages/ai-config/src/config.ts:49`). **Do not look for a "Model access"
left-nav page** — AWS retired it for commercial regions in the 2025-10-15 simplification
(confirmed live via web search this session): serverless model access is now automatic
by default under standard IAM/SCP controls, no per-model enable step, except **Anthropic
models still require a one-time use-case form**. Since this repo's own Bedrock driver is
tested against an Anthropic model id (`anthropic.claude-3-sonnet-20240229-v1:0`,
`packages/ai-kit/src/providers.test.ts:123,363`), that form is exactly the thing to
verify. Submit/check it via the Bedrock **Model catalog** page → select the Claude model
→ the use-case-details banner, or the console's model card. (The retired "Model access"
page's mechanics stay documented at AWS's own
`docs.aws.amazon.com/bedrock/latest/userguide/model-access.html` for GovCloud only —
irrelevant here, this account is commercial.)

### What to read

Access status for the configured Anthropic model id: **Access granted** vs. **Available
to request** (use-case form not yet submitted) vs. blocked by an IAM/SCP restriction on
the credential pair shared with KMS/S3-WORM (`docs/archive/provider-key-setup-2026-07-10.md:204-209`
— Bedrock, KMS, and the audit-worm S3 bucket all ride the same AWS account per
`docs/ops/live-transport-checklist.md:27,29-30`).

### Pass bar

Access status = **Access granted** for the configured model id, in the same region the
deployed service's `AWS_REGION` points at. "Available to request" (form not submitted)
is a fail for launch — the rented-transport path silently 403s at first real invoke
otherwise.

### Evidence to record

```
## 2026-MM-DD — Gate D: AWS Bedrock access verified

Bedrock console, region <region>: anthropic.claude-3-sonnet-20240229-v1:0 = Access
granted. Same AWS account backs KMS (field-crypto) + S3 WORM per live-transport-checklist.
```

### Safe for a browser agent, or human-only

**Human-only.** This is an AWS account console with billing/IAM visibility and a
one-time EULA/use-case acceptance action attached to the same flow — not a pure
read-only page, and it shares a credential pair with two other live security-relevant
surfaces (KMS, WORM). An agent should not hold this session.

---

## 7. Vault / Railway / local key parity

### Not one console — three homes, two CLI diffs

There is no single provider page for this; it is a three-way name comparison across
the credential homes in `docs/state/providers.md:103-113`: the 1Password "Caisson
Launch" vault (primary SoT since ADR-0317), `~/.gridwork/caisson.env` (local mirror),
and each Railway service's own env. Two existing repo scripts do the read — this check
is "run both and read the report," not a browser action:

```bash
bun tooling/scripts/vault-parity-check.ts       # vault vs caisson.env, names only
bun tooling/scripts/railway-env-sync.ts --generated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
                                                 # Railway vs caisson.env, read-only mirror
```

Both are names-only by contract (`tooling/scripts/vault-parity-check.ts:1-16`,
`:130-146` — never print a value; `railway-env-sync.ts:391-397` — refuses any non-read
Railway verb). `op` requires an interactive `op signin` first
(`vault-parity-check.ts:182-191`) — flagged as operator-interactive in
`outputs/research/infra-provider-audit-2026-07-16.md:65`.

### What to read

`vault-parity-check.ts`'s three buckets (`missingFromVault`, `missingFromEnv`, `stale`)
and `railway-env-sync.ts`'s equivalent Railway-side diff. A vault item tagged `non-env`
is expected to show up as vault-only — that is by design
(`vault-parity-check.ts:56-59`), not drift.

### Pass bar

`vault-parity-check.ts` exits 0 ("clean — vault and caisson.env agree on names") and the
Railway-side sync shows no missing/extra names outside documented exceptions (e.g.
GitHub-Actions-only secrets never mirrored locally). A `stale` hit (vault item
`updated_at` predates the last known rotation date) is also a fail — pass `--rotated-after`
with the most recent credential-rotation date to catch it.

### Evidence to record

```
## 2026-MM-DD — Gate D: vault/Railway/local key parity verified

vault-parity-check.ts: clean (0 missing-from-vault, 0 missing-from-env, 0 stale).
railway-env-sync.ts: clean, N services checked, 0 unexplained drift.
```

### Safe for a browser agent, or human-only

**Human-only.** Both scripts are read-only and print names/timestamps only, but `op
signin` is an interactive credential-material action (1Password master
password/biometric) and Railway CLI auth is a personal login token — the sign-in step
itself, not the script output, is why this stays off an agent's plate.

---

## Rotation — when to re-run each check

| Check                          | Re-run trigger                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Railway backup recency         | Weekly during Gate D cadence; immediately after any manual snapshot/restore action                                                 |
| Arnica findings                | Any Critical/High alert email; otherwise monthly                                                                                   |
| Grafana Cloud quota            | Monthly, or after any traffic-shape change (new service, new dashboard load)                                                       |
| Blacksmith minutes             | Monthly, tighter near the 3,000-min free-tier boundary                                                                             |
| DMARC reports                  | Weekly while `p=quarantine` (watching before any move to `p=reject`)                                                               |
| AWS Bedrock access             | Once per new model id added to `ai-config`, and before any launch gate that depends on the rented-transport lane                   |
| Vault/Railway/local key parity | After every credential rotation (same sitting, per `docs/ops/probe-accounts.md`'s own rotation table), and before any go-live gate |
