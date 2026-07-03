---
title: Members-fold republish — execution runbook
status: ready to execute (MF-A/B/C locked 2026-07-02)
tags: [infra, external-system, billing]
slug: members-fold-republish
supersedes-guidance-in: outputs/specs/deferred-respec/SPEC-members-fold-republish.md
---

# PLAN — Members-fold republish: execution runbook

**Status: forks locked, ready to execute.** `docs/state/decisions-and-forks.md:736-740` records the
operator lock: **MF-A** consume-all, **MF-B** repin editions to the bumped versions, **MF-C** file a
short ADR at execution (next free number, confirmed at merge). This runbook operationalizes those
three picks against the **current** repo state — which has moved on from the SPEC's snapshot (see
"Scope correction" below) — plus the two in-flight hardening branches the operator asked to fold in.

**Relates:** `outputs/specs/deferred-respec/SPEC-members-fold-republish.md` (the design + Fork A/B/C
text this runbook executes), ADR-0178 (edition members-fold, closed), ADR-0186 F5 (agent-runner
edition-only SKU), ADR-0208 §5 (first ledger/index-only republish — the reusable mechanic),
ADR-0077 (frozen edition member pin map), ADR-0137 (editions repriced below module-sum),
ADR-0111/ADR-0069 (publish-readiness flip — stays gated).

**Verified against:** `main @ 78fb877`, plus branches `fix/money-path-hardening` and
`fix/proof-hygiene` (neither has an open PR yet — `gh pr list` returns empty for both).

## Goal (WHAT + WHY)

Run the gated, ledger/index-only republish that (a) merges the two outstanding hardening branches,
(b) consumes **every** pending changeset (24 once those branches land), (c) hand-repins **both**
edition member maps (Compliance + Agentic-Dev) to the versions that consume actually produces, (d)
re-baselines the two bootstrap-era guard tests that hardcode "the ADR-0208 versions," (e) appends the
ledger + rebuilds `registry/index.json`, and (f) files a short ADR recording the second wave — so the
published index agrees with every edition manifest's current `members` map, an Agentic-Dev license
entitles `agent-runner`, and a generated repo (either edition) folds the right dependency versions.
The real npm/GitHub-Packages publish flip stays out of scope (`CAISSON_PUBLISH_DRY_RUN` stays
`"true"`, per ADR-0111/0069/0208 §5).

## Scope correction vs. the deferred-respec SPEC (read this before executing)

`SPEC-members-fold-republish.md` was drafted against a **13-changeset** snapshot and explicitly
scopes itself to the `agent-runner → agent-dev` drift only, naming **"The Compliance edition.
Already at `0.2.0` ... no changeset, no re-snapshot"** as a Non-goal (SPEC lines 79–80, 24 lines
before its Fork A count of 13). That was true when it was written. It is **no longer true**:

- `.changeset/` on `main` today holds **22** pending `*.md` files, not 13 — nine landed since the
  SPEC's revision round (`admin-mutation-surface-registry-schema.md`,
  `admin-mutation-surface-tenancy-rls.md`, `ai-kit-streaming-test-coverage.md`,
  `legal-mor-copy-empty.md`, `live-seams-kms-onnx.md`, `module-sku-wiring.md`,
  `paddle-partial-refund.md`, `post-merge-consolidation-sweep.md`, `ui-turbo-outputs.md`).
- `admin-mutation-surface-tenancy-rls.md` bumps `@caisson/tenancy-rls` **minor**; `live-seams-kms-onnx.md`
  bumps `@caisson/field-crypto` **patch**; `strix-security-hardening.md` (already counted in the 13)
  bumps `@caisson/alerting` **patch**. All three are direct `dependencies` of
  `packages/compliance/package.json` (verified: `alerting`, `audit-worm`, `field-crypto`, `migrate`,
  `retention-runner`, `tenancy-rls`, `kernel` — `packages/compliance/package.json:"dependencies"`).
