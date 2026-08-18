# Release audit — v2026.08.18 (the consolidation + oxc-adoption ride: ADR-0397–0409)

> Tag not yet cut at audit time. Range audited is `v2026.08.06.1..27d8afb5`; rename this file to the tag actually published if it differs from `v2026.08.18`.

## 1. Scope + method

**Range:** `v2026.08.06.1..27d8afb5` — 38 commits, 821 files, +12,302 / −16,934 (net −4,632 lines), 2026-08-06 → 2026-08-18. PRs #407–#440. Thirteen ADRs land in-range: ADR-0397 (reference-app retirement + dissolved-meta deletion), 0398 (verify-pack publishes with the next train), 0399/0402 (agent-usage fold + delist-with-provenance), 0400 (site demo-surface split, multi-zone `apps/demos`), 0401 (remediation-wave sweep locks), 0403 (Compliance $1,649 FINAL — closes the last open fork), 0404 (discounted partner-close labeling), 0405 (seller-plane Python frozen, two islands), 0406 (launch-gate + wedge-tripwire arming), 0407 (consolidation picker — 18 verified cuts), 0408 (oxc full adoption) and 0409 (oxc landed + three corrections to 0408).

The range's two structural events are the ones this audit weights hardest: **`26092936`** (consolidation wave 1 — 18 cuts, ADR-0407, including the `services/license` ↔ `packages/platform-reads` shared-read hoist and the deletion of `resolve-entitlements.ts`) and **`87275f68` + `9b86b9d2`** (ESLint + Prettier swapped for oxlint + oxfmt, then the one-commit repo-wide reformat under ADR-0408 constraint 3 — the reason the file count is 821 while the semantic surface is far smaller).

**Dimensions (4):**

1. **Money / entitlement seams** — billing webhook, credit grants, entitlement store, updates-window reads, license issuance, buyer-dashboard reads. The seams ADR-0005/0007/0017/0089/0244/0255/0269 govern.
2. **Security floor** — the gridwork `identity/security.md` floor plus this repo's lint-policy gate: secret compare, boundary validation, header/cookie posture, credential travel across the new multi-zone origin boundary, and the lint rules that mechanically hold those invariants.
3. **Platform / infra** — workspace package graph, turbo task graph, build + deploy topology, package metadata accuracy, tsconfig/build posture.
4. **Release integrity** — changeset presence and semver level, version-consume coherence, packaging/export surface.

**Models + lanes.** `gw-code-reviewer` (opus) and `gw-security-auditor` (**opus this ride**) ran independently and in parallel over the full cumulative diff. The opus routing for the security lane is a **deliberate deviation from this repo's fable-on-money/license/crypto-seams convention** (`CLAUDE.md` §Subagent model routing), taken under the session's explicit model directive; it is recorded here because that convention exists precisely for the seams this range touches (entitlement store, license issuer, updates windows), and a future auditor comparing rides should not read the lane label as fable output. Every raised finding was then adversarially verified by an independent opus verifier under **default-refute** — a finding survives only on execution-verified evidence, not on plausible reading.

**Result of the refute pass: 7 findings raised → 5 confirmed, 2 refuted.** No P1. Severity mix: 1 × P2, 4 × P3.

## 2. Verdict per dimension

| #   | Dimension                 | Verdict                   | Basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Money / entitlement seams | **PASS-WITH-DISCLOSURES** | Two P3s (§3.1, §3.2). No live money defect: no float, no over-grant, no fail-open gate. Both findings are _coherence_ defects the consolidation introduced or newly disguised — a workspace-graph cycle held acyclic only by an untested hand-pin, and a docstring asserting a parity between two updates-window readers that does not hold for subscription-backed pairs. The second has real buyer-visible consequence (§3.2) but is a pre-existing behavior gap, not a new one. |
| 2   | Security floor            | **PASS-WITH-DISCLOSURES** | One P2 (§3.3) and one P3 (§3.4). The P2 is a _hole opened for future changes_, execution-verified: the oxc swap silently dropped four typescript-eslint `recommended` rules including `ban-ts-comment`, against an ADR that claims rule parity. Zero current violations in product code. The P3 is credential travel — the authenticated session cookie is proxied into `apps/demos` on every embed load. No confirmed exploit; no P1, therefore no FAIL.                          |
| 3   | Platform / infra          | **PASS-WITH-DISCLOSURES** | One P3 (§3.5) — package metadata documents a deleted export. Doc-accuracy only; runtime paths unaffected. The larger platform events in range (demos multi-zone split, oxc swap, 18 consolidation cuts) walked clean beyond the findings listed.                                                                                                                                                                                                                                   |
| 4   | Release integrity         | **PASS**                  | One finding raised, refuted on evidence (§4.2): the removed `@caisson/cli` public export _was_ correctly changesetted at `minor` — by an earlier, still-unconsumed changeset than the one the finding cited. No confirmed defect in changeset coverage, semver level, or version-consume coherence for this range.                                                                                                                                                                 |

