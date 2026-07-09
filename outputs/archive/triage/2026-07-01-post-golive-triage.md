# Post-go-live triage — 2026-07-01

Snapshot after merging **#42 editions**, **#41 commerce**, **#43 strix**, and **#44 doc-hygiene** (open).
ADR ceiling **0203**. Sources: the 13-agent doc-hygiene+triage sweep, `decisions-and-forks.md`,
`readiness-and-backlog.md`, the go-live ADR bodies, Linear (`CAISSON`), and the Strix pentest findings.

> **Boundary:** git owns decisions (ADRs), Linear owns work. This report is a snapshot, not a new SOT —
> `decisions-and-forks.md` + `readiness-and-backlog.md` stay authoritative.

## P0 — do now (operator, revenue/deploy blockers)

| Item                                   | Detail                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registry Worker 32-module redeploy** | The deployed CF Worker still serves the stale index; redeploy so it serves the rebuilt **32-module** `registry/index.json`. Genuinely open (this is why #44 left the "serves old index" doc text alone). |
| **CF Access pre-launch gate flip**     | Delete `access.tf` + `terraform apply` to open the site to the public (ADR-0107/0114). Sites currently 302 → CF Access login.                                                                            |
| **Paddle production creds**            | `PADDLE_API_KEY` + `PADDLE_WEBHOOK_SECRET` + price ids on `caisson-license` (sandbox configured; prod pending) — gates real checkout.                                                                    |
| **Strix vuln-0004 (verify)**           | DNS-rebinding bypasses SSRF guards in `packages/alerting` webhook transport (CVSS 9.1 claimed). **Verify before fixing** — pentest candidate. If real, this is a genuine security fix.                   |

## P1 — high

**Operator env fast-follows (from the go-live merges):**

- `BILLING_GRANT_TOKEN` on `caisson-support-bot`; `SUPPORT_BOT_URL` + `SUPPORT_BOT_GRANT_TOKEN` on `caisson-license` **and** `caisson-site`; `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` on `caisson-site` (ADR-0203 Discord link+push — no-op until set).
- `MASTER_FIELD_KEY` + `FIELD_CRYPTO_SALT` for the compliance live path.
- **Rotate the leaked Discord/OpenRouter creds** announced in earlier readiness notes.
- WORM prover: dedicated scoped IAM user for the S3 live proof (policy printed by `infra/worm/provision.ts`) — ADR-0201 marked provisioned this session; confirm the scoped user.
- Support-bot: enable the 2 privileged Discord intents in the Portal + wire `SUPPORT_CHANNEL_ID`/`MEMBER_ROLE_ID`.
- Real checkout wiring + EULA drafting (Paddle checkout integration).

**Strix (verify-first):**

- **vuln-0003** admin dashboard no in-app auth (CVSS 7.5) — **likely the documented ADR-0140 CF-Access-alone posture** (already the 1 open finding from the PR#40 audit). Confirm it's the accepted fork, not a new gap.
- **vuln-0006** seat members can modify org-level BYOK keys + compliance attestations (CWE-863) — access-control, verify against `account_member` role checks.

**Linear:** CAISSON-1 (Grafana OTLP cutover, tear down SigNoz — blocked/DEPLOY-class) · CAISSON-4 (edition seam-completion follow-ups — In Progress).

**Doc deploy-status reconciliation** (deferred from #44 — needs live confirmation): CLAUDE.md cadence (lines ~50-52) + `build-state.md` (apps/admin row ~303, registry ~258, dashboard ~197, "still Cloudflare Pages" ~209) + `readiness-and-backlog.md` banner (~54) still read pre-deploy, though memory records site/admin/docs/support-bot/SigNoz deployed + DNS cut over. Reconcile in one focused pass once live state is confirmed (keep the registry-Worker-redeploy as still-open).

## P2 — medium

- **Strix billing-logic (verify):** vuln-0002 (Paddle subscription-update grants a full credit cycle, CWE-840) + vuln-0005 (multi-item checkout grants only the first item) — both map to real `services/license` webhook/checkout paths; worth verifying now that commerce is live. vuln-0001 (rate-limit bypass via spoofable forwarding header) — check vs the ADR-0112 limiter.
- **Linear:** CAISSON-2 (edition members-fold gated republish 0.2.0 → ADR-0178) · CAISSON-3 (wire support-bot escalations to Linear Triage).
- **C5** local-ai RentedTransport: wire Bedrock/Azure/Ollama through the metered transport.
- Env seams: `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` + PG, `KMS_KEY_ID` (alt), Resend key, per-lane AI keys (BYOK).
- **Ops hygiene:** set `registry-index` as a required check + branch protection; move Terraform state to a remote backend (R2 + lock) before multi-operator.

## P3 — low

- **Stage-2 tails:** C2 streaming-path test coverage (~80 LOC, ai-kit) · D8(a) site UI (migrate 3 FAQ pages to `<Faq>`, broaden `<Feature>`) · **D6 harvest (ADR-0133)** — 11 gridwork-core + 6 Wardfile lifts (Wave-3, spec-gated).
- Optional env: Trigger.dev key, `LHCI_GITHUB_APP_TOKEN`, waitlist `RESEND_*`.
- `CAISSON_PUBLISH_DRY_RUN=false` for real publish; move macOS native-ext CI leg onto the fleet.

## Git hygiene (classifier-blocked — run manually)

The go-live worktrees/branches are merged; the classifier blocked me from deleting them. Safe to run:

```bash
cd ~/lab/caisson
# prune merged worktrees
git worktree remove --force ~/lab/caisson-strix-pentest
git worktree remove --force ~/lab/caisson-wt/commerce-goes-live
git worktree remove --force ~/lab/caisson-wt/editions-goes-live
# delete merged local branches
git branch -D strix/pentest feature/commerce-goes-live feature/editions-goes-live audit/whole-repo-2026-07-01
# delete the 4 squash-merged locals (upstream gone, PRs #36-#39 merged)
git branch -D docs/close-deploy-class-p3-state feat/audit-harness-pipeline feat/edition-seam-completion fix/backlog-p3-defense-in-depth
# delete merged remote branches
for b in audit/whole-repo-2026-07-01 feature/commerce-goes-live feature/editions-goes-live strix/pentest; do git push origin --delete "$b"; done
```

**KEEP `origin/design/site-marketplace-rework`** — reported unmerged. Verify whether it's stale (PR#38
already shipped the marketplace rework, ADR-0189-0196) or holds unmerged work before deleting.

## Notes

- **Strix findings are pentest candidates, not confirmed bugs** — verify each against the code before
  acting; vuln-0003 is almost certainly the accepted CF-Access posture (ADR-0140).
- No new **decision forks** are open from this session — all go-live forks are locked (0187/0200-0203).
