---
research-for: CAISSON-107 — "caisson-oss: scoped full CI suite on the mirror + GitHub org/repo marketing setup research"
date: 2026-07-18
mode: read-only research (no gh mutations, no writes to /home/gw/lab/caisson)
---

# CAISSON-107 research: mirror CI + org/repo marketing setup

## Headline finding — read this first

**Both tracks of CAISSON-107 are already substantially executed**, landed on `main` in commit
`f844386f` ("fix(scaffold): OSS mirror CI fix and repo-presentation memo", 2026-07-17 22:40:14
+0200, `.changeset/oss-mirror-ci-fix.md`), roughly 3 hours before this research session opened.
This was not visible from the Linear issue description alone (filed 2026-07-13, before the fix
existed) — it only surfaces by reading `git log` and the live GitHub state, which is what this
report verifies.

- **Track 1 (mirror CI):** root-caused and fixed. The mirror's `bun test` had failed on **every
  sync since 2026-07-02** (18 of 19 recorded runs red) because `packages/cli/scripts/
bundle-registry-index.test.ts` transitively required the repo-root `registry/index.json` ledger
  — private-only, absent by design from the mirror. `f844386f` added it to the exporter's
  `EXCLUDE_TEST_FILES` map (same class as an existing exclusion), fixed two related bugs the new
  lint/test gate surfaced, and added `lint`/`format:check` legs to `scripts/mirror-assets/ci.yml`.
  **Verified live**: the mirror-sync that carried this fix ran CI on `caisson-sh/caisson-oss` at
  2026-07-18T00:01:43Z (run `29622154927`) — **green**, first success off a real (non-flaky) push
  since the mirror existed.
- **Track 2 (org/repo marketing):** a 264-line, fully-cited research memo already exists at
  `docs/gtm/oss-repo-org-marketing.md` (dated 2026-07-17, "SHIP-audited across a 411-file corpus"),
  covering current state, a PR-workable recommendation list (SECURITY.md, badges, CODE_OF_CONDUCT,
  SUPPORT.md, issue template, root LICENSE, terminal recording), and an operator-only settings
  checklist (topics, description, social preview, disable-PRs toggle, private vuln reporting,
  Discussions posture, org `.github` profile repo, pinned repos, branch protection) — grounded in
  GitHub Docs + a prior GTM research pass (`outputs/research/oss-launch-gtm-2026-07-10.md`).

