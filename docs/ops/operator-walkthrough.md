---
updated: 2026-09-24
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/state/decisions-and-forks.md
  - docs/state/production-readiness.md
  - docs/deploy/STATE.md
  - docs/business/caisson-internal-master-map.md
  - outputs/executions/2026-07-25-github-certification.md
  - docs/ops/provider-console-checks.md
---

# Operator walkthrough — remaining human gates

Use the repository hierarchy, not an external artifact:

1. [Outstanding work](../state/outstanding-work.md) — executable work.
2. [Fork board](../state/decisions-and-forks.md) — unresolved operator decisions.
3. [Production readiness](../state/production-readiness.md) — evidence-backed launch state.
4. [Deploy state](../deploy/STATE.md) — immutable deployment receipts.
5. [First-sale master map](../business/caisson-internal-master-map.md) — business/adviser gates.

## Gate A — evidence and acceptance

- [ ] GitHub private-repository access is authorized (has been since 2026-06-30); branch
      protection stays discipline-only on the Free plan (ADR-0327) and org 2FA is declined,
      re-raise at launch — both accepted residuals. The two open-PR CI defects the
      [2026-07-25 GitHub certification](../../outputs/executions/2026-07-25-github-certification.md)
      named have since merged green (#332–#340); what remains is authorizing + attaching the
      current PR/Actions/release/branch/2FA evidence bundle at launch.
- [ ] Produce COMPLIANCE-WORM, deployed-pooler RLS, split-brain recovery, and KMS-signing receipts.
- [ ] Obtain two or three working-auditor acceptance reviews.
- [ ] Resolve or explicitly defer all 14 counsel, 8 CPA, and 9 operator questions.
- [ ] Complete all 18 first-sale business gates and record the paid-launch go/no-go.

## Gate B — production reconciliation

- [ ] Select the approved immutable commit and rollback target.
- [ ] Deploy site, admin, license, docs-RAG, support-bot, and registry Worker from that commit.
- [ ] The migration chain is already applied in production (`0030`–`0032` on 2026-07-27,
      `schema_version` 29 → 32; `0033` on 2026-07-29 → 33 — see
      [deploy state](../deploy/STATE.md)); before the KMS probe, re-attach schema, forced-RLS,
      tenant-policy, and append-only-trigger receipts taken at the launch commit.
- [ ] Prove manifest-digest parity plus health, checkout, entitlement, refund, RAG, and support.
- [ ] After the fleet deploy, confirm docs/support answer Compliance at $1,649 and Everything at
      $2,259, and license fulfillment recognizes all current SKUs.

## Gate C — commerce and Ring 3

- [ ] Complete Paddle production approval.
- [ ] Recreate the 36-product/68-price production catalog.
- [ ] Configure adjustment and dunning behavior.
- [ ] Prove a real checkout, refund, and entitlement lifecycle.
- [ ] Complete Mercury setup.
- [ ] Create and allowlist the Ring-3 probe account, deploy admin, and verify GitHub OAuth.

## Gate D — provider and security console reads

Seven provider-console checklists (Railway, Arnica, Grafana, Blacksmith, DMARC, key parity,
Bedrock) — see [provider-console-checks](provider-console-checks.md) for the per-console steps.
The Blacksmith check is superseded since CI moved to Ubicloud on 2026-09-10; its replacement is
not yet written (provider-console-checks §4).

- [ ] Complete all seven console checks in provider-console-checks.md.
- [ ] Launch copy of `SESSION_TOKEN_HMAC_KEY`.
- [ ] Regenerate the dead `OPENROUTER_MANAGEMENT_KEY` (401s today; restores per-key usage/attribution
      for the six per-service inference keys).
- [ ] Arm the WORM anchor scheduler only after TSA/Rekor/OTS egress is ledgered.

## Gate E — public release

- [ ] Keep marketing public and cart/dashboard/checkout Cloudflare-gated through verification.
- [ ] Approve the immutable version tag and exact-byte publish receipt.
- [ ] Flip the OSS repository and npm delivery only after the business and release gates.
- [ ] Remove commerce gates at launch and immediately record GOVERNANCE→COMPLIANCE WORM proof.
- [ ] Run Show HN only after the public artifacts work.

## Gate F — demand

Only after all four technical receipts:

- [ ] Start the four-instrument 30-day demand program.
- [ ] Run buyer-map interviews.
- [ ] Prove the discounted-partner offer.
- [ ] Send the five design-partner emails.

FixAEO, affiliate work, directories, multi-year pricing, production CMK, ISO claims, Railway PITR,
vertical packages, MySQL, Socket, SOC 2, AuditKit, and rich OSCAL remain optional or
trigger-parked; they are not launch-path substitutions.
