---
updated: 2026-07-25
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/ops/launch-runbook.md
  - docs/deploy/STATE.md
  - outputs/specs/full-state-completion/SPEC.md
  - outputs/plans/full-state-completion/PLAN.md
  - registry/scripts/index-parity-probe.ts
  - outputs/executions/2026-07-25-github-certification.md
  - outputs/research/infra-provider-audit-2026-07-16.md
  - docs/ops/provider-console-checks.md
---

# Production readiness — Caisson

Live state, not historical optimism. “Healthy” means an endpoint answered; “parity” means the
deployed artifact is tied to the same approved immutable source revision. Paid launch remains
blocked until both technical and operator evidence is attached.

## Verdicts

| Dimension               | Verdict                                      | Current state                                                                                                                                                     |
| ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository              | **local gates green; certification pending** | 79 Bun workspaces; 218/218 tasks pass; the open-PR CI defect is resolved (all three PRs green), so only concurrent-worktree hygiene and the unmerged waves remain |
| Deploy / infrastructure | **red parity**                               | Public probes answer, but license and admin manifest digests differ from repository/Worker                                                                        |
| Security                | **gaps**                                     | Limiter policy implemented; four technical receipts and three adapter audits remain                                                                               |
| Commerce                | **blocked**                                  | Sandbox built; Paddle production approval/catalog and real transaction proof absent                                                                               |
| Operations              | **gaps**                                     | Restore rehearsed July 11; current backup recency and provider-console checks still required                                                                      |
| Buyer/product           | **gaps**                                     | Design-manifest residual complete; four already-locked families remain                                                                                            |
| Release                 | **blocked**                                  | 33 pending changesets; no current CI/release certification or immutable tag-to-bytes receipt                                                                      |

## Evidence snapshot

### Repository and quality

- Baseline audited `main`: `fe2dfacaa2693578f49baf431f6d0865486174a6`.
- `bun run check` passed all 218 tasks on `b037b878`; formatting, standards, manifest drift, and
  dependency-graph guards are green.
- Dependency-cruiser false green is repaired in `c236681f`: TypeScript 6.0.3, 2,296 modules,
  1,630 TypeScript modules, 6,514 dependency edges, and `.ts`/`.tsx` sentinels.
- Total price authority is enforced in `f6122de8`, with the catalog type restored in
  `92d930b6`.
- Route-specific limiter infrastructure failures are enforced in `014ac4de`.
- Dependency-patch ownership is enforced by the audit harness in `3e384bc5`.
- `bun run sot` has every content/structure gate green. Its sole drift is branch hygiene because
  `/home/gw/lab/caisson-paddle-onboarding` exists concurrently on
  `feature/paddle-onboarding-setup`; this task did not remove another workstream.
- There are 33 pending changeset files. Current resolution affects 41 patch packages and 4 minor
  packages.
- Private-repository access has been authorized since 2026-06-30 (`gh auth status`: active
  `repo`-scoped token; `caisson-sh/caisson` confirmed private). Branch protection stays
  discipline-only on the Free plan (ADR-0327) and org 2FA was declined 2026-07-15, re-raise at
  launch — both accepted residuals. Current PRs, Actions, releases, and public-repository timing
  are certified in [2026-07-25 GitHub certification](../../outputs/executions/2026-07-25-github-certification.md).
  That pass found an open-PR CI defect; its appended correction records the resolution — all three
  open PRs (#332, #333, #334) now carry a fully green rollup. The unsigned-tag defect stands but is
  no longer an open question: ADR-0382 lock 2 locked SSH signing going forward with an advisory
  readiness check. Older GitHub tables are historical.

### Deploy and parity

The current registry parity probe reports:

| Leg                                  | Digest                                    | State               |
| ------------------------------------ | ----------------------------------------- | ------------------- |
| Repository index                     | `74e92a6813bc` — 53 entries               | OK                  |
| Registry Worker                      | 17 served entries match repository latest | OK                  |
| License service                      | `09adca8d32a5`                            | **DRIFT**           |
| Admin                                | `97b183902c08`                            | **DRIFT**           |
| Latest recorded site-only deployment | source `ea2bee11`, Railway `3120a2ef`     | not a fleet receipt |

Docs-RAG and support-bot source parity remain uncertified. Migration `0030` is authored but has no
production-apply receipt. Exit requires all six runtime legs built from one approved SHA, manifest
digest parity, and health/checkout/entitlement/refund/RAG/support probe receipts.

### Commerce

- The target catalog is 35 products and 66 prices, including 26 module SKUs.
- Compliance’s operative displayed price is $1,449.
- Production Paddle approval, product/price IDs, adjustment handling, dunning cancellation, and
  live checkout/refund/entitlement proof remain open.
- Dedicated refund/support routes and an exact 35-product/66-price mapping exporter are built on
  `feature/paddle-onboarding-setup`; they are not production evidence until merged, deployed, and
  probed. No live Paddle catalog mutation or production ID wiring has occurred.
- Fulfillment must recognize every current SKU and continue to reject unknown IDs.
- EIN is complete; it is no longer a blocker.
- Marketing remains public. Cart, dashboard, and checkout remain Cloudflare-gated.

### Security and technical acceptance

Implemented locally:

- Paddle webhook continues through limiter-infrastructure failure and emits a redacted operational
  alert.
- Issuer, admin, and evaluation routes return 503 on limiter-infrastructure failure.

Still required before paid launch:

1. COMPLIANCE-mode WORM receipt.
2. Deployed-pooler RLS receipt.
3. Split-brain recovery receipt.
4. KMS-signing receipt.
5. Independent security/conformance review of Inngest, Azure Key Vault, and Azure Blob adapters.
6. Two or three working-auditor acceptance reviews.

### Operations

Run the seven Gate D provider-console checks — [provider-console-checks](../ops/provider-console-checks.md)
— plus regenerate the dead `OPENROUTER_MANAGEMENT_KEY` (401s today; regeneration restores
per-key usage/attribution for the six per-service inference keys, per
[infra-provider-audit-2026-07-16](../../outputs/research/infra-provider-audit-2026-07-16.md) M2).
Arm anchoring only after its scheduler and TSA/Rekor/OTS egress ledger are ready.

### Buyer/product residuals

Completed locally: generated 39-component design-system manifest, byte drift guard, and
single-source browser-rendered contrast checks.

Still open:

1. Three module-depth pages for access-review, risk-register, and trust-page.
2. Admin chain viewer row status, proof details, provenance, redacted export, and redaction count.
3. Tenant self-service proof route with dashboard/demo integration.
4. Buyer-dashboard crosswalk matrix.

`substrate.field-crypto-policy` is no longer open — ADR-0381 drafted and locked its canonical
control content, resolving the binding the collector shipped without.

## Go/no-go sequence

```mermaid
flowchart LR
    A["Local code waves"] --> B["Full repository gates"]
    B --> C["One-SHA deploy + migration receipt"]
    C --> D["Four technical receipts"]
    D --> E["2–3 auditor acceptances"]
    E --> F["Paddle + business + Ring-3 gates"]
    F --> G["Paid/public go-no-go"]
```

No local green check substitutes for GitHub CI evidence, production parity, the four technical
receipts, independent acceptance, or the operator’s commerce/business decision.