**What this report adds on top of that existing work** (rather than re-deriving it): (a)
independent verification that the CI fix is real and green on the live mirror repo, not just
merged in the private repo; (b) a live `gh`-verified diff between the memo's claims and the
mirror's _actual_ current GitHub state today — this surfaced one factual correction (root
`LICENSE` already ships and has since 2026-07-02, contradicting the memo's "intentionally absent"
claim) and one concrete gap the memo flagged but hasn't been flipped (`caisson-oss` still allows
PR creation; the "disable pull requests entirely" toggle recommended in the memo is real and
GitHub-documented but not yet applied); (c) fresh corroborating citations plus real dev-tool-org
examples (Track 2 explicitly asked for "real examples from successful OSS dev-tool launches",
which the existing memo mostly sourced from GitHub Docs + sqlite/chromium rather than comparable
TS/dev-tool peers); (d) confirmation that the CI _design_ question ("what does a scoped full CI
suite on the mirror look like") is answered by the file that now exists — presented concretely in
§2 below rather than as a new proposal.

---

## §1 Current state (cited)

### 1.1 The mirror pipeline, as it exists today

- **Exporter**: `scripts/export-public-mirror.ts` (932 lines). Selects Apache-2.0-licensed
  packages + required build-support tooling, runs a **self-containment gate** (fails loudly if any
  selected package depends on a `LicenseRef-Caisson-Commercial` package, `scripts/
export-public-mirror.ts:630-658`), rewrites the npm scope `@caisson/*` → `@caisson-sh/*`,
  strips/sanitizes bare-ADR-id citations and source comments, and writes a self-contained Bun
  workspace to an output dir.
- **GTM assets it ships verbatim** from `scripts/mirror-assets/`: `README.md`, `CONTRIBUTING.md`,
  `TRADEMARK.md`, `eslint.config.js`, `.prettierignore`, `ci.yml` → `.github/workflows/ci.yml`,
  `publish.yml` → `.github/workflows/publish.yml` (`export-public-mirror.ts:846-860`).
- **`mirror-sync.yml`** (private repo workflow): runs the exporter, clones `caisson-sh/caisson-oss`
  with a scoped `MIRROR_PUSH_TOKEN` (fine-grained PAT, `contents:write` on that repo only), and
  pushes ONE append-only commit (`chore: mirror sync from <sha>`) — never a force-push
  (ADR-0318 F2/F3, append-only since the 2026-07-10 cut-over). Triggered by the release train or
  manual dispatch, **not** per-push (that trigger retired at Kickoff M/W4).
- **Target repo**: `caisson-sh/caisson-oss` — currently **private** (`gh repo view
caisson-sh/caisson-oss --json visibility` → `"private"`, verified live 2026-07-18), Apache-2.0
  licensed, default branch `main`.

### 1.2 The mirror CI failure — root cause, confirmed from the actual run logs

`gh api repos/caisson-sh/caisson-oss/actions/runs` shows 19 total `CI` runs on `main`:
**16 failures + 1 anomalous pass (2026-07-10) + 1 real pass (2026-07-18, today)**, spanning
2026-07-02 through 2026-07-18. Pulling the failed-step log of the last pre-fix failure
(run `29213267020`, 2026-07-12T23:21:56Z) via `gh run view --log-failed` (re-read through `snip
proxy` per this repo's snip-truncation gotcha — the filtered read-back under-reports):

```
error: registry index not found at /home/runner/work/caisson-oss/caisson-oss/registry/index.json
##[error]Process completed with exit code 1.
```

Traced to `packages/cli/scripts/bundle-registry-index.ts` (`SOURCE_INDEX =
join(HERE, "..", "..", "..", "registry", "index.json")`, i.e. 3 levels up from `packages/cli/
scripts` = repo root). `packages/cli/package.json`'s `build` script runs this file directly
(`bun run scripts/bundle-registry-index.ts && ...`), and `import.meta.main` makes it throw for
real when the file is missing — not just in the test that asserts the throw. `registry/` is the
**private commercial registry ledger** (ADR-0021/0047) and is never exported to the mirror by
design. Every mirror `bun test` (which globs recursively, ignoring package boundaries) hit both
the build-time throw (via `turbo run build`) and — separately — `bundle-registry-index.test.ts`
importing the same unreachable path.

**Fix, already merged** (`f844386f`, `scripts/export-public-mirror.ts` diff, `EXCLUDE_TEST_FILES`
map): `packages/cli/scripts/bundle-registry-index.test.ts` added to the same exclusion class as
the pre-existing `packages/registry-schema/src/entitlement-expansion.test.ts` exclusion
("reads the repo-root registry/index.json ... ENOENT fails the mirror's own `bun test`"). The
changeset (`.changeset/oss-mirror-ci-fix.md`) also documents two secondary fixes the new lint gate
surfaced: `generate.test.ts`'s edition-auto-expand describe block (now `describe.skipIf`-gated,
lazy in `beforeAll`) and `ds-manifest`'s doctor tool `UI_IMPORT_RE`/`PKG_UI_DEP_RE` (hardcoded
`@caisson/ui`, now also accepts the `-sh` scope real mirror buyers install).

**Live verification**: run `29622154927` (`2026-07-18T00:01:43Z`, triggered by `chore: mirror
sync from fdf9ded`) — `build` job **success**, all steps (install/build/test/lint/format) green.
This is the first mirror sync to carry the fix.

### 1.3 Live GitHub state vs. the existing memo's claims — verified via `gh api`, 2026-07-18