**Overall: PASS-WITH-DISCLOSURES.** FAIL is reserved for a confirmed P1; none was confirmed. The single P2 and the four P3s below are shippable with the fixes queued, and none blocks a tag.

## 3. Confirmed findings

### 3.1 — P3 · money · Circular workspace dependency: `@caisson/service-license` ↔ `@caisson/platform-reads`

**Where:** `services/license/package.json:36` (adds `"@caisson/platform-reads": "workspace:*"` to runtime `dependencies`) × `packages/platform-reads/package.json:27` (retains `"@caisson/service-license"` in `devDependencies`) × `packages/platform-reads/turbo.json` (the load-bearing override).

**What.** The ADR-0407 consolidation hoisted the shared updates-window SQL into `platform-reads` and made `services/license` depend on it at runtime, while `platform-reads` kept its dev-time dependency back on the service. The workspace package graph is now cyclic. Turbo prints `WARNING Circular package dependency detected: @caisson/platform-reads, @caisson/service-license` on every `turbo build` and every `turbo test` (operands reversed on the latter). Neither warning exists at `v2026.08.06.1` — `services/license` had no `platform-reads` dependency there.

The _task_ graph is still acyclic, and only because of a hand-written per-package override: `packages/platform-reads/turbo.json` replaces the inherited `dependsOn: ["^build"]` with `dependsOn: ["@caisson/tenancy-rls#build"]`. Verified by dry-run: `bun x turbo build --filter=@caisson/platform-reads --dry=json` resolves `@caisson/platform-reads#build` to `["@caisson/tenancy-rls#build"]` while every sibling package resolves to `["^build"]`.

**Why it matters.** Nothing on the money path is broken today. The fragility is that the two files holding the graph together — the `package.json` pair that creates the cycle and the `turbo.json` that neutralizes it — are unlinked, uncommented at the point of coupling, and untested. Failure scenario: anyone adding a second runtime dependency to `platform-reads`, or restoring `^build` on its build task (e.g. while widening that `turbo.json` for a new task), makes the graph genuinely cyclic and turbo hard-fails the **entire monorepo build** — license issuer, admin control plane and site included.

