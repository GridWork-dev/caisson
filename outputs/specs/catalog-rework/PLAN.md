---
status: locked
date: 2026-07-06
spec: outputs/specs/catalog-rework/SPEC.md
adr: [ADR-0257, ADR-0258]
tags: [billing, external-system, security, ui, frontend]
---

# Catalog-rework PLAN — PRable waves, atomic tasks, routing

**Execution mode:** operator approves this PLAN → unattended EXECUTE→VERIFY→SWEEP→SHIP per
wave (doctrine autonomy line); re-entry gates: VERIFY fail · risk-tag fire · the two
operator-review diffs called out below (EULA defined term; Paddle big-bang). Every task
declares `model`; parallel writers take worktree isolation. Merge-latency note: nearly every
wave lands on the greptile-gate critical path (auth/tenancy-rls/billing/credits/registry/
standards-gate globs) — budget the up-to-35-min review wait per PR; new package dirs get
their glob + `.greptile/rules.md` row in the same PR that creates them. Every touched
`packages/*` dir carries a changeset (private packages included; `git add` the changeset
before the gate runs).

**Cross-kickoff dependency:** W3 (claims) and any `services/license` edit wait for Kickoff
E's PR #128 (ADR-0255 `updatesWindows`) to merge. W0–W2 don't touch those files and start
immediately. If #128 slips, W3 reorders after W4–W6 without unblocking risk.

---

## W0 — Vocabulary + schema spine (1 PR)

| #   | Task                                                                                                                                                                                                                                                              | Verify                                                                                     | Route                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| 0.1 | `registry-schema`: add `"bundle"` to MODULE_KINDS (additive; edition entries stay valid); new shared bundle-vocabulary module (new bundle ids, legacy-alias map `compliance/ai-kit/local-ai/agent-dev/bundle → new ids`); export for E's RENEWAL_BOOK consumption | `bun test packages/registry-schema`; alias round-trip test: legacy id → identical leaf set | fable (entitlement seam)   |
| 0.2 | `expandEntitlements`: alias resolution at the single entry point; `membersOfEdition`→`membersOfBundle` generalization; TM-E throw untouched (test pins it)                                                                                                        | expansion test suite + new alias/negative cases                                            | fable                      |
| 0.3 | Reconcile hand-copies: standards-gate `EDITION_NAMES`, site `EDITION_IDS` → the constant; re-baseline the 4 `kind:"edition"` fixture/test sites additively                                                                                                        | `bun run check` + standards-gate green                                                     | sonnet (gw-typescript-pro) |
| 0.4 | Refresh the stale outstanding-work production-Paddle row to the target catalog                                                                                                                                                                                    | `bun run sot`                                                                              | haiku                      |

## W1 — Extractions (5 parallel PRs, worktree-isolated; each: changeset + gate rows + greptile glob)

| #   | Task                                                                                                                                                                                                                                                                                      | Verify                                                                                               | Route                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1.1 | Compliance 3-SKU carve: `compliance-core` / `frameworks-pack` / `signing-primitive` out of packages/compliance; compliance meta keeps composition; golden/OSCAL suites re-partitioned                                                                                                     | 4 gates (check · standards-gate · full turbo build · targeted tests); install proof per SKU          | fable (license/crypto seam)        |
| 1.2 | `org-controls`: workos.ts + narrow membership carve (session-resolution STAYS in open auth) + all 6 admin-write exports (+ ~35-LOC role-guard resolution) + `/dashboard/members` entitlement gate                                                                                         | login works with NO org entitlement (regression test); members page 402/allow matrix; dual-log check | fable (auth seam)                  |
| 1.3 | `billing-orchestration` carve: ~93% of billing moves; LemonSqueezy/Polar verify fns extracted to open files; `BillingProvider` + `DomainBillingEvent` stay open; tests re-partitioned; consumers repointed (services/license ×3, apps/site ×2, apps/base fixtures)                        | 4 gates; apps/base free-floor demo still builds against OPEN billing only                            | fable (money seam)                 |
| 1.4 | Local-ai 3-way carve, ORDERED: extract `local-privacy` → repoint inference's 5 EgressGuard sites → extract `local-inference` → extract `local-sync` (clean)                                                                                                                               | per-SKU install proof (no ADR-0238 wall); apps/local-ai demo green                                   | sonnet, fable reviews              |
| 1.5 | Brand extraction: `brand` package (private, license-issue pattern, no manifest — accept the WARN); `registerIcons()` module-registry extension point; dashboard-shell explicit brand prop; credential-strip aria-label unhardcoded; mirror-allowlist untouched (auto-excluded by license) | both apps build; visual check on dashboard sidebar; mirror-export dry run excludes brand             | sonnet (gw-frontend-designer lane) |

## W2 — cli decouple → credits flip (1 PR, sequenced inside W1 window)