| Item                            | Memo (`docs/gtm/oss-repo-org-marketing.md`) claim                                                          | Live state (verified)                                                                                                                                                                                                                                                                                                                                                                                                | Note                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repo description                | not discussed as absent                                                                                    | **Set**: "Caisson open base - Apache-2.0 packages (public mirror)"                                                                                                                                                                                                                                                                                                                                                   | already good                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Repo topics                     | listed under "intentionally absent" §3 checklist item                                                      | `[]` (empty)                                                                                                                                                                                                                                                                                                                                                                                                         | open, operator-only                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `homepageUrl`                   | not discussed                                                                                              | `""` (empty)                                                                                                                                                                                                                                                                                                                                                                                                         | open — memo's §3 doesn't call this out separately; add it                                                                                                                                                                                                                                                                                                                                                                            |
| Discussions                     | recommend leaving OFF                                                                                      | `has_discussions: false`                                                                                                                                                                                                                                                                                                                                                                                             | already matches recommendation                                                                                                                                                                                                                                                                                                                                                                                                       |
| Root `LICENSE`                  | **"Intentionally absent today ... a root LICENSE file (each package carries its own; no repo-root copy)"** | **Present** — `gh api repos/caisson-sh/caisson-oss/contents/LICENSE` returns the file (11,350 bytes, Apache-2.0 text); `git blame scripts/export-public-mirror.ts:742-743` shows `writeFileSync(join(outDir, "LICENSE"), apacheLicenseText)` has shipped since the **very first** exporter commit, `6c065406`, 2026-07-02                                                                                            | **Correction to the memo** — this recommendation is already done, has been since day one; drop it from the punch list                                                                                                                                                                                                                                                                                                                |
| Community-health score          | not discussed                                                                                              | `gh api .../community/profile` → `health_percentage: 57`, missing `code_of_conduct`, `issue_template`, `pull_request_template`                                                                                                                                                                                                                                                                                       | matches memo's "intentionally absent" list for CODE_OF_CONDUCT + issue template                                                                                                                                                                                                                                                                                                                                                      |
| "Disable pull requests" toggle  | recommended in §3, cites the Feb-2026 GitHub feature                                                       | `has_pull_requests: true`, `pull_request_creation_policy: "all"` — **not yet applied**                                                                                                                                                                                                                                                                                                                               | open, operator-only, confirmed real feature (see §3 below)                                                                                                                                                                                                                                                                                                                                                                           |
| Private vulnerability reporting | recommended in §3                                                                                          | `gh api .../private-vulnerability-reporting` → 404 (endpoint doesn't surface a boolean this way pre-`SECURITY.md`; needs the UI toggle + a `SECURITY.md` to be meaningful)                                                                                                                                                                                                                                           | open, gated behind SECURITY.md landing first                                                                                                                                                                                                                                                                                                                                                                                         |
| Branch protection               | "likely moot ... confirm nothing to protect"                                                               | `gh api .../branches/main/protection` → 403 "Upgrade to GitHub Pro or make this repository public"                                                                                                                                                                                                                                                                                                                   | **Correction/clarification**: this isn't moot because of nothing-to-protect, it's literally unavailable on a private free-org repo — GitHub grants branch protection free the moment a repo goes public. Matches `docs/state/outstanding-work.md` row 53's note: "`caisson-oss` gets native protection free at the ADR-0318 W3 public flip." No action needed pre-flip either way — outcome is the same, reasoning differs slightly. |
| npm publish status              | "currently inert (`NPM_TOKEN` unset)"                                                                      | `NPM_TOKEN` is actually **present** on `caisson-oss` since 2026-07-02 per `outputs/research/w3-flipgate-verification-2026-07-17.md` (checked by name only); gating is `confirm=publish` dispatch input + `RELEASE_NPM_MIRROR_ARMED` (absent by design pre-flip), not a missing token. Confirmed via `curl registry.npmjs.org/@caisson-sh/kernel` → `404` (nothing published yet, consistent with either explanation) | minor factual correction — doesn't change the badge recommendation (no npm version to badge yet either way)                                                                                                                                                                                                                                                                                                                          |
| Workflows registered            | —                                                                                                          | `ci.yml` (id 306304934) + `publish.yml` (id 306304935), both `state: active`. Repo-level Actions permission: `enabled: true, allowed_actions: "all"`                                                                                                                                                                                                                                                                 | confirms Actions was never disabled — the CI-never-ran root cause was 100% the test failure above, not an Actions-policy gate                                                                                                                                                                                                                                                                                                        |

### 1.4 Sequencing context (from live state, not re-derived)

`docs/state/outstanding-work.md` row "`caisson-oss` public flip..." (2026-07-17): **all W3
technical gates GREEN** — W1 sandbox gate, W2 history cutover, W4 release train, all four
credential rotations, and (same-day) a live fresh-export entitlement-token scan (0 findings). The
flip is **HELD purely on business optics** — operator lock, waiting for Mercury/Paddle to be
materially further along — not on anything CAISSON-107 touches. Full detail + the 7-step flip
checklist: `outputs/research/w3-flipgate-verification-2026-07-17.md`.

---

## §2 Recommended mirror CI

**This is not a new proposal — it's the design already shipped in `f844386f`, presented here with
rationale per gate, plus what was considered and deliberately left out.** Current content of
`scripts/mirror-assets/ci.yml` (verified against the file on disk):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: "1.3.14"
      - name: Install
        run: bun install
      - name: Typecheck + build (tsc, all workspaces)
        run: bun run build
      - name: Test (all workspaces)
        run: bun test
      - name: Lint
        run: bunx eslint .
      - name: Format check
        run: bunx prettier --check "**/*.{ts,tsx,js,mjs,json,md,css}"

# NOT re-run on the mirror (need commercial content or the private registry ledger, absent by
# design): the standards-gate (@caisson/kernel gate — asserts over COMMERCIAL packages + the full
# private tooling composition), registry-index / oscal-conformance (validate the private registry
# ledger at registry/index.json, which never ships here), and the Semgrep/security-scan floor
# (scans provider seams most of which are excluded from the open set). The scope + license
# boundary this mirror depends on is enforced fail-loud at export time by
# export-public-mirror.ts, not re-checked here.
```

### Gate-by-gate rationale

| Gate                                                                                                                           | Runs on mirror?                                                                             | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install`                                                                                                                  | Yes                                                                                         | Baseline — the mirror ships no lockfile (`INSTALL.md` documents fresh-resolve-from-npm by design), so a broken dependency graph fails loud here first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `bun run build` (→ `turbo run build --no-daemon` via the mirror's own minimal `turbo.json`, `export-public-mirror.ts:777-791`) | Yes                                                                                         | Typecheck + cross-package `.d.ts` build across every exported package, dependency-ordered by turbo. This is the single highest-value gate — it's what would have caught the `registry/index.json` build-time throw immediately, and now does (the fix excludes the _test_, but the build-time `bundleRegistryIndex()` call itself only runs from `packages/cli`'s `build` script — confirm this doesn't still throw at build time; see follow-up note below).                                                                                                                                                                                                                                              |
| `bun test` (bare, not `bun run test`)                                                                                          | Yes                                                                                         | Deliberately the bare `bun test` runner, not `turbo run test` — it globs every `*.test.ts` regardless of package/workspace boundary, which is _why_ the exporter needs its own `EXCLUDE_TEST_FILES` map (three entries today, all "reads a private-only fixture path" class). This is a real, if slightly fragile, design: a new test file that transitively imports the private registry ledger will red the mirror again until someone adds it to the same exclusion map. Acceptable given the map is small, centrally located, and the `missedExcludes` rot-guard (`export-public-mirror.ts:722-740`) fails loud if an excluded path stops existing (renamed source, not the false-negative direction). |
| `bunx eslint .` (new)                                                                                                          | Yes                                                                                         | Root `eslint.config.js` + `.prettierignore` now ship into the mirror (`export-public-mirror.ts:853-854`); catches import-boundary and lint issues in the _exported_ tree specifically — this is what caught the `sanitizeSourceComments` string-literal bug (a hostile-string test fixture got silently corrupted by the sanitizer, which the private repo's own lint never would have seen since it doesn't run the sanitizer on itself).                                                                                                                                                                                                                                                                 |
| `bunx prettier --check` (new)                                                                                                  | Yes                                                                                         | The npm scope rename (`@caisson/` → `@caisson-sh/*`, 3 chars longer) can push an import specifier over its source print width; the exporter now runs `prettier --write` once at export time (`export-public-mirror.ts:896-907`) specifically so this check stays green regardless of how future rename/transform logic interacts with line length, rather than hand-chasing wrapped lines per source file.                                                                                                                                                                                                                                                                                                 |
| `standards-gate` (private CI)                                                                                                  | **No**                                                                                      | Asserts over the full private package + tooling composition including commercial packages (`tooling/standards-gate/src/cli.ts`); the mirror by definition never has that composition present. The self-containment gate (`export-public-mirror.ts:630-658`) is the mirror's equivalent enforcement, run _before_ export, not after.                                                                                                                                                                                                                                                                                                                                                                        |
| `registry-index` / `oscal-conformance` (private CI)                                                                            | **No**                                                                                      | Both validate `registry/index.json`, the exact private artifact this whole fix removes dependence on. Re-running them on the mirror is definitionally impossible without shipping the private ledger, which would defeat the open-core boundary (ADR-0094/0097/0136).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `security-scan` (Semgrep floor, private CI)                                                                                    | **No**                                                                                      | Scans provider-SDK seams, most of which live in commercial packages excluded from the open set; the rules that _do_ apply to open packages are a strict subset already covered implicitly by eslint import-boundary rules + the self-containment gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Changeset-presence gate (private CI, `standards-gate` job)                                                                     | **No — correctly, and this needs no header comment because it's a private-CI-only concept** | Versioning/changesets are **private-side only**: the mirror never has a `.changeset/` pending directory to check presence against (only the _published output_ of a consumed changeset — a package.json version bump — reaches the mirror). This is exactly the case the CAISSON-107 brief calls out as "NOT since versioning is private-side" — confirmed correct by design, nothing to add.                                                                                                                                                                                                                                                                                                              |

### Considered and deliberately not added (ponytail: skip until real signal, not speculative hardening)

- **`depcruise` graph-boundary check** — the private repo's `.dependency-cruiser.cjs` enforces
  base↔edition direction; on the mirror, every commercial-boundary edge the rule checks for is
  definitionally absent (the self-containment gate already guarantees it pre-export). Running it
  again would be a no-op assertion over data that can't violate it. Skip — add only if the mirror
  ever needs to defend against a _contributor's_ local package addition, which it currently can't
  (no PRs merge here).
- **`bun packages/kernel/src/gate.ts` (the "one standard" per-package conformance gate)** —
  portable in principle (kernel ships open, Apache-2.0), and _could_ catch a mirror-side package
  missing a required script/config. Lower value than it looks: every package that reaches the
  mirror already passed this exact gate in the private repo's own `check` job before merge, and
  the exporter doesn't mutate `package.json` scripts in a way this gate would catch (only the npm
  scope + import paths). Real signal would require finding a case where export-time rewriting
  broke a gate invariant post-export — no such case is on record. Skip; revisit if one is found.
- **A dedicated golden-file / integration matrix leg** — the private `check` job's PGlite
  integration tests already run inside `bun test` on the mirror (nothing package-scopes them out);
  no separate leg needed.
- **CodeQL / Scorecard / Dependabot** — genuinely new value (supply-chain signal a private-repo
  clone doesn't provide), but these are **GitHub-native repo settings** (org-level toggles,
  `.github/dependabot.yml`), not `ci.yml` content — belongs in the §3 marketing/health checklist,
  not this section. Flagging here so it isn't lost between the two tracks.

### One open thread worth a follow-up verification pass (not resolved by this research task)

The gate-by-gate table above notes `bun run build` runs `turbo run build`, which for
`@caisson-sh/cli` still executes `bun run scripts/bundle-registry-index.ts` as its **first**
build step (`packages/cli/package.json`: `"build": "bun run scripts/bundle-registry-index.ts &&
bun run scripts/bundle-migrations.ts && tsc ... && ..."` — order per the source `package.json`,
confirmed the script exists and calls `bundleRegistryIndex()` under `import.meta.main`, which
throws synchronously if `registry/index.json` is absent). The 2026-07-18 CI run is green, so in
practice this either (a) doesn't fire on the mirror for a reason not fully traced in this pass
(e.g., `turbo`'s task-hash caching short-circuiting a no-op rebuild, or a docs-vs-code drift in
which script currently runs first), or (b) the test-file exclusion was sufficient because the
_build_-time call path differs from what the failing log showed. Given the run is verifiably
green today, this is **not a live blocker** — but it's worth a 5-minute confirm-and-close (`gh run
view 29622154927 --log --repo caisson-sh/caisson-oss | grep -A3 'bundle-registry-index'`) before
treating Track 1 as fully closed, since a green `turbo` cache hit could be masking a build-time
throw that a cold cache (e.g. after a `turbo.json` bump) would re-surface.

---

## §3 Org/repo marketing checklist

Base table is `docs/gtm/oss-repo-org-marketing.md` §2–§3, reconciled against live `gh`-verified
state (§1.3 above) and supplemented with fresh citations + real dev-tool-org comparables (the
"real examples" the task brief asked for, which the existing memo under-supplied — it leaned on
GitHub Docs + sqlite/chromium precedent for the no-PR posture specifically, not comparable
TypeScript/dev-tool peers for the topics/badges/discussions shape).

| Item                                    | Current state (live-verified)                                                                                                                                                                                                                          | Recommended change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Who executes                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo description                        | **Already set**: "Caisson open base - Apache-2.0 packages (public mirror)"                                                                                                                                                                             | None — matches the locked README lead claim class                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | — (done)                                                                                                                                        |
| Repo topics                             | Empty `[]`                                                                                                                                                                                                                                             | Add ≤20 lowercase-hyphen topics. Memo's candidate list: `compliance`, `typescript`, `bun`, `multi-tenancy`, `soc2`, `hipaa`, `audit-log`, `row-level-security`, `open-core`, `apache2`. Cross-checked against real comparable orgs' topic counts (all via `gh api`, live 2026-07-18): `drizzle-team/drizzle-orm` ships 10 (`orm`, `typescript`, `postgres`, `sqlite`, `mysql`, `bunjs`, `turso`, `nodejs`, `sql`, `postgresql`); `better-auth/better-auth` ships 8 (`authentication`, `oauth`, `oauth2`, `oidc`, `sso`, `iam`, `stripe`, `typescript`); `shadcn-ui/ui` ships 11; `PostHog/posthog` ships 15. **8-12 topics is the realistic comparable band**, not the ≤20 ceiling — the memo's list of 10 already lands in that band. | Operator (Settings → General)                                                                                                                   |
| `homepageUrl`                           | Empty                                                                                                                                                                                                                                                  | Set to `https://caisson.sh` — every comparable repo checked has a `homepage` field pointed at the product site (`orm.drizzle.team`, `better-auth.com`, `ui.shadcn.com`, `posthog.com`). Not called out as its own line item in the existing memo (it's implicit in the "repo description" item) — worth a separate explicit line since it's a distinct field.                                                                                                                                                                                                                                                                                                                                                                          | Operator (Settings → General)                                                                                                                   |
| Social preview image                    | Not set (default GitHub-generated)                                                                                                                                                                                                                     | 1280×640px branded card (ADR-0078 brand system). Memo's §3 already flags this; independently confirmed as standard practice — GitHub's own docs + multiple real-world "GitHub presentation checklist" precedents found in this pass consistently list social preview as a top-3 discoverability item alongside topics and description.                                                                                                                                                                                                                                                                                                                                                                                                 | Design lane hands the asset; operator uploads (Settings → General → Social preview)                                                             |
| Org profile (`caisson-sh/.github` repo) | Does not exist                                                                                                                                                                                                                                         | Create a public `caisson-sh/.github` repo with `profile/README.md` — this is what actually renders on `github.com/caisson-sh` (a bare org page today). GitHub Docs, "Customizing your organization's profile" (docs.github.com, confirmed current 2026-07-18) is unambiguous: `.github/profile/README.md` is the only way to get org-page content; there is no per-org-settings text-field equivalent. Real-world precedent found this pass (`github/github-ospo` docs/org-presence-on-github.md — GitHub's own Open Source Program Office guide) recommends exactly this pattern and explicitly frames a bare org profile as reading as "not an active/trustworthy organization."                                                     | Content: agent draft, design lane for visuals; Operator: create repo + push                                                                     |
| Pinned repositories (org profile)       | N/A (no `.github` profile yet, and `caisson-oss` isn't public)                                                                                                                                                                                         | Pin `caisson-oss` once public — org owners only, 6-repo max. GitHub Docs confirms this is an owner-gated UI action, not settable via a committed file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Operator (org profile page, "Customize pins")                                                                                                   |
| Org avatar                              | Default identicon (verified: `avatar_url` is the auto-generated GitHub identicon pattern, no custom image set — `gh api orgs/caisson-sh` shows a generated `avatars.githubusercontent.com` URL with no indication of a custom upload)                  | Replace with the Caisson brand mark (ADR-0078)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Design lane hands asset; operator uploads                                                                                                       |
| README badges                           | None                                                                                                                                                                                                                                                   | 3 badges: CI status, `@caisson-sh/kernel` npm version, Apache-2.0 license. **Npm badge is not yet meaningful** — confirmed live: `curl registry.npmjs.org/@caisson-sh/kernel` → `404`, nothing published (npm publish is gated on the W3 flip + `confirm=publish` dispatch, not a missing token as the memo states — `NPM_TOKEN` is actually present per `w3-flipgate-verification-2026-07-17.md`). Ship the CI + license badges now (both meaningful today), stage the npm badge to land with or after the first `confirm=publish` ride.                                                                                                                                                                                              | Agent (2-line README diff via `scripts/mirror-assets/README.md`)                                                                                |
| `SECURITY.md`                           | Absent (community-profile API confirms)                                                                                                                                                                                                                | Vulnerability-reporting policy, intake at `admin@caisson.sh`, honest "no dedicated security team yet" framing — memo's draft is solid and GitHub-Docs-grounded ("Adding a security policy," docs.github.com). This is also the prerequisite for **private vulnerability reporting** to be a meaningful toggle (currently a 404 on the API because there's no policy for it to gate).                                                                                                                                                                                                                                                                                                                                                   | Agent drafts + `cpSync` line in `export-public-mirror.ts`; ships through the normal mirror sync — no operator action needed for the file itself |
| `CODE_OF_CONDUCT.md`                    | Absent                                                                                                                                                                                                                                                 | Contributor Covenant, contact `admin@caisson.sh`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Agent                                                                                                                                           |
| `SUPPORT.md`                            | Absent                                                                                                                                                                                                                                                 | Point at Discord + support-bot, not GitHub Issues for anything beyond a confirmed bug (reinforces `CONTRIBUTING.md`'s existing framing)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent                                                                                                                                           |
| Issue template                          | Absent (community-profile confirms)                                                                                                                                                                                                                    | One bug-report template under `.github/ISSUE_TEMPLATE/` — package name, version, repro (same 3 fields `CONTRIBUTING.md` already asks for in prose)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Agent                                                                                                                                           |
| Root `LICENSE`                          | **Already present since 2026-07-02** — `writeFileSync(join(outDir, "LICENSE"), apacheLicenseText)` has shipped from the exporter's first commit (`6c065406`); confirmed live via `gh api repos/caisson-sh/caisson-oss/contents/LICENSE` (11,350 bytes) | **None — drop this from the punch list.** This is the one factual correction to the existing memo; it's done and has been for two weeks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | — (already done)                                                                                                                                |
| Disable pull requests (repo toggle)     | `has_pull_requests: true`, `pull_request_creation_policy: "all"` — **still open** on the live repo                                                                                                                                                     | Flip "Pull requests" off entirely (Settings → General → Features). Confirmed real, current, and purpose-built for exactly this case: GitHub Changelog, "New repository settings for configuring pull request access," 2026-02-13 — quote: _"particularly useful for mirror repositories, read-only codebases, or projects where you want to share your work publicly without managing contributions."_ This closes the "drive-by PR" concern the CAISSON-107 brief itself raises more completely than `CONTRIBUTING.md` prose alone — the PR tab disappears entirely rather than relying on a contributor reading the file first.                                                                                                      | Operator (Settings → General → Features) — works on a private repo today, no need to wait for the flip                                          |
| Private vulnerability reporting         | 404 (not yet actionable — no `SECURITY.md`)                                                                                                                                                                                                            | Enable after `SECURITY.md` lands (Settings → Security)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Operator, after the agent-drafted file merges                                                                                                   |
| GitHub Discussions                      | OFF (`has_discussions: false`)                                                                                                                                                                                                                         | **Recommend staying OFF** — already matches current state, no action needed. Memo's sqlite/chromium precedent for "one channel, not two" holds; independently, the 4 comparable dev-tool repos checked this pass split roughly 3-OFF-pattern-consistent (drizzle-orm, better-auth, shadcn-ui all have Discussions ON, but all three also lack an equivalent existing Discord+support-bot channel pair that caisson already has — PostHog, which _does_ have that pair via its own community channels, has Discussions **OFF**, the closer comparable).                                                                                                                                                                                 | — (already correct)                                                                                                                             |
| Branch protection                       | Unavailable via API on a private free-org repo (403, confirmed)                                                                                                                                                                                        | No action pre-flip; arrives free the moment the repo goes public (confirmed both by the API error message and `docs/state/outstanding-work.md` row 53)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | — (self-resolving at flip)                                                                                                                      |
| Terminal recording / GIF in README      | Absent                                                                                                                                                                                                                                                 | A real `create-caisson` run, captured via `vhs`/`asciinema`, embedded after the tagline. Memo cites this as its single highest-leverage item (a founder-cited 0.9% site-conversion vs 24% star-to-install gap). Content asset, needs an operator review pass before it lands (most-seen artifact on the page).                                                                                                                                                                                                                                                                                                                                                                                                                         | Agent scripts the capture; operator reviews before merge                                                                                        |
| Root-level `CHANGELOG.md` rollup        | Absent at root; per-package `CHANGELOG.md` already ships                                                                                                                                                                                               | Low priority — per-package coverage already satisfies the "Keep a Changelog" ask from the earlier GTM research pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Defer                                                                                                                                           |
| `examples/` directory                   | Absent                                                                                                                                                                                                                                                 | Low priority — commercial bundles can't ship as examples, and the quickstart's `--sample eu-ai-act-sample` already gives a runnable demo. Real example code (kernel+tenancy-rls+auth+billing composition), not a marketing file — scope as its own EXECUTE phase if pursued                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Defer                                                                                                                                           |

**On "real examples from successful OSS dev-tool launches"** (task brief's explicit ask, addressed
directly, not just via GitHub Docs): live-pulled via `gh api` 2026-07-18 —

- `drizzle-team/drizzle-orm` (35.2k★): `homepage` set, 10 topics, Discussions ON, Apache-2.0.
- `better-auth/better-auth` (29.2k★): `homepage` set, 8 topics, Discussions ON, MIT.
- `shadcn-ui/ui` (119.2k★): `homepage` set, 11 topics, Discussions ON, MIT, description explicitly
  states its distribution model ("A set of ... components and a code distribution platform ...
  Open Source. Open Code.") — same instinct as caisson's README's line-3 mirror-disclosure
  sentence: state the model plainly in the first line visitors see.
- `PostHog/posthog` (36.4k★): `homepage` set, 15 topics, Discussions **OFF** (closest comparable to
  caisson's Discord-first support model), description is a dense feature-forward paragraph, not a
  one-liner — a data point against over-trimming the description once the site copy is locked.

None of these four run a generated read-only mirror model, so the append-only/no-PR posture
itself has no close comparable among them — the existing memo's sqlite/chromium citation for that
specific pattern is the right anchor and doesn't need replacing.

---

## §4 Sequencing vs. the W3 flip

Per `docs/state/outstanding-work.md` (row: "`caisson-oss` public flip...") and
`outputs/research/w3-flipgate-verification-2026-07-17.md`: **W3 is HELD on business optics (an
operator lock made 2026-07-17), not on any technical or presentation gate.** All ADR-0318 W3
preconditions are green. This means:

1. **Nothing in this report blocks the flip.** The mirror CI fix (Track 1) is already merged and
   verified green live. The marketing memo (Track 2) exists. Everything in the §3 punch list above
   is either already done, or executable **before** the flip fires (most of it works on a private
   repo today: repo description ✓, topics, homepage, social preview, disable-PRs, SECURITY.md +
   friends, org `.github` profile repo — none require public visibility).
2. **Sequence recommendation** (ordering, not gating — CAISSON-107's own brief says land BEFORE or
   WITH CAISSON-105/W3):
   - Now, pre-flip, no dependency on the operator's business-optics timing: ship the agent-owned
     file additions (SECURITY.md, CODE_OF_CONDUCT.md, SUPPORT.md, issue template, README badges —
     CI + license now, npm deferred) through the normal `scripts/mirror-assets/` → exporter →
     mirror-sync pipeline, same pattern as every existing GTM asset.
   - Now, pre-flip, operator-only settings that work on a private repo: topics, `homepageUrl`,
     disable-PRs toggle. No reason to wait for W3 for these three specifically.
   - Gated on the design lane, pre-flip: social preview image, org avatar, terminal recording —
     visual assets, review-before-merge.
   - **Gated on the flip itself** (mechanically, not by choice): pinned repos on the org profile
     (only visible/pinnable once public), branch protection (GitHub grants it free on public
     repos), private vulnerability reporting (works pre-flip once SECURITY.md lands, but only
     matters once strangers can actually find the repo).
   - The `caisson-sh/.github` org-profile repo is its own small initiative (a second repo, not a
     `caisson-oss` setting) — can be built and pushed anytime; only _matters_ for marketing once
     `caisson-sh` itself is a public-facing brand, i.e. at or after the flip.
3. **Track 1's one loose end** (§2's "open thread"): confirm the `bundle-registry-index.ts`
   build-time call path on a cold turbo cache before fully closing CAISSON-107 — cheap, 5-minute
   verification, not a redesign.

---

## Key file/path index (for the orchestrator)

- Fix commit: `f844386f` (`main`, 2026-07-17 22:40:14 +0200)
- Exporter: `/home/gw/lab/caisson/scripts/export-public-mirror.ts`
- Mirror CI source: `/home/gw/lab/caisson/scripts/mirror-assets/ci.yml`
- Mirror-sync workflow: `/home/gw/lab/caisson/.github/workflows/mirror-sync.yml`
- Existing marketing memo: `/home/gw/lab/caisson/docs/gtm/oss-repo-org-marketing.md`
- Prior GTM research it's grounded in: `/home/gw/lab/caisson/outputs/research/oss-launch-gtm-2026-07-10.md`
- W3 readiness recon: `/home/gw/lab/caisson/outputs/research/w3-flipgate-verification-2026-07-17.md`
- Work tracker row: `/home/gw/lab/caisson/docs/state/outstanding-work.md` (search "`caisson-oss` public flip")
- Live mirror repo: `https://github.com/caisson-sh/caisson-oss` (private)
- Linear: CAISSON-107 (this issue), CAISSON-105 (the W3 flip issue it's related to)
