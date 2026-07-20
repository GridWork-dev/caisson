# R4 release audit — v2026.07.20

**Window:** `v2026.07.19.1..c262c0c7` (tag base `a49d82fd`) — 27 commits on `main`. The ride: native TS-7 cutover via `tscn` (#294), 12 module depth pages + ai-evals membership truth fix (#295), bespoke module marks (#296), dep-digest transitive-reach watcher + dts-drift gate + Renovate `matchDepNames` fix (#297), glossary expansion + 36-page content audit (#293), the a11y/standards-gate sweep + aeo-probe dispatch-only (bd071c9b/16de8df2), the /updates coverage-window section (d6e9c148), ADR-0367..0371 + five compliance-gap SPEC stubs (docs), and the version-PR consume itself (#310 — 13 changesets, 44 ledger rows, kernel `0.5.2 → 0.5.3` with the eu-ai-act template pin riding via the folded `fix(cli)` commit).

**Lanes:** all ride content was audited in-session at its PR. This pre-tag pass re-verifies the aggregate integrity surface (consume output, buyer-serving path, cutover residual, claim language) against the merged tree, and reconciles the audit-window scope.

## Verdict: PASS — no blockers. One scope correction (INFO) + one watch item.

---

## Per-focus-area verdicts

### 1. Consume integrity surface — PASS

- **Ledger pure-append:** `registry/ledger.jsonl` — 0 deletions, 44 additions, all 44 rows unique published modules. None of the four `NEVER_PUBLISHED` packages leaked in.
- **Index append-only:** `registry/index.json` — 0 non-`latest` deletions (only `latest` pointers advance). `@caisson/kernel` `latest` moved `0.5.2 → 0.5.3`; its `versions[]` gained `0.5.3` with prior entries intact (gate attestation `29712851759@ae57c6e3`).
- **Tarballs pure-append:** `registry/tarballs.json` — 0 deletions, 687 additions. `@caisson/kernel@0.5.3` present with `shasum` / `integrity` / `size` / `lockHash`.
- **Sample-template pin matches kernel:** `packages/cli/templates/eu-ai-act-sample/package.json:14` pins `@caisson/kernel: ^0.5.3`, satisfied by kernel `0.5.3`. This is the folded `fix(cli)` commit inside #310 — the guarded staleness test that would otherwise fail is now green.
- **No displayed-price drift:** site pricing (`apps/site/lib/pricing.ts`) untouched by this range save for the ADR-0257/0258 catalog labels already live. All 19 hardcoded standalone dollar figures in the new module depth-page prose match the canonical catalog `amount` exactly (0 mismatches).

### 2. Buyer install path — PASS

- Registry/tarball serving intact; kernel `0.5.3` is servable with integrity metadata (above). No serving-contract file in the range was rewritten (append-only across all three registry artifacts).
- **`NEVER_PUBLISHED` exemption cannot mask a sellable package** (`tooling/standards-gate/src/checks.ts:310-341`): the set exempts only the `manifest-pending` **warn**, never the `license-required` **error** — internal code still needs a real SPDX license. The four members (`@caisson/brand`, `@caisson/demo-registry`, `@caisson/platform-migrations`, `@caisson/audit-harness`) each verified: no `manifest.ts`, 0 ledger rows, `private: true`, and a declared SPDX license. The guard keys on explicit name and only fires when `manifestPath` is absent — a real sellable module carries a manifest, so its `manifest-pending` warn never fires regardless, and the allowlist is opt-in by name. It cannot promote or hide a package that should publish.

### 3. tscn cutover residual — PASS

- **Buyer-facing generator templates use plain `tsc`, not `tscn`:** `packages/cli/templates/base/package.json` → `"build": "tsc -p tsconfig.json"` with `typescript ^5.6.0`; `framework/next` → `next build`; `eu-ai-act-sample` → `tsc -p tsconfig.json` with `typescript ^5.6.0`. The `tscn` bin (`tooling/tsconfig/bin/tscn.ts`) is repo-internal tooling only.
- **JS-API TypeScript retained:** root `typescript: ^6.0.3` stays for JS-API consumers (typescript-eslint, gate tooling), per the `tscn.ts` header comment; `tsc-native` = `npm:typescript@7.0.2` powers the compile lane. No leak of TS-7 into any published or generated package.

### 4. Security posture — PASS (with a scope correction)

- **No new secrets, no new auth code, no hardcoded credentials** introduced by the _ride content_ (#293–#297, docs, consume). The one new env var, `INTEL_CADENCE_DEP_DIGEST_MS` (`services/intel/src/config.ts:74`, `.env.example`), is a cadence integer (default 7 days — well under the 24.8-day `setInterval` clamp), not a credential.
- **New egress (observation, not a finding):** the dep-digest watcher (`services/intel/src/watchers/dep-digest.ts`, #297 + transitive-v2 commit `3820d6fa`) adds outbound reads to `api.github.com`, `registry.npmjs.org`, and Bun release info. All route through the existing `services/intel/src/http.ts` `fetchWithTimeout` wrapper and reuse the pre-existing `GITHUB_TOKEN` (no new secret). This is a local intel-daemon reading public dependency registries — appropriate for a dep watcher and audited at #297. If not already carried, it warrants a security-surfaces egress-ledger row per the gridwork-core same-commit invariant; it is not a release blocker.

### 5. Site claim-language compliance — PASS (exemplary)

- The new glossary + depth-page content (`apps/site/lib/glossary.ts`, `module-pages.ts`, `updates/page.tsx`) contains 23 uses of "compliant"/"certification" — **every one is a disclaiming Q&A**, e.g. _"No — no module makes an organization compliant; that determination is your organization's and its auditor's to make."_ "guarantees" appears only for technical determinism (canonical-JSON byte-identical output), never compliance. No "certified" / "SOC 2 certified" / "fully compliant" overclaim anywhere. Consistent with ADR-0080 copy laws and the true-to-built floor.

---

## Scope correction (INFO)

**The audit brief's premise "no auth changes in this range (hash-at-rest was the previous tag)" is inaccurate.** `b8b14b48` (#292, session-token hash-at-rest, ADR-0366) merged at 2026-07-19 14:27 CEST — ~40 minutes **after** the `v2026.07.19.1` tag commit `a49d82fd` — so it **is** inside `v2026.07.19.1..c262c0c7`. It was nonetheless audited at its own PR: spot-check confirms `createHmac("sha256", …)` over an env-provisioned key, no hardcoded secrets, and the catch-all deny fix is test-covered (`apps/site/lib/auth-route-deny.test.ts`, `session-adapter.test.ts`, `session-migration.test.ts`). Not unreviewed, not a regression — but this tag boundary, not the previous tag, is where the auth change lands. No action required beyond noting the range membership.

## Watch item (not a finding)

**Module depth-page standalone prices are hardcoded, not catalog-bound.** In `apps/site/lib/module-pages.ts`, bundle prices correctly interpolate `bundlePrice("…")` (drift-proof), but the standalone dollar figures ("Sold standalone at $199") are literal strings. The `module-pages.test.ts` invariant covers bundle-_membership_ honesty, not the dollar amount. All 19 currently match the catalog exactly, so there is no live drift — but a future price adjustment in `pricing.ts` could silently desync the prose. Terminal cure if it ever bites: derive the figure from `moduleAmount(slug)` the same way bundles use `bundlePrice()`, or extend the test to assert each prose `$N`equals the catalog`amount`.

---

_Scope: `git range v2026.07.19.1..c262c0c7` (27 commits, `main`). Read-only audit; verified against merged tree, not commit messages. Registry integrity, standards-gate exemption, tscn cutover residual, security surface, and site claim language checked directly. Reviewer: gw-code-reviewer (opus), release-audit lane._