| #   | Task                                                                                                                                          | Verify                                                                      | Route              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| 2.1 | `GenerationDeps.debit` required injection port in cli/meter.ts; credits → devDependency; manifest dep dropped; apps/base wires concrete debit | cli integration tests; `bun run check`                                      | sonnet             |
| 2.2 | credits flips commercial ($149): manifest tier/license/priceCents; OPEN_BASE_NAMES removal; PRICE_AUTHORITY row; stale comments updated       | standards-gate green (boundary check proves cli clean); publish-config test | fable (money seam) |

## W3 — F7/F8 mechanics (1 PR; AFTER Kickoff E PR #128)

| #   | Task                                                                                                                                                                                          | Verify                                                                         | Route                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| 3.1 | pricebook bundle-membership timeline (append-only, backfilled with lock dates) + F8 upgrade-credit map + `resolveUpgradeCredit` (fail-closed)                                                 | book tests incl. unmapped-pair throw; below-sum/credit-floor cases             | fable                        |
| 3.2 | Checkout crediting: cart reads the map (`bundle − owned` retail, floor $0, never ad-hoc)                                                                                                      | cart/checkout tests; crediting matrix vs owned sets                            | fable                        |
| 3.3 | `entitledSince` claims record (sibling of `updatesWindows`, absent=grandfathered) through license-issue/verify + services/license; per-member join-date fail-soft filter in `membersOfBundle` | issue→verify round-trip old+new tokens; grandfather case; TM-E pin stays green | fable (signed-artifact seam) |

## W4 — Standards-gate catalog checks (1 PR; early is better — self-verifies W5)

| #   | Task                                                                                                                                                                                             | Verify                                                                                | Route               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------- |
| 4.1 | `sellable` manifest field (schema prerequisite); platform-reads/pricebook declared bundle-only                                                                                                   | registry-schema tests                                                                 | sonnet              |
| 4.2 | Four checks: price-coverage (error) · orphan-SKU (error) · catalog↔manifest parity (error; promotes the pricing.test.ts lint) · reserved-ids staleness (warn) + clean the two live stale entries | gate runs green on the tree; each check has a real-tree test (publish-config pattern) | sonnet, opus review |

## W5 — Bundle objects + members-fold republish (1 PR + the manual ritual)

| #   | Task                                                                                                                                                                                                                                                         | Verify                                                                         | Route            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------- |
| 5.1 | Bundle manifests (kind bundle, new ids): Compliance / AI-Production (+ai-evals, credits) / Local-first (+3 carves) / Agentic-Dev / Provenance (net-new) / Everything (explicit full-catalog rule: ui-pro IN, brand/private OUT — replaces `bundleMembers()`) | expansion tests per bundle; Everything content test pins ui-pro in + brand out | fable            |
| 5.2 | ADR-0228 ritual: consume changesets → repin members maps → `ci-publish-step.ts --dry-run false` → index rebuild → **manual drift verification** (checklist in PR body)                                                                                       | `full-tree-index` test; W4 parity check green; ledger append-only diff review  | opus main thread |
| 5.3 | ai-evals standaloneOnly drop; RENEWAL_BOOK lookup normalized through the alias map; net-new RENEWAL_BOOK rows (Provenance, carves, org-controls, ui-pro, credits) at real cents                                                                              | renewal lookup tests old+new ids                                               | fable            |

## W6 — Display + docs + legal (2 PRs: data/pages · legal/docs)

| #   | Task                                                                                                                                                                     | Verify                                                                      | Route                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------- |
| 6.1 | pricing.ts rework: 1:N `bundles[]`, new numbers (ADR-0258 sheet), catalog/cart kind edition→bundle (site layer only), membership lint extended                           | pricing tests + parity gate; cart round-trip                                | sonnet                |
| 6.2 | Hub: Bundles tab (6 cards), category facet, Provenance persona page, ui-pro catalog card; 25 "four editions" copy sites + JSON-LD swept                                  | build + contrast/a11y gates; F1b coverage check: every sellable SKU visible | gw-frontend-designer  |
| 6.3 | Legal/docs: EULA defined-term generalization (**operator reviews this diff**); license-summary restructure; docs tree provenance/ move + signing-primitive.mdx; llms.txt | build; link check; operator sign-off recorded in PR                         | sonnet, operator gate |

## W7 — Paddle big-bang + retire + flip (1 PR; LAST; **operator reviews**)

| #   | Task                                                                                                                                                         | Verify                                                                                                | Route              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------ |
| 7.1 | Sandbox rebuild: ~16 SKU products + 6 bundle prices + renewal rows at real cents; pricebook re-point; retire 4 edition products; E's placeholder cents trued | sandbox checkout smoke per SKU class (module/bundle/renewal); fulfillment resolves every new price id | fable (money seam) |
| 7.2 | Display flip + tracker/docs/state refresh; below-sum + ladder re-verified in CI                                                                              | full gates; goal-backward VERIFY vs SPEC §4                                                           | opus main thread   |

---

**Wave order:** W0 → {W1 ∥ W2} → W4 → W5 → {W3 when #128 merged — anywhere after W0} →
W6 → W7. The ratchet clears at W5 (all OSS-line moves landed) — first `confirm=publish`
stays blocked until then regardless of the operator credential-rotation checklist.