- `.changeset/config.json` sets `"updateInternalDependencies": "patch"` — the changesets-standard
  cascade rule: a package with **no own changeset** still gets a version bump when one of its
  workspace `dependencies` bumps. `@caisson/compliance` has no direct changeset in the current set,
  but three of its seven direct deps do → **`@caisson/compliance` WILL bump** at `changeset version`
  time, same as `@caisson/audit-worm` (deps on `kernel`+`tenancy-rls`, both bumping) and
  `@caisson/retention-runner` (deps on `kernel`+`jobs`, both bumping — `harvest-slice2-jobs.md` is a
  direct patch). `@caisson/tool-exec` (dep: `kernel` only) cascades too, even though nothing bumps it
  directly this round.

**Net effect:** every single pin in **both** `packages/compliance/manifest.ts` `members` and
`packages/agent-dev/manifest.ts` `members` moves at least one patch version this run — not just the
`agent-runner` pin the SPEC named. This is exactly what **MF-B** ("repin editions to the bumped
versions," plural, no `agent-dev`-only qualifier) already locks — the fork pick is broader than the
SPEC's narrow non-goal, and the fork pick wins (it is the operator lock; the SPEC is pre-lock research
now folded into a wider, already-decided scope). Task 4 below repins **both** editions' full maps,
not `agent-dev.agent-runner` alone.

## Interplay warning — sequencing (read before starting Task 1)

**The two hardening branches must merge to `main` BEFORE the consume runs.** `git log main..fix/money-path-hardening` (10 commits) and `git log main..fix/proof-hygiene` (5 commits) each carry a `chore(state): add changeset` commit — `.changeset/money-path-hardening.md` (`@caisson/billing`, `@caisson/credits`, `@caisson/tenancy-rls`, `@caisson/service-license`, all patch) and `.changeset/proof-hygiene-bucket-b.md` (`@caisson/testing`, `@caisson/admin`, `@caisson/field-crypto`, all patch). Neither branch has an open PR yet (`gh pr list` is empty for both).

Why this order is load-bearing, not cosmetic:

1. **`changeset version` is all-or-nothing and irreversible-in-place** (per Fork A / SPEC line
   167). If the consume runs before these branches merge, their two changeset files are absent from
   the sweep — the consume runs "clean," those two branches' bumps land LATER as a **second,
   uncoordinated** version bump on packages (`tenancy-rls`, `field-crypto`, `billing`, `credits`)
   that are also edition members — reopening the exact manifest-vs-index drift this whole republish
   exists to close, one PR after closing it.
2. Both branches touch real security-critical paths (`packages/tenancy-rls`, `packages/billing`,
   `packages/credits`, `packages/field-crypto`) that are in the `greptile-gate.yml` path glob — they
   need their own `@greptileai` review pass on their **actual code changes** (SSRF/refund/RLS-policy
   logic), which is a different, more focused review than the mechanical version-bump diff the
   republish PR will carry. Merging them first keeps that review honest (small, targeted diff) instead
   of buried inside a 20+-package version-bump PR.
3. `changesets` `baseBranch: "main"` (`.changeset/config.json`) — `bunx changeset status
--since=origin/main` and `changeset version` both read the local `.changeset/` directory as it
   exists on whatever branch you run them on. Merging first means the consume branch is cut from a
   `main` that already contains both changeset files — no manual file-copying, no risk of dropping one.

**Order:** (a) open + merge `fix/money-path-hardening` PR (greptile-gate fires: billing/credits/
tenancy-rls/service-license paths) → (b) open + merge `fix/proof-hygiene` PR (greptile-gate fires:
field-crypto path; `admin`/`testing` are not in the gate glob) → (c) `git pull` `main`, cut the
republish branch from the now-24-changeset `main` → (d) proceed with Task 1 below.

## Execution steps

Run every command from the repo root on a fresh branch cut from post-merge `main`
(`git checkout -b chore/members-fold-republish-v2 origin/main`).

### Task 0 — pre-flight: confirm the drift is still live and the branches are in

```bash
git log --oneline main..fix/money-path-hardening | wc -l   # expect 0 once merged (branch gone/merged)
git log --oneline main..fix/proof-hygiene | wc -l          # expect 0 once merged
ls .changeset/*.md | wc -l                                  # expect 24 (22 today + the 2 branch changesets)
bun -e "const i=require('./registry/index.json');const m=i.modules.find(x=>x.id==='@caisson/agent-dev');const v=m.versions.find(y=>y.version===m.latest);process.exit('@caisson/agent-runner' in v.manifest.members?1:0)"
# exit 0 = agent-runner still missing from the published agent-dev snapshot → proceed
# exit 1 = someone already republished → STOP, re-check state before continuing
```

