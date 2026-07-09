---
id: p1-buyer-breaking-fixes
title: "P1 — buyer-breaking defects: free-tier sample install, manifest price drift, mirror exporter hardening"
tags: []
status: spec
source: audit-v2 (ADR-0233)
---

# SPEC — P1 buyer-breaking defects (audit-v2 remediation)

**Wave:** P1 of the audit-v2 remediation triage (ADR-0233 ledger). Three buckets, one PR:
free-tier install breakage + displayed-price drift + mirror-exporter tooling hardening.

**Tags: none.** The manifest price drift is display/manifest sync against locked ADR numbers,
NOT money movement (the billing/Paddle price fields live elsewhere — `services/license` +
Paddle SANDBOX dashboard; `manifest.ts:priceCents` is the registry-display + standards-gate
field). No `billing` tag. No `security`/`auth` surface in caisson prod (the CI pinning is the
PUBLIC mirror repo's workflow hygiene — supply-chain posture, but not a caisson secret surface).

## Goal (WHAT + WHY)

Close the three buyer-trust defects the audit-v2 ledger pins on the public-mirror + manifest
surface — **so a free-tier buyer's first `bunx create-caisson` sample installs green, every
shipped `manifest.ts:priceCents` agrees with its locked ADR, and the mirror exporter can't
silently ship an un-renamed specifier, a wrong license claim, or an unpinned action** — proven
by a standards-gate run + a no-leak grep + a mirror re-export dry-run.

## Context

- **Source:** ADR-0233 audit-v2 ledger (`outputs/audit/ledger.toml`), 21 open findings across
  three buckets, all `domain = oss-mirror` or `packages/<x>` (D2/D3/D4/D6 dimensions).
- **Price authority:** ADR-0227 locks Compliance at **$799** (supersedes ADR-0137's $749);
  ADR-0129 locks audit-worm at **$149** and Local-first AI at **$399** (supersedes ADR-0106).
  ADR-0082 retires the "placeholder/subject-to-change" frame — displayed prices are committed.
- **Boundary with P2 (source-prose wave):** THIS spec owns the EXPORTER tooling
  (`scripts/export-public-mirror.ts` + `scripts/mirror-assets/*`) and the manifest price/value
  reconciliation. The P2 spec owns the broad SOURCE-prose sweep (internal narratives, ADR
  chains, "harvest program" mentions across `packages/*/README.md` + `AGENTS.md` bodies). The
  one-line license-CLAIM fix in `packages/migrate/README.md` (a binary factual error, not prose
  style) lands here as a guard + trivial source edit; the broader migrate-README prose cleanup
  is P2.

## Findings covered

| ID                                                                                              | Sev  | File                                                              | One-line                                                                                          | Disposition                                               |
| ----------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Bucket 1 — eu-ai-act-sample `@caisson/kernel` scope defect (root cause: `7533e88d886e6812`)** |
| `7533e88d886e6812`                                                                              | high | `scripts/export-public-mirror.ts:176-182`                         | ROOT CAUSE — `REWRITE_SKIP_DIRS` includes `"templates"`, so the sample's specifiers never rename. | fixed-by-this-spec                                        |
| `1ee147637b06ef65`                                                                              | high | `packages/cli/templates/eu-ai-act-sample/package.json:14`         | SS-9/SS-10: sample quickstart cannot install its stated `@caisson/kernel` dep.                    | fixed-by-this-spec                                        |
| `374d3b56a04fa277`                                                                              | high | `packages/cli/templates/eu-ai-act-sample/package.json:deps`       | Public `@caisson-sh/cli` ships a template depending on the unscoped `@caisson/kernel`.            | fixed-by-this-spec                                        |
| `9766ac4d2c92973b`                                                                              | high | `packages/cli/templates/eu-ai-act-sample/package.json:9`          | Free template declares a real npm dep on `@caisson/kernel` (third-party scope).                   | fixed-by-this-spec                                        |
| `b4dadb73ce5489c2`                                                                              | high | `packages/cli/templates/eu-ai-act-sample/package.json:14`         | License-free sample ships un-rewritten `@caisson/kernel` scope.                                   | fixed-by-this-spec                                        |
| `b5439e417adc61a5`                                                                              | high | `eu-ai-act-sample/package.json:14` + `src/evidence-path.ts:14-20` | SS-9: old `@caisson/kernel` scope un-rewritten in the public mirror.                              | fixed-by-this-spec                                        |
| `2b5df1f0ac1741ae`                                                                              | info | `eu-ai-act-sample/src/evidence-path.ts:14,20`                     | One template file still imports the un-renamed specifier.                                         | fixed-by-this-spec                                        |
| **Bucket 2 — manifest-vs-locked-ADR price/value reconciliation**                                |
| `81b08393d51a6c6c`                                                                              | high | `packages/compliance/manifest.ts:22`                              | Compliance `priceCents: 99900` ($999) vs locked $799 (ADR-0227).                                  | fixed-by-this-spec                                        |
| `16ccbe2026a53f7a`                                                                              | high | `packages/audit-worm/manifest.ts:15`                              | audit-worm `priceCents: 4900` ($49) vs locked $149 (ADR-0129).                                    | fixed-by-this-spec                                        |
| `b5d180701c0e3069`                                                                              | high | `packages/local-ai/manifest.ts:7-8`                               | "PLACEHOLDER" comment + `priceCents: 34900` ($349) vs locked $399 (ADR-0129).                     | reconcile-needed                                          |
| `af1cdb751ebb90c0`                                                                              | high | `packages/compliance/manifest.ts:1,8,14`                          | Leaks "standards-gate" tool name, "PLACEHOLDER" admission, stale ADR-0012 framing.                | fixed-by-this-spec                                        |
| **Bucket 3 — mirror exporter-tooling hardening**                                                |
| `d88c2d9030c9e5e4`                                                                              | high | `scripts/export-public-mirror.ts`                                 | Exporter renames scopes + drops test files but never sanitizes README/AGENTS/CHANGELOG prose.     | fixed-by-this-spec (exporter pass) — P2 owns source prose |
| `98c91a4cca39fec1`                                                                              | high | `packages/billing/README.md:1` (+ CHANGELOGs)                     | CHANGELOG "Updated dependencies" + README titles never scope-renamed.                             | fixed-by-this-spec                                        |
| `6c975cfc31c03a6f`                                                                              | high | `packages/license-verify/manifest.ts:10`                          | Every exported `manifest.ts` imports `../../registry/schema/module-manifest` — dangles in mirror. | fixed-by-this-spec                                        |
| `c018d53b61e0d0d7`                                                                              | info | `tooling/tsconfig/base.json:3`                                    | tsconfig `displayName` shows stale `@caisson/tsconfig` (exporter misses it).                      | fixed-by-this-spec                                        |
| `9b45bc6081d5325d`                                                                              | info | `scripts/mirror-assets/README.md:44-62`                           | Mirror README package table omits `@caisson-sh/eslint-config`.                                    | fixed-by-this-spec                                        |
| `cafad39256c107ff`                                                                              | warn | `README.md:44-62` (exported)                                      | Same — exported mirror README omits `@caisson-sh/eslint-config`.                                  | fixed-by-this-spec                                        |
| `b7198f6d6867ef39`                                                                              | high | `packages/migrate/README.md` (exported)                           | Apache package ships a wrong commercial-license claim.                                            | fixed-by-this-spec (guard + 1-line source fix)            |
| `2ad0bf119c3853b8`                                                                              | warn | `scripts/mirror-assets/ci.yml:1`                                  | Mirror CI omits `permissions:` block + `persist-credentials: false`.                              | fixed-by-this-spec                                        |
| `a64e456edc84d483`                                                                              | warn | `scripts/mirror-assets/ci.yml:12-13`                              | Mirror CI pins actions by mutable tag, not commit SHA.                                            | fixed-by-this-spec                                        |
| `eec917dfb56e130c`                                                                              | warn | `scripts/mirror-assets/publish.yml:48,54` + ci.yml                | publish.yml checkout/setup-node also tag-pinned (setup-bun already SHA).                          | fixed-by-this-spec                                        |

## Approach

### §1 — Bucket 1: extend the exporter rewrite to walk `packages/cli/templates/eu-ai-act-sample/**`

**Root cause (pinned by `7533e88d886e6812`):** `scripts/export-public-mirror.ts:176-182` lists
`"templates"` in `REWRITE_SKIP_DIRS`, so `rewriteImportsInTree` never descends into
`packages/cli/templates/`. The eu-ai-act-sample's `src/evidence-path.ts` imports
`@caisson/kernel` and its `package.json` declares `"@caisson/kernel": "^0.1.0"` — both ship
un-rewritten into the `@caisson-sh/cli` mirror package. The exporter's own header (line 9-14)
admits `@caisson` is a third-party scope that doesn't resolve on public npm; the sample's
quickstart therefore fails on `bun install` for any buyer who hasn't configured the commercial
registry.

**Why scoped rewrite, not a global un-skip:** the `REWRITE_SKIP_DIRS` comment (line 173-175)
intention is sound for FUTURE templates that genuinely carry buyer-repo data served by the
commercial registry. The eu-ai-act-sample is different: it is Apache-2.0, demonstrates an OPEN
primitive (`@caisson/kernel` audit-chain, itself Apache-2.0), and ships inside the public
`@caisson-sh/cli`. Its specifiers MUST resolve from public npm. A targeted rewrite of this one
template's tree is the root-cause fix; a global un-skip would silently rewrite future
commercial-registry templates.

**Tasks:**

| #   | File target(s)                                                                                                  | Deliverable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | `scripts/export-public-mirror.ts` — new `rewriteCliTemplates(outDir)` called after `copyPkg` for `@caisson/cli` | Walks `packages/cli/templates/eu-ai-act-sample/**` in the DEST tree; rewrites `@caisson/x` → `@caisson-sh/x` in (a) `.ts`/`.js` import specifiers (reuse `rewriteImportSpecifiers`) and (b) nested `package.json` `dependencies`/`devDependencies`/`peerDependencies` keys (reuse `renameScope`). Does NOT touch the `"name": "{{projectName}}"` field (template variable) or the `description` prose (the `@caisson/kernel` mention there is a docstring, addressed by §3 prose-sanitize if warranted). |
| 1.2 | `scripts/export-public-mirror.ts` — `EXCLUDE_TEST_FILES` entry for `packages/cli/src/sample-templates.test.ts`  | Re-evaluate: after 1.1 the mirror's sample resolves `@caisson-sh/kernel`, so the test COULD run. Keep the exclusion unless the test's source assertions are updated to expect `@caisson-sh/kernel` (separate concern — leave excluded, note in comment).                                                                                                                                                                                                                                                 |
| 1.3 | `packages/cli/src/sample-templates.test.ts` (source, if the test hard-codes `@caisson/kernel`)                  | If the test greps for `@caisson/kernel` in the materialized output, add a `ponytail:` note that the mirror rewrites this to `@caisson-sh/kernel` (the source template stays `@caisson/kernel` — monorepo-native). Source test unchanged.                                                                                                                                                                                                                                                                 |

**Verify:** `bun scripts/export-public-mirror.ts --out /tmp/p1-mirror --generated-at 2026-07-03 && grep -r "@caisson/" /tmp/p1-mirror/packages/cli/templates/eu-ai-act-sample/ || echo "CLEAN: no un-rewritten @caisson/ specifiers in the sample"` — the grep must find ZERO `@caisson/` hits in the sample tree (all renamed to `@caisson-sh/`).

---

### §2 — Bucket 2: manifest price/value reconciliation + ADR-traceability guard

**Root cause:** `manifest.ts:priceCents` fields were set as "PLACEHOLDER" values under the
pre-launch ADR-0012 anchors and never reconciled when ADR-0227 / ADR-0129 locked the final
numbers. ADR-0082 retired the "placeholder" frame; the manifests still carry both the stale
numbers AND the stale "PLACEHOLDER" prose in their header comments.

**Price authorities (no fork — these are locked):**

| Package    | Manifest current | Locked (ADR)        | Fix                       |
| ---------- | ---------------- | ------------------- | ------------------------- |
| compliance | `99900` ($999)   | **$799** (ADR-0227) | `priceCents: 79900`       |
| audit-worm | `4900` ($49)     | **$149** (ADR-0129) | `priceCents: 14900`       |
| local-ai   | `34900` ($349)   | **$399** (ADR-0129) | **RECONCILE** — see below |

**Reconcile-needed (`b5d180701c0e3069`):** the finding flags the "PLACEHOLDER" COMMENT, but
the NUMBER is also stale — ADR-0012 anchored $349, ADR-0106 raised to $499, ADR-0129 LOCKED at
$399 (superseding 0106). The manifest's $349 matches the long-superseded ADR-0012 anchor.
**Per the one operator rule (CLAUDE.md): never auto-decide a fork on pricing.** This SPEC sets
the COMMENT fix (remove "PLACEHOLDER", cite ADR-0129) but PARKS the $349→$399 number change for
a one-line operator confirmation. If the operator confirms $399, the change rides this PR; if
not, a follow-up ADR supersedes ADR-0129 and the manifest picks up whatever the new lock says.

**Tasks:**

| #   | File target(s)                                                                                              | Deliverable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `packages/compliance/manifest.ts`                                                                           | `priceCents: 99900` → `79900`. Rewrite the header comment (lines 1-12): remove "PLACEHOLDER pending the still-open Pricing lock", cite ADR-0227 as the authority, drop the internal tool name ("standards-gate") from the prose (keep `defineModule` import ref). Fixes `81b08393d51a6c6c` + `af1cdb751ebb90c0`.                                                                                                                                                                                                                      |
| 2.2 | `packages/audit-worm/manifest.ts`                                                                           | `priceCents: 4900` → `14900`. Rewrite the header comment (lines 4-6): remove "PLACEHOLDER (4900)", cite ADR-0129 as the authority. Fixes `16ccbe2026a53f7a`.                                                                                                                                                                                                                                                                                                                                                                          |
| 2.3 | `packages/local-ai/manifest.ts`                                                                             | Comment-only fix in this PR: remove "PLACEHOLDER" framing (lines 7-8), cite ADR-0129 as the authority for the $399 lock. **Leave `priceCents: 34900` unchanged pending operator reconcile.** Partial fix for `b5d180701c0e3069`; the number change is queued behind the reconcile flag.                                                                                                                                                                                                                                               |
| 2.4 | `tooling/standards-gate/src/checks.ts` (+ `checks.test.ts`) — new `checkManifestPriceAgreement(pkgs, root)` | Root-cause guard so the next manifest drift is caught at PR time. Reads each `packages/*/manifest.ts:priceCents` and asserts it matches a `PRICE_AUTHORITY` map (a new const in `checks.ts`, keyed by package id, value = locked priceCents + citing ADR). Fails the gate on drift. Seed the map with the three locks above + every other edition/module price locked by ADR-0106/0129/0227 (compliance 79900, audit-worm 14900, local-ai 39900 PENDING reconcile, etc.). The map IS the single place to update when an ADR reprices. |

**Verify:** `bun test tooling/standards-gate/src/checks.test.ts && bun run gate` — the new check passes (manifests agree with the PRICE_AUTHORITY map), and `grep -n PLACEHOLDER packages/*/manifest.ts` returns zero hits.

---

### §3 — Bucket 3: mirror exporter-tooling hardening

**Boundary:** the prose-sanitization pass here is EXPORTER-SIDE — a mechanical rename/validate
pass the exporter runs on the DEST tree. It does NOT edit source prose (that's P2). The pass
catches: un-renamed `@caisson/` mentions in README/CHANGELOG bodies, wrong license claims, and
the `displayName` miss. Source-prose quality (internal narratives, ADR chains) is P2.

**Tasks:**

| #   | File target(s)                                                                                                 | Deliverable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `scripts/export-public-mirror.ts` — extend `rewriteImportSpecifiers` OR add `rewriteProseMentions`             | After `rewriteImportsInTree`, run a prose pass over `README.md`, `CHANGELOG.md`, `AGENTS.md` in each exported package: rewrite `@caisson/x` → `@caisson-sh/x` in prose mentions (the scope rename IS the public-naming truth). This is the sibling of P2's source-prose sweep — P2 fixes the source, this prevents the mirror from shipping stale. Fixes `d88c2d9030c9e5e4` (exporter-side) + `98c91a4cca39fec1`.                                                                                                                                               |
| 3.2 | `scripts/export-public-mirror.ts` — handle nested `manifest.ts`                                                | Two options (pick at EXECUTE time, both are root-cause): (a) **exclude `manifest.ts` from the mirror** — it is the standards-gate's contract artifact, and standards-gate does NOT ship in the mirror (not in `BUILD_SUPPORT`), so the manifest is dead weight + its `../../registry/schema/module-manifest` relative import dangles; OR (b) rewrite the import to `@caisson-sh/registry-schema/schema/module-manifest` (the exported open package). Option (a) is lazier and correct — the mirror has no consumer for `manifest.ts`. Fixes `6c975cfc31c03a6f`. |
| 3.3 | `scripts/export-public-mirror.ts` — extend `rewriteTsconfigRefs` to also rewrite `displayName`                 | The current `rewriteTsconfigRefs` (line 199-213) rewrites `extends` refs but misses the `displayName` field in `tooling/tsconfig/base.json`. Add a `displayName` rewrite (same `@caisson/` → `@caisson-sh/` mechanic). Fixes `c018d53b61e0d0d7`.                                                                                                                                                                                                                                                                                                                |
| 3.4 | `scripts/mirror-assets/README.md` — package table                                                              | Add a row for `@caisson-sh/eslint-config` (the exporter always exports it as build-support; the table currently lists 17 and omits it). Fixes `9b45bc6081d5325d` + `cafad39256c107ff`.                                                                                                                                                                                                                                                                                                                                                                          |
| 3.5 | `scripts/export-public-mirror.ts` — license-claim validator + `packages/migrate/README.md` (1-line source fix) | Add a post-copy assertion: for each exported package, grep its `README.md` for a `## License` / `License:` claim and assert it matches the package's `package.json:license` (Apache-2.0 for the open set). Fail the export on mismatch. Fix the one source offender (`packages/migrate/README.md` wrong commercial-license claim → Apache-2.0). The broader migrate-README prose cleanup is P2. Fixes `b7198f6d6867ef39`.                                                                                                                                       |
| 3.6 | `scripts/mirror-assets/ci.yml` + `scripts/mirror-assets/publish.yml`                                           | (a) Add `permissions: contents: read` to `ci.yml` (publish.yml already has `contents: read, id-token: write`). (b) Pin every third-party action by commit SHA, not mutable tag: `actions/checkout@v4` → SHA, `actions/checkout@v5` → SHA, `oven-sh/setup-bun@v2` → SHA, `actions/setup-node@v4` → SHA. (`publish.yml`'s `setup-bun` is already SHA-pinned — match it.) Fixes `2ad0bf119c3853b8` + `a64e456edc84d483` + `eec917dfb56e130c`.                                                                                                                      |

**Verify:** `bun scripts/export-public-mirror.ts --out /tmp/p1-mirror --generated-at 2026-07-03` exits 0; `grep -rn "@caisson/" /tmp/p1-mirror --include=README.md --include=CHANGELOG.md --include=AGENTS.md` returns zero un-renamed prose mentions (excluding the intentional `@caisson/` product-scope note in the root README); the new license-claim validator does not fire.

## Verify (goal-backward)

Re-ask the Goal — _did the free-tier sample install green, do manifests agree with locked ADRs, and can the exporter no longer ship a stale specifier / wrong license / unpinned action?_

1. **Sample installs.** `cd /tmp/p1-mirror/packages/cli/templates/eu-ai-act-sample && bun install && bun test` succeeds — the sample's `@caisson-sh/kernel` dep resolves from public npm, no commercial-registry configuration required.
2. **No un-rewritten specifiers.** `grep -rn "@caisson/kernel" /tmp/p1-mirror/packages/cli/templates/` returns zero hits (all renamed to `@caisson-sh/kernel`).
3. **Manifests agree with ADRs.** `bun run gate` is green — the new `checkManifestPriceAgreement` passes for compliance (79900) + audit-worm (14900); local-ai's number is parked behind the reconcile flag (the check seeds local-ai at 34900 with a `RECONCILE` marker until the operator confirms 39900).
4. **No "PLACEHOLDER" admissions.** `grep -rn PLACEHOLDER packages/*/manifest.ts` returns zero hits.
5. **Exporter catches drift.** The license-claim validator + the prose-mention rewrite fire on a deliberately-broken fixture (a README claiming commercial license, an un-renamed `@caisson/` mention) — assert in `scripts/export-public-mirror.test.ts` or a fixture dry-run.
6. **CI hygiene.** `grep -E "uses: actions/|uses: oven-sh/" scripts/mirror-assets/*.yml` shows every action pinned by SHA (no `@v4`/`@v5`/`@v2` tags), and `ci.yml` carries a `permissions:` block.
7. **Gate green.** `bun run check && bun run gate` pass on the source repo.

## Non-goals

- **No Paddle/billing price change.** `manifest.ts:priceCents` is the registry-display +
  standards-gate field, NOT the Paddle checkout amount (that lives in the Paddle SANDBOX
  dashboard + `services/license`). The billing path is untouched — hence no `billing` tag.
- **No new ADR.** Every price fix here cites an existing locked ADR (0227 / 0129). The
  local-ai number is parked pending operator confirm, not re-locked here.
- **No source-prose sweep.** The broad cleanup of internal narratives / ADR chains / "harvest
  program" mentions across `packages/*/README.md` + `AGENTS.md` bodies is the P2 wave. This
  spec adds the EXPORTER guard + the one binary-factual migrate license-claim fix only.
- **No lifting of the `sample-templates.test.ts` exclusion** unless the test's assertions are
  updated in the same PR (left as a follow-on note in task 1.2).
- **No standards-gate export to the mirror.** Task 3.2 excludes `manifest.ts` from the mirror
  because its consumer (standards-gate) doesn't ship there. We do NOT start exporting
  standards-gate.

## Out-of-scope (adjacent findings, other homes)

- **`affb65041821b8ee`** (`packages/field-crypto/README.md` names `media-pipeline`) — P2
  source-prose wave.
- **`b736da584ac06e71`** (`packages/registry-schema/CHANGELOG.md:21`) — P2 source-prose wave.
- **All other D3/D4 source-prose findings** across `packages/*/README.md` + `AGENTS.md` — P2.
- **The local-ai `priceCents` number change** ($349 → $399) — parked behind the reconcile flag
  (task 2.3); rides this PR on operator confirm, else a follow-up.
- **Mirror `publish.yml` NPM_TOKEN arming** — that is an operator-gated launch step
  (ADR-0222), not a defect fix; this spec only pins the action versions + adds the permissions
  block.
- **Registry index/ledger rebuild** — the manifest `priceCents` change does NOT trigger a
  registry republish (priceCents is not a ledger-indexed field per the members-fold convention;
  the registry serves module-ids + versions + frozen member pins, not prices). If EXECUTE finds
  otherwise, queue a separate changeset-wave task.

## Effort / Value

**Effort: S–M** — bucket 1 is a targeted exporter extension (~30 LOC + verify); bucket 2 is four
small manifest edits + one new standards-gate check (~60 LOC); bucket 3 is six exporter/asset
patches (~80 LOC). **Value: HIGH** — closes the free-tier first-run breakage (a buyer-facing
defect), aligns shipped manifests with locked ADR prices (buyer-trust), and hardens the mirror
exporter against silent specifier/license/CI drift — all before the public mirror goes live.
