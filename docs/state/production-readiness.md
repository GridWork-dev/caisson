---
updated: 2026-09-24
status: live
grounds:
  - docs/state/outstanding-work.md
  - docs/ops/launch-runbook.md
  - docs/deploy/STATE.md
  - outputs/specs/full-state-completion/SPEC.md
  - outputs/plans/full-state-completion/PLAN.md
  - registry/scripts/index-parity-probe.ts
  - outputs/executions/2026-07-25-github-certification.md
  - outputs/executions/2026-07-27-project-reconciliation.md
  - outputs/research/infra-provider-audit-2026-07-16.md
  - docs/ops/provider-console-checks.md
---

# Production readiness — Caisson

Live state, not historical optimism. “Healthy” means an endpoint answered; “parity” means the
deployed artifact is tied to the same approved immutable source revision. Paid launch remains
blocked until both technical and operator evidence is attached.

## Verdicts

| Dimension               | Verdict                                                                                                            | Current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository              | **local gates green**                                                                                              | 72 Bun workspaces; 199/199 tasks pass, 67 package gates pass with 5 scaffold skips; field-crypto KMS merged `13e814da` (#353) after four review rounds, scoped keys `0d878553` (#354) after three                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Deploy / infrastructure | **all six Railway services on an automated deploy path; main is ahead of the fleet by an unpublished version cut** | **As of 2026-09-24:** the push path (admin → demos → site → docs → support-bot) last ran green at `fd6f6084` (run 35815698009, 2026-09-23); `caisson-license` is dispatch-only and its newest receipt is `6604844a` (2026-09-14). The 2026-09-16 version cut (#487, 63 bumps, 47 new tarball rows) is unpublished, so the Worker's baked index and R2 trail the repo until the next release train; the index-parity "OK" below dates from before that cut. The `v2026.08.06.1` ride deployed **all five** Railway services at the tag (2026-08-07 00:45–00:56Z, locally driven), the first ride to cover docs and support-bot; post-deploy probe: all four legs `d2948ee2b5a8` · 54 entries, `RESULT: PARITY OK`, all public health endpoints 200. It also superseded a stale Actions-recovery backfill that had briefly deployed admin+site from the pre-Wave-B `04cf1ff4`. **Resolved 2026-08-19 for the four automated services:** the v2026.08.18 train's leg 4 finally ran green at the tag (run 32258237983) once Railway's snapshot stage recovered, and a main dispatch seven minutes later (run 32258937690) put admin, license, demos and site all on `main` — license had been stranded on 2026-08-12 because its leg is dispatch-only. **And closed for the other two the same day (ADR-0414):** docs still sits at `d9a56601` and support-bot at `26092936`, but the structural gap behind that drift is gone. The reason previously recorded here — "they deploy only via the release train" — was **false**: no workflow deployed them at all. `deploy-railway.yml` had only ever covered admin/license/demos/site, and the train's leg 4 is a dispatch of that same workflow; the v2026.08.06.1 ride that appeared to carry them was the operator hand-running `railway-deploy.ts` in the same sitting. Both services are now on that workflow's push path (docs → support-bot, after site), so the claim is true going forward rather than aspirational. Both cleared on ADR-0414's own merge (`cb33fdd7`, run 32285889495) — the merge commit touches `deploy-railway.yml`, which is in its own filter, so merging was the first ride: five legs green in 7m43s, docs in 2m14s. Caveat that came with it: a CI deploy commits no receipt, so `docs/deploy/receipts/*.json` is now stale for these two as well — read the deployment ledger, not the receipts. Sequenced with it: the `support-bot` Python gate was promoted from advisory to the sixth required check, because an advisory gate in front of an automatic deploy blocks nothing. History: the 2026-07-31 license-leg drift and its 2026-08-01 close-out are in [deploy STATE](../deploy/STATE.md) |
| Security                | **gaps**                                                                                                           | Limiter and provider adapters are implemented; four production technical receipts remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Commerce                | **blocked**                                                                                                        | Sandbox built; Paddle production approval/catalog and real transaction proof absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Operations              | **gaps**                                                                                                           | Restore rehearsed July 11; current backup recency and provider-console checks still required                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Buyer/product           | **local build complete; unproven in production**                                                                   | Design-manifest residual and all four locked families closed 2026-07-25, verified in the merged tree; none have a deployed probe receipt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Release                 | **proven four times; full-fleet leg 4 proven; `v2026.09.24` in preparation**                                       | `v2026.08.18` (2026-08-18) is the latest ride: legs 1/1b landed, leg 2 after a mid-train mirror-gate repair, leg 3 skipped, leg 4 on 2026-08-19 after a Railway platform incident (`docs/releases/v2026.08.18-checklist.md`). The next release attests through ADR-0425's reviewed-parent successor. Earlier rides: `v2026.07.27.1` (2026-07-28, first signed tag), `v2026.07.30` (2026-07-30, first autonomous leg 4), then `v2026.08.06.1` (2026-08-06) — the third ride ran every leg locally during the GitHub Actions outage, repaired a dud first tag (`v2026.08.06`, six stale sidecar rows from a split-base version consume — the dud stays, its successor carries the release), and deployed all five Railway services at the tag with `PARITY OK`. Two rules hardened by that repair: cut the version consume from the final post-all-merges main tip, and run the local byte-gate proof **before** any tag is cut. Leg 3 (npm) stays dormant by operator lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Evidence snapshot

### Repository and quality

- **2026-09-24:** `origin/main` is `a620da44` (#490), 58 commits past `v2026.08.18`; the S8
  hardening (#482, #484), the Bun 1.4.2 fleet (#481) and the 2026-09-16 version cut (#487) sit
  between. The paragraph below is the 2026-08-06 snapshot, kept for its release lineage.
- (2026-08-06) Local `main` and `origin/main` were identical at `d9a56601`, the `v2026.08.06.1`
  repair + attestation commit (#406) — the tagged release tip. Beneath it sit the 2026-08-06 sitting (Wave B
  #402, the four renovate merges #398–#401, version PR #405) and the `v2026.07.30` close-out
  (`3e16282e`), whose tree carries everything below plus that release itself: the version PR (#374),
  the deploy-status fix (`80748af3`), and the release attestation. It carries the validated
  writing surface, OSCAL spine/catalog, Ask AI evidence, two independently verified supply-chain
  pins, the dependency-baseline repair (#352), the field-crypto KMS async refactor (#353), the
  scoped-key change that replaced raw DEK access (#354), the runbook catalog truing (#355), the
  test-timeout repair (#356), and the whole 2026-07-29 sitting — post-tag audit remediation (#360),
  refund netting against the upgrade-credit floor (#361/#365, ADR-0394), the KMS deadline-test
  budget (#363), two runbook re-stamps (#362), two state reconciles (#364/#366), and the fleet
  deploy commit on top.
- `bun run check --force` passed 224/224 tasks with no turbo cache, 75 suites actually run and zero
  timeouts. The load-sensitivity previously recorded here is **fixed, not tolerated**: bun's 5s
  default test timeout was under 5x the idle cost of real work in this repo, so CPU contention alone
  decided pass or fail. `newTestPg()` boots a Postgres-in-WASM at 0.8-1.6s and grows within a
  process when instances are held rather than closed; `@caisson/ui`'s manifest generator takes ~4.0s
  for one pass and the determinism test runs two. #356 put `--timeout 60000` on all 74 test scripts,
  which is where it must live — bun does not read the root `bunfig.toml` from a package's working
  directory, and there is no environment-variable equivalent. A red run is now believable on the
  first reading rather than something to re-run at `--concurrency=1`.
- Dependency-cruiser false green is repaired in `c236681f`: TypeScript 6.0.3, 2,296 modules,
  1,630 TypeScript modules, 6,514 dependency edges, and `.ts`/`.tsx` sentinels.
- Total price authority is enforced in `f6122de8`, with the catalog type restored in
  `92d930b6`.
- Route-specific limiter infrastructure failures are enforced in `014ac4de`.
- Dependency-patch ownership is enforced by the audit harness in `3e384bc5`.
- `bun run sot` content gates are green, and three of them can now see what they used to report
  green over: `package-count-parity` additionally asserts the summary totals in build-state, the
  package catalog, and the public-surface heading; `frontmatter-freshness` compares each doc
  against its own last commit, not only its `grounds:`; and `changeset-gate-preflight` reports the
  real queued set on `main` instead of self-comparing to an empty diff. Branch-hygiene stays
  advisory-red on the five deliberately preserved reconcile-snapshot recovery refs plus whatever
  parallel-wave lanes are open at the time — the ADR-0328 convention, not drift.
- The changeset backlog has been drained three times: version PR #359 (`52376dee`, 54 files) shipped
  as `v2026.07.27.1`, version PR #374 (`ee467149`) consumed the 11 changesets from the #360–#366
  sitting and shipped as `v2026.07.30`, and version PR #405 consumed 30 and shipped as
  `v2026.08.06.1`. **Four Wave B changesets remain on `main` by documented deviation, not
  oversight:** the `v2026.08.06` consume was cut from a pre-Wave-B base, so Wave B's code shipped in
  the repaired packages' bytes while its changesets were never seen by the cut. They ride to the next
  cycle as ordinary bumps; their prose notes the code already shipped. Consuming them mid-release
  would have stranded six advertised versions.
- Private-repository access has been authorized since 2026-06-30 (`gh auth status`: active
  `repo`-scoped token; `caisson-sh/caisson` confirmed private). Branch protection stays
  discipline-only on the Free plan (ADR-0327) and org 2FA was declined 2026-07-15, re-raise at
  launch — both accepted residuals. Current PRs, Actions, releases, and public-repository timing
  were last broadly certified in
  [2026-07-25 GitHub certification](../../outputs/executions/2026-07-25-github-certification.md).
  That pass found an open-PR CI defect; its appended correction records the resolution — the three
  PRs it named (#332, #333, #334) carried a fully green rollup and have since merged, as have
  #335-#340. The unsigned-tag defect stands but is no longer an open question: ADR-0382 lock 2
  locked SSH signing going forward with an advisory readiness check. The current seven-PR cutoff
  and local dispositions are in the
  [2026-07-27 reconciliation](../../outputs/executions/2026-07-27-project-reconciliation.md);
  older GitHub tables are historical.

### Deploy and parity

**Re-opened 2026-07-31 on the license leg, closed 2026-08-01.** The 2026-07-29 reading had all four
legs equal at `4810e38157c1`. The `v2026.07.30` train then published a new index (`dc5ee000aebf`, 54
entries) and moved the Worker, admin, and site onto it — but **not** the license service, which kept
serving the pre-release index. `RESULT: DRIFT DETECTED`, exit 1.

The cause was structural, not a one-off: the train's leg 4 (`deploy-railway.yml`) deployed
`caisson-admin` and `caisson-site` and nothing else, while `caisson-license` bakes
`registry/index.json` into its image the same way. Every release left license one index behind.

Closed by a receipted redeploy at the release tag (`d9ae893e`; Railway deployment `dd6af196`
SUCCESS) plus a license step on leg 4 so it stops recurring. Re-probed after the deploy:

| Leg              | Digest                                    | State |
| ---------------- | ----------------------------------------- | ----- |
| Repository index | `dc5ee000aebf` — 54 entries               | OK    |
| License service  | `dc5ee000aebf` == repo                    | OK    |
| Registry Worker  | 17 served entries match repository latest | OK    |
| Admin            | `dc5ee000aebf` == repo                    | OK    |

`RESULT: PARITY OK`, exit 0.

The migration claim this section used to carry — that `0030`–`0032` were authored without
production-apply receipts — is also retired: the chain applied 2026-07-27 with `schema_version`
29 → 32 against a pg_restore-verified backup ([deploy state](../deploy/STATE.md)), and the tag's
pre-deploy re-ran it idempotently at 32.

**What genuinely remains uncertified:** docs-RAG and support-bot source parity. Both are private
Railway services with no public DNS, so the method used above cannot reach them. There is one
indirect path — the site proxies docs-RAG at `POST /api/ask` — but it is Turnstile-gated (verified
2026-07-29: `{"error":"challenge_failed"}`, HTTP 403), so it is a human path, not an automatable
receipt. Certifying these two legs requires either an operator-run probe from inside the Railway
network or a deliberate probe credential; neither exists today. Exit still requires all six runtime
legs built from one approved SHA plus health/checkout/entitlement/refund/RAG/support/KMS receipts.

### Commerce

- The target catalog is 36 products and 68 prices, including 27 module SKUs.
- Compliance’s operative displayed price is $1,649; Everything is $2,259.
- Production Paddle approval, product/price IDs, adjustment handling, dunning cancellation, and
  live checkout/refund/entitlement proof remain open.
- Dedicated refund/support routes merged in #333, and the OSCAL wave updates the mapping exporter
  to the exact 36-product/68-price target. They are still not production evidence, because nothing
  has been deployed or probed since. No live Paddle catalog mutation or production ID wiring has
  occurred.
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

**All four remaining residuals closed 2026-07-25** — verified in the merged tree, not inferred from
the PR titles:

1. Module-depth pages for access-review, risk-register, and trust-page — records present in
   `apps/site/lib/module-pages.ts` (#332).
2. Admin chain viewer with proof details and redacted export — `apps/admin/src/app/api/admin/audit/`
   `{proof,export}/route.ts` plus the internal proof seam at `api/internal/audit/proof` (#335).
3. Tenant self-service proof route with dashboard integration — `apps/site/app/api/audit/proof/`
   `route.ts` and `app/dashboard/evidence/page.tsx` (#335).
4. Buyer crosswalk matrix — `apps/site/components/tenant-evidence-dashboard.tsx` via
   `mapBuyerCrosswalk(latestPack.manifest)`, with `maps-to` and `implements` rendered as separately
   labeled edge kinds and never summed into one coverage figure, per ADR-0380 lock 3 (#335).

The evidence-export path these ship on was reshaped in the same wave by **ADR-0385**: the pack
carries no executable verifier, verification moves to the out-of-band `@caisson/verify-pack`, and
exports emit only fields their event schema names (fail closed).

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