### Task 1 — dry-run the publish step first (read-only, no writes)

```bash
bun registry/scripts/ci-publish-step.ts --run-id members-fold-republish-preflight --sha $(git rev-parse --short HEAD) --published-at "$(date -u +%FT%TZ)" --dry-run true
```

Verify: output lists "queued for append" for every manifest whose `package.json` version isn't yet
in `registry/ledger.jsonl` — **none yet**, since `changeset version` (Task 2) hasn't run. This step
just proves the script runs clean against the current tree before you touch anything.

### Task 2 — consume all pending changesets (MF-A)

```bash
bunx changeset version
bun install   # reconcile bun.lock after the version bumps
```

This is **all-or-nothing** — there is no `changeset version` flag to consume a subset (SPEC Fork A,
confirmed). It deletes every `.changeset/*.md` file, writes each affected package's `CHANGELOG.md`,
and bumps every `package.json` — directly-changed packages per their changeset's declared bump level
(highest wins when multiple changesets touch one package, e.g. `@caisson/kernel` gets **minor** from
two separate minor changesets, `@caisson/tenancy-rls` gets **minor** from one minor + two patches),
plus every package whose workspace `dependencies` bumped, at least `patch` (`updateInternalDependencies:
"patch"`) — this is the mechanism behind the Scope-correction section above.

Verify:

```bash
ls .changeset/*.md 2>/dev/null | wc -l   # expect 0 (config.json is the only file left)
bunx changeset status --since=origin/main   # reports clean / nothing pending
grep '"version"' packages/agent-dev/package.json packages/compliance/package.json packages/kernel/package.json
git status --short | grep -c package.json   # sanity: many package.json files touched
```

Do **not** hand-guess the exact resulting version numbers here — read them off the actual
`package.json` diff `changeset version` produced. The illustrative examples above (kernel minor,
tenancy-rls minor) are grounded in the changesets you can read in `.changeset/*.md` today; the
authoritative source of truth after this step is the working tree, not this document.

### Task 3 — full gate on the consumed tree (catch the bootstrap-era latent breaks early)

```bash
bun run check
```

Two tests are **expected to fail here by design** — do not treat their failure as a regression,
proceed to Task 4/5 to fix them:

- `tooling/standards-gate/src/publish-config.test.ts` — `"every published package is at its ADR-0208
republish version"` hardcodes the first-wave version map (`0.2.0` / PATCH_ONLY→`0.1.1` /
  `agent-runner`→`0.1.0`).
- `registry/scripts/full-tree-index.test.ts` — `"the index spans the full publishable set at the
ADR-0208 republish versions"` hardcodes the same map (line 35–58).