**Required fix.** Break the cycle rather than pin around it: move the `@caisson/service-license` devDependency out of `platform-reads` (its integration tests can reach the service's DDL constants via a test-only path or a third leaf package), OR — if the devDependency must stay — add a test that asserts `packages/platform-reads/turbo.json`'s build `dependsOn` does not contain `^build`, and a comment at `services/license/package.json:36` and `packages/platform-reads/package.json:27` naming the other file. The turbo warning should not be a permanent fixture of a green build; it trains the eye to ignore it.

### 3.2 — P3 · money · Buyer-dashboard updates-window read omits the subscription coverage-horizon fold the signed token applies

**Where:** `packages/platform-reads/src/index.ts:102-114` (the docstring) and `:116-131` (`readUpdatesWindows`) vs `services/license/src/entitlement-store.ts:909-928` (`computeUpdatesWindows`). Consumer: `apps/site/app/dashboard/license/page.tsx:49`.

**What.** The reworded docstring asserts that `readUpdatesWindows` "supplies the canonical read used by `services/license`'s `computeUpdatesWindows` (ADR-0244/0255: same table, same one_time-only sourcing, same purchased-id keying, **same most-favorable/max-bound fold**)". The last clause is false. `computeUpdatesWindows` runs the shared `UPDATES_WINDOWS_READ_SQL` **and then folds `subscriptionCoverageHorizons` over the result** — ADR-0269 Decision 2: a purchased pair also backed by an active subscription grant takes `MAX(own bound, coverage horizon)` (`entitlement-store.ts:918-927`: `const horizons = await subscriptionCoverageHorizons(tx, accountId); … horizon !== undefined && horizon > own ? horizon : own`). `readUpdatesWindows` runs only the SQL; there is no horizons lookup anywhere in `packages/platform-reads/src/index.ts:116-131`.

**Why it matters.** The behavior gap predates this range — but the consolidation is what makes the parity claim newly plausible-looking. Hoisting the SQL to one owner reads as "these are now the same function" when only the `one_time` half is shared, and the docstring now says so in words. Failure scenario, concrete: a buyer holding a one-time Compliance grant (`granted_at` 2026-01-01, bound 2027-01-01) plus an active Compliance Updates subscription whose stamped coverage horizon is 2027-06-01 sees **"updates through 2027-01-01"** on `/dashboard/license`, while their license token's `updatesWindows` claim says **2027-06-01**. Five months of paid coverage rendered invisible at exactly the surface that sells the renewal — and the dashboard reads _earlier_ than the entitlement, which is the direction that costs revenue and generates support load. `packages/platform-reads/src/updates-window.integration.test.ts` never calls `computeUpdatesWindows`, so nothing compares the two despite the docstring asserting they match.

**Required fix.** Either (a) hoist the horizon fold too — move `subscriptionCoverageHorizons` behind the same shared read so both callers get the ADR-0269 §2 semantics, and have `computeUpdatesWindows` call it; or (b) correct the docstring to state plainly that this read covers the `one_time` half only and the issuer applies an additional most-favorable fold the dashboard does not. Fix (a) is the correct one — the dashboard is documented as "the LIVE read the buyer dashboard uses in place of decoding the last-issued license token", and a live read that disagrees with the token defeats its own stated purpose. Either way, add a test in `updates-window.integration.test.ts` that seeds a one-time grant + an active subscription horizon and asserts the two functions return the same map.

### 3.3 — P2 · security floor · The oxlint swap silently dropped 4 typescript-eslint `recommended` rules, including `ban-ts-comment` — ADR-0409 claims "rule parity"

**Where:** `.oxlintrc.json:14-16` (`"plugins": ["eslint","typescript","jsx-a11y"]`, `"categories": {"correctness": "error"}`) and `:19-45` (the four named rules). Baseline: `git show v2026.08.06.1:tooling/eslint-config/index.js` line 17 → `...tseslint.configs.recommended`, deleted by `87275f68`.

**What.** The deleted ESLint config spread `tseslint.configs.recommended`. The replacement root config enables only the `correctness` category plus four named rules. Four rules that typescript-eslint's `recommended` preset sets to `error` are **not** in oxlint's `correctness` category and are not named, so they are unenforced repo-wide as of this range:

- `typescript/ban-ts-comment`
- `typescript/no-unsafe-function-type`
- `typescript/no-empty-object-type`
- `typescript/no-require-imports`

`ban-ts-comment` is the security-floor-relevant one: a bare `// @ts-ignore` can now silence a type error on a crypto, money, or license path with no gate. In scope: `packages/kernel/src/crypto.ts`, `packages/license-issue/src/signer.ts`, all of `services/license/src/`.

**Evidence (execution-verified against the shipped config, pinned oxlint 1.78.0).** Probe file containing `// @ts-ignore`, `type F = Function`, `type E = {}`, `require("node:path")`:

```
$ ./node_modules/.bin/oxlint -c .oxlintrc.json probe/y.ts
→ only no-unused-vars / no-wrapper-object-types / no-this-alias / no-unused-expressions fire;
  ZERO findings for the four rules above.
```

Mutation arm — same file, a config naming the four at `"error"` — proves the rules exist in oxlint and are merely not enabled (i.e. this is a one-line fix, not a missing implementation):

```
ban-ts-comment          → error at 1:3  ("Use @ts-expect-error instead of @ts-ignore")
no-unsafe-function-type → error at 3:17
no-empty-object-type    → error at 4:17
no-require-imports      → error at 6:18
```

**Why P2, not P1.** No current violation in product code: the 19 in-tree `@ts-expect-error` sites are all test files with descriptions, which `ban-ts-comment` permits by default, and the `@ts-ignore` hits live in gitignored `.next/` output. This is a hole opened for future changes, not an existing breach.

**Why it still matters.** ADR-0409 line 17 asserts the swap lands "at rule parity", and ADR-0409 §3 (lines 59-73) audits **jsx-a11y** parity in forensic detail — 31 recommended vs 36 oxlint rules, five explicit `off`s so `categories.correctness` "cannot widen a gate this wave promised to hold flat". The typescript ruleset never got that treatment, and the narrowing went the _other_ direction, unremarked. The ADR's own stated standard convicts the gap.

**Required fix.** Add the four rules by name to `.oxlintrc.json`'s `rules` block at `"error"`, in the same shape ADR-0409 §3 used for jsx-a11y, and amend ADR-0409 with a typescript-parity subsection recording the 4-rule delta and its closure. Confirm with the probe above (all four must fire).

### 3.4 — P3 · security floor · The ADR-0400 `/demos` rewrite forwards the authenticated session cookie into `apps/demos`

**Where:** `apps/site/next.config.ts:192-200` — `async rewrites()` returning `{ source: "/demos/:path*", destination: \`${demosOrigin}/demos/:path*\` }`, with no `has`/header filtering. Cookie definition: `apps/site/lib/auth-server.ts:17-21,46`. Embed consumer: `apps/site/components/poke-embed.tsx:169`.

**What.** The multi-zone rewrite proxies `/demos/:path*` to the `caisson-demos` service on the same public origin. The site's session cookie `caisson.session_token` is set `HttpOnly; SameSite=Strict` with better-auth's default `Path=/` — no `path` narrowing appears anywhere in `auth-server.ts` — so it matches `/demos/*` and rides every request the browser makes there, including each `<iframe src="/demos/embed/<module>">` load. A Next external rewrite is a server-side proxy that forwards inbound request headers, `Cookie` included. Net: a signed-in buyer's **live session token is delivered to a second service on every module-page view**.

`apps/demos` has no auth, no cookie read, and no need for one — `apps/demos/app/embed/[module]/page.tsx` reads only `params.module`, and `app/healthz/route.ts` is the remainder of the request surface. `apps/demos/lib/security-headers.ts` and `apps/demos/next.config.ts` define the app's entire request-handling policy and mention cookies nowhere. Neither the rewrite rule nor the demos app strips the header, and nothing pins that it stays unread: a future request log, middleware, or observability hook in `apps/demos` would silently begin capturing session material. The ADR-0400 design notes at `poke-embed.tsx:6-13` reason explicitly about same-origin trust in one direction (localStorage reach, `contentDocument` reach) but never about the credential travelling the other way.

**Required fix.** Strip the credential at the boundary — the rewrite is the right place, since the origin-sharing is deliberate. Add a request-header filter to the `/demos/:path*` rule (or a thin route handler / middleware on the site side) that drops `Cookie` before proxying, and add a pin test asserting `apps/demos` receives no `Cookie` header for an embed request made by an authenticated session. Second-choice fix: narrow the session cookie's `Path` so it cannot match `/demos` — cheaper, but couples auth config to a routing detail and breaks the moment another zone lands.

### 3.5 — P3 · platform · `services/license` package description references a deleted export

**Where:** `services/license/package.json:5`.

**What.** The description still reads "… `resolveAccountEntitlements` expands stored purchased ids to member slugs against the registry index; …". This range's consolidation commit `26092936` (ADR-0407) deleted `services/license/src/resolve-entitlements.ts` (56 lines) and its 357-line integration test outright, and removed `export { resolveAccountEntitlements } from "./resolve-entitlements.ts";` from `services/license/src/index.ts`. Repo-wide grep for `resolveAccountEntitlements` returns zero hits outside a stale `dist/*.d.ts` artifact.

The description line sits inside the same-range diff hunk (key ordering shifted around it) but its text was not updated, so the package now advertises a capability that does not exist.

**Confirmed harmless at runtime.** The function was dead code before deletion — never called outside its own deleted test — and the live billing-webhook / entitlement-issue paths (`app.ts`, `webhook.ts`) are unaffected. Doc-accuracy defect only.

**Required fix.** Delete the clause from `services/license/package.json:5`. One line.

## 4. Refuted findings (adversarial verify, default-refute)

- **P3 — "Test-only fixture module lives in `src/` and compiles into the license service's build output" (`services/license/src/scheduler-test-fixtures.ts`).** Refuted on two independent grounds. (1) The failure scenario is factually wrong: `services/license/Dockerfile` never runs `bun run build`/`tsc` — it `COPY`s the repo, `bun install --frozen-lockfile`s, and its `CMD` is `bun services/license/src/deploy.ts`, so the deployed process runs TypeScript source directly under Bun and never touches `dist/`; the package's `exports` also resolves `"bun": "./src/index.ts"` first, and the package is `"private": true` (never published), so every in-workspace consumer bypasses `dist` entirely. `dist/` exists only as a CI type-check artifact. (2) The "fresh in-wave inconsistency" framing is wrong: `services/license/tsconfig.json` has always carried `include: ["src"]` with no test exclude — that line dates to the package's original P0 commit `6dcceb28`, long before `v2026.08.06.1`, and every pre-existing `*.test.ts` in the package already compiles into `dist/` (e.g. `dist/abandoned-checkout-scheduler.test.js`). The in-range commit only _added_ the fixture file, consolidating three near-duplicated inline fixtures already living inside the same un-excluded `include`. A genuine naming/placement nit survives (the header comment's "imported only by `*.test.ts` files" is unenforced by config), but both load-bearing claims — ships in the deployed image; new in this wave — are false.
- **P3 — "`@caisson/cli` ships a removed public export under a `patch` changeset" (`.changeset/consolidation-wave-one.md`).** Refuted as misattribution. `26092936` never touches `packages/cli/src/index.ts` or `generate.ts` (`git show 26092936 -- packages/cli/` shows only `run.ts` and a template `db.ts`). The `defaultEngine` removal landed in `2405d9e3` (PR #412, 2026-08-09) — the sole in-range commit touching `generate.ts`, confirmed via `git log` plus a snip-proxied `git diff` to defeat the known filtered-git-output false-negative class. That commit shipped its own changeset, `.changeset/clean-caissons-sweep.md`, correctly marking `'@caisson/cli': minor` and documenting "The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`." That changeset is still present and unconsumed at `27d8afb5`, so the repo's semver convention (minor for 0.x breaking changes) was already correctly applied — by a different, earlier changeset than the one cited. The cited `cli: patch` entry in `consolidation-wave-one.md` corresponds to unrelated `26092936` changes that never touch the public export surface.

## 5. Not covered

- **Visual/UI regression on `apps/site` and the new `apps/demos` zone** — no browser lane ran this ride; the ADR-0400 split is audited here for credential travel and routing only, not for rendered output.
- **Runtime behavior of the deployed fleet** — probed post-deploy per the release checklist, not part of this diff audit.
- **The oxfmt reformat commit `9b86b9d2` byte-by-byte** — audited as a category (formatter-only, ADR-0408 constraint 3, in one commit with a blame-ignore-revs entry landed by `d25e4a25`), not line-by-line across the ~750 reformatted files; the lanes read the semantic commits in the range and treated the reformat as mechanical.

## 5. Dispositions (attestation PR, same day)

- **§3.3 (P2, oxlint rule gap) — FIXED in the attestation PR:** the four dropped rules
  (`typescript/ban-ts-comment`, `no-unsafe-function-type`, `no-empty-object-type`,
  `no-require-imports`) are now named `error` rules in the root `.oxlintrc.json`; the repo lints
  clean under all four (zero violations, execution-verified before the change landed).
- **§3.1 / §3.2 / §3.4 / §3.5 (P3s) — DISCLOSED, queued as Linear issues** after the tag: the
  platform-reads cycle pin needs a guard test; the updates-window coverage-horizon fold gap is a
  buyer-visible display defect on the renewal surface (pre-existing, now tracked); the /demos
  cookie forward wants a strip-at-rewrite; the license package description re-word rides the next
  ordinary cycle (packed-bytes discipline: no packages/* edits post-consume).
- **Range note:** the audited range head `27d8afb5` predates the version PR (#441, `812cb155`)
  and this attestation branch (template-pin refresh + pristine-tree cli row re-record + the rule
  fix + these docs). Those commits are release mechanics + the §3.3 fix, reviewed inline; the
  cumulative product diff is the audited range.