Per the edition-tails-ops precedent (first consume, ADR-0208), also watch for latent `quality.yml`
path-triggered jobs firing for the first time (e.g. `native-ext`'s macOS leg) now that the consume
touches every `packages/**/package.json` — not blocking here since `quality.yml` jobs are non-required,
but worth a `bun test packages/local-store/src` spot-check if you have the macOS leg available.

### Task 4 — hand-repin BOTH editions' `members` maps (MF-B)

The pin maps are hand-maintained (`packages/compliance/manifest.ts` comment, line 42–46: "No code
rewrites these pins... they are hand-maintained"). Edit both files, reading each new version straight
off the post-Task-2 `package.json` files (not off this document):

**`packages/compliance/manifest.ts`** — repin every key currently in `members`:
`@caisson/compliance`, `@caisson/audit-worm`, `@caisson/field-crypto`, `@caisson/tenancy-rls`,
`@caisson/kernel`, `@caisson/alerting`, `@caisson/retention-runner`.

**`packages/agent-dev/manifest.ts`** — repin every key currently in `members`:
`@caisson/agent-dev`, `@caisson/agent-kernel`, `@caisson/agent-runner`, `@caisson/ai-config`,
`@caisson/kernel`, `@caisson/local-store`, `@caisson/tool-exec`.

```bash
for f in packages/compliance/package.json packages/audit-worm/package.json packages/field-crypto/package.json packages/tenancy-rls/package.json packages/kernel/package.json packages/alerting/package.json packages/retention-runner/package.json packages/agent-dev/package.json packages/agent-kernel/package.json packages/agent-runner/package.json packages/ai-config/package.json packages/local-store/package.json packages/tool-exec/package.json; do
  echo "$f: $(grep -m1 '"version"' "$f")"
done
```

Copy each printed version into the matching `members` key in both manifest.ts files. Then:

```bash
bun test tooling/standards-gate/src/publish-config.test.ts   # will still fail on the OLD hardcoded map — expected, fixed in Task 5
```

### Task 5 — re-baseline the two bootstrap-era guard tests (required, not optional)

Both tests hardcode "the ADR-0208 republish versions" and will fail until rewritten to the new wave
(same class of edit the edition-tails-ops session made the first time — see project memory
`edition-tails-ops-shipped.md`):

- `registry/scripts/full-tree-index.test.ts:35-58` — the `PATCH_ONLY` set / `FIRST_PUBLISH` map /
  the `"0.2.0"` fallback all need updating to whatever the Task 2 consume actually produced.
- `tooling/standards-gate/src/publish-config.test.ts:84-107` — the mirror check, same map.

Do not hand-derive the new expected-version map from memory — read it off the ledger you are about
to append (Task 6) or off the package.json files directly, then hardcode the new map the same way the
existing tests do (the existing pattern — a `PATCH_ONLY`/exceptions set plus a uniform fallback — is
reusable; do not add a general drift-detection abstraction here, that is an explicitly out-of-scope
follow-up per the SPEC's Risks section).

Verify:

```bash
bun test registry/scripts/full-tree-index.test.ts
bun test tooling/standards-gate/src/publish-config.test.ts
```

### Task 6 — ledger append + index rebuild (dry-run, read the plan, then live)

```bash
# 1. Dry-run first — reports what WOULD be appended, writes nothing.
bun registry/scripts/ci-publish-step.ts --run-id members-fold-republish --sha $(git rev-parse --short HEAD) --published-at "$(date -u +%FT%TZ)" --dry-run true

# 2. Read the "queued for append" lines. Confirm they match every package.json Task 2 bumped
#    (private packages like @caisson/registry, @caisson/service-license, @caisson/registry, apps/admin
#    are correctly EXCLUDED — isPrivatePackage(), registry/scripts/ci-publish-step.ts:66-77).

# 3. Live append + rebuild.
bun registry/scripts/ci-publish-step.ts --run-id members-fold-republish --sha $(git rev-parse --short HEAD) --published-at "$(date -u +%FT%TZ)" --dry-run false
```

Note: this script's own `--dry-run` flag is independent of the `CAISSON_PUBLISH_DRY_RUN` env var —
`ci-publish-step.ts`'s `parseCliArgs` reads only `--dry-run` (registry/scripts/ci-publish-step.ts:215-245);
the env var only gates the separate `changeset publish` shell step inside `.github/workflows/publish.yml`
(line 73-80), which this manual invocation bypasses entirely. `CAISSON_PUBLISH_DRY_RUN` stays `"true"`
in the repo the whole time — no real npm/GitHub-Packages publish happens from this runbook.

Verify:

```bash
git diff --stat registry/ledger.jsonl registry/index.json   # shows the appended lines + rebuilt index
wc -l registry/ledger.jsonl                                  # grows from 65 by (new package count)
bun test registry/                                            # schema/index-builder/worker-seam suite green
```

### Task 7 — full gate, clean

```bash
bun run check
bun test registry/
```

All required-check equivalents green locally: `standards-gate`, `check`, `registry-index` (byte-identical
rebuild — `git diff --exit-code registry/index.json` after a fresh `bun registry/scripts/build-index.ts`
run, mirroring the CI `registry-index` job at `.github/workflows/ci.yml:145-166`).

### Task 8 — file the short ADR (MF-C)

Filed **at execution**, after Task 6 produces the real ledger deltas (per the operator lock text:
"a small ADR lands during the republish run recording the final ledger/index deltas"). Confirm the
ceiling on `main` immediately before filing — the ADR-0088 collision convention (two of the last three
multi-branch waves renumbered because a sibling branch claimed the number first). As of this research
pass the ceiling is **ADR-0224** (`knowledge/decisions/ADR-0224-*.md` is the newest file); the next
free number is **ADR-0225**, but re-verify with `ls knowledge/decisions/ | grep -oE "ADR-[0-9]+" | sort
-u | tail -3` right before writing the file, not from this document.

Draft text (fill the bracketed TODOs from the real Task 2/6 output before committing):

```markdown
# ADR-0225 — Members-fold republish, second wave: full-tree repin + agent-runner fold realized

**Status:** accepted · 2026-07-02 (members-fold republish execution, operator picker MF-A/B/C,
`docs/state/decisions-and-forks.md:736-740`). Extends **ADR-0208 §5** (first ledger/index-only
republish — the reused mechanic), **ADR-0178** (edition members-fold, closed, untouched by this wave),
**ADR-0186 F5** (agent-runner edition-only SKU — this wave is what actually publishes its fold),
**ADR-0077** (frozen edition member pin map). Append-only; supersede with a later ADR, never edit.
**Tags:** `infra`, `external-system`, `billing`.

## Context

`registry/index.json`'s `@caisson/agent-dev@0.2.0` snapshot predated the `agent-runner` manifest edit
(ADR-0186 F5) — the published index and the deployed Worker did not yet reflect the fold a buyer was
already being sold. Independently, [TODO: N] changesets had accumulated unconsumed since the first
ADR-0208 republish, covering the Strix follow-on hardening (ADR-0204), the lift-harvest slice-2 wave
(ADR-0210-0217), the admin mutation surface (ADR-0220), Paddle per-line refund (ADR-0218), live seams
(ADR-0221), and two additional post-merge hardening buckets (`fix/money-path-hardening`,
`fix/proof-hygiene`) merged immediately before this run.

## Decision

Consumed all [TODO: 24] pending changesets in one `changeset version` sweep (MF-A — no selective
consume exists). Hand-repinned **both** edition `members` maps — `packages/compliance/manifest.ts` and
`packages/agent-dev/manifest.ts` — to the versions the consume produced (MF-B; broader than the
originally-scoped agent-runner-only fold, because `updateInternalDependencies: "patch"` cascaded a
bump onto every member of both editions, not just the packages with a direct changeset). Appended
[TODO: N] new `(id, version)` pairs to `registry/ledger.jsonl` (ledger grows 65 → [TODO]) and rebuilt
`registry/index.json` deterministically via `registry/scripts/ci-publish-step.ts --dry-run false`.
Re-baselined the two bootstrap-era guard tests (`registry/scripts/full-tree-index.test.ts`,
`tooling/standards-gate/src/publish-config.test.ts`) that hardcoded the first wave's version map.

`CAISSON_PUBLISH_DRY_RUN` stays `"true"` — no real npm/GitHub-Packages publish occurred
(ADR-0111/0069/0208 §5 posture unchanged).

## Consequences

- `registry/index.json` `@caisson/agent-dev@latest` now folds `@caisson/agent-runner` — an
  Agentic-Dev license entitles it at the Worker's entitlement filter, and a generated Agentic-Dev
  repo's `package.json` deps include it (`resolveEditionMembers`, `packages/cli/src/meter.ts`).
  `agent-runner` keeps no standalone SKU (ADR-0186 F5); no reprice.
- `@caisson/compliance@latest`'s members map (self + audit-worm + field-crypto + tenancy-rls + kernel
  - alerting + retention-runner) is now [TODO: version(s)] — the Compliance fold (ADR-0178) is
    unchanged in composition, only in pinned versions.
- The registry Worker (`registry/worker/deploy.sh`) has NOT yet been redeployed as of this ADR — that
  is a separate, operator-gated DEPLOY act (see the runbook's Operator-gated section). Until it runs,
  the live edge still serves the pre-republish index.
- No drift-detection CI gate was added (out of scope, named as a follow-up in the deferred-respec SPEC
  Risks section) — this same manual-repin-before-append discipline will be needed again at the next
  edition-manifest edit that isn't immediately republished.
```

## Operator-gated (do NOT run unattended)

1. **Registry Worker redeploy** — `registry/worker/deploy.sh` (wraps `wrangler deploy`; esbuild
   inlines `../index.json` at bundle time, so this must run strictly AFTER Task 6/7 commit the
   rebuilt `registry/index.json` to `main`). This is the same act ADR-0208's first republish used
   (project memory `golive-tail-merge-deploy-wave.md`) — external-system side-effect, Claude Code
   proposes, operator executes/approves. Verify post-deploy:
   `curl -fsSL https://<worker-host>/index.json | jq '.modules[] | select(.id=="@caisson/agent-dev") | .versions[-1].manifest.members'`
   shows `@caisson/agent-runner` present; diff against the committed `registry/index.json` for zero
   drift (same pattern as the first republish's "15 Apache-2.0 mods @ 0.2.0, zero drift" check — note
   the **unauthenticated** Worker view is the FILTERED base set, so don't expect all modules back
   unauthenticated, only the base ∪ your entitlement).
2. **The real npm/GitHub-Packages publish flip** (`CAISSON_PUBLISH_DRY_RUN=false` in
   `.github/workflows/publish.yml`) — explicitly out of scope for this runbook, per ADR-0111/0069/0208
   §5. Do not flip it as part of this republish.
3. **The republish PR itself merging to `main`** — branch protection now has `enforce_admins` on +
   `strict` (up-to-date-before-merge) since ADR-0208 #2, so the PR must be rebased on tip-of-main
   right before merge; no admin bypass exists to skip a failing required check.

## Gates that fire on the republish PR

The consume touches `packages/kernel/`, `packages/tenancy-rls/`, `packages/billing/`,
`packages/credits/`, `packages/field-crypto/`, `packages/ai-meter/`, `packages/tool-exec/`,
`packages/guardrails/` (package.json version bumps alone count as a path match) — every one of these
is in the `greptile-gate.yml` security-critical glob (`.github/workflows/greptile-gate.yml:53-65`), so
`@greptileai` review triggers automatically on this PR even though the diff is mostly mechanical
version bumps + two manifest.ts repins + two test re-baselines. This is expected and correct — resolve
any inline finding before merge same as any other gated PR. Required checks: `check`, `standards-gate`,
`registry-index`, `oscal-conformance`, `greptile-gate` (all five, per ADR-0208 #2's hardened branch
protection).

## Out of scope

- Re-deciding MF-A/MF-B/MF-C — already locked; this runbook executes them.
- The Compliance edition's own bundle **composition** (ADR-0178's fold) — unchanged, only its member
  pins move.
- Any reprice — ADR-0137's Agentic-Dev/Compliance pricing basis is untouched (agent-runner already
  excluded from the module-sum per ADR-0186 F5).
- A new drift-detection CI gate diffing live `manifest.ts` against the last-published ledger snapshot
  — named as a real gap in the SPEC's Risks section, deferred to its own follow-up.
- The real npm/GitHub-Packages publish flip and any DNS/CF-Access change.

## Verification (goal-backward)

Re-ask the goal, not the task checkboxes:

- `registry/index.json` `@caisson/agent-dev@latest.manifest.members` contains `@caisson/agent-runner`
  at the version the consume produced.
- `registry/index.json` `@caisson/compliance@latest.manifest.members` still folds `alerting` +
  `retention-runner` (ADR-0178 untouched), now at their post-consume versions.
- `full-tree-index.test.ts` and `publish-config.test.ts` are green against the NEW version map (not
  silently skipped or loosened).
- `bunx changeset status --since=origin/main` reports clean (all 24 consumed, MF-A).
- Every edition member pin resolves to a real published `(id, version)` ledger pair — no `0.0.0`
  sentinel, no stale pin (the existing set-membership guard test already covers this; it must still
  pass after the repin).
- `CAISSON_PUBLISH_DRY_RUN` is unchanged (`"true"`) in the committed workflow file — no real publish
  occurred.
- (Post-DEPLOY only) the live Worker `/index.json` matches the committed `registry/index.json` byte
  for byte on the relevant module entries.

## Effort / Value

Effort: **S** (~0.5–1 day: two branch merges + mechanical consume + two full-map repins + two test
re-baselines + operator-gated deploy). Value: **MEDIUM-HIGH** — closes a real, currently-live drift
(Agentic-Dev sold with a member the published index doesn't grant) and clears the growing changeset
backlog (24 changesets of already-merged, already-shipped work sitting unpublished) in one coherent
wave, using the exact reusable mechanic ADR-0208 proved out.
