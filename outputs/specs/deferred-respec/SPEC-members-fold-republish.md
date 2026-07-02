---
title: "Members-fold republish — realize the agent-runner fold into the Agentic-Dev registry snapshot"
status: draft — operator lock required
tags: [infra, external-system, billing]
---

# SPEC — Members-fold republish (agent-runner → Agentic-Dev index snapshot)

**Status: draft — operator lock required.** This SPEC is a review artifact only — it does NOT
authorize building, consuming changesets, appending the ledger, or deploying. It documents the
one pending gated republish that actually remains, and the operator forks that gate it.

- **Prior art:** ADR-0178 (edition members-fold — its own fold CLOSED + deployed), ADR-0186 F5
  (agent-runner, edition-only SKU), ADR-0208 §5 (the first ledger/index-only republish), ADR-0077
  (frozen edition member pin map), ADR-0137 (editions repriced below module-sum), ADR-0111/0069
  (publish-readiness flip, still gated).
- **Surfaces (all verified on `main`, clean tree):** `packages/agent-dev/manifest.ts`,
  `packages/agent-dev/package.json`, `registry/ledger.jsonl`, `registry/index.json`,
  `registry/scripts/ci-publish-step.ts`, `registry/scripts/full-tree-index.test.ts`,
  `registry/worker/deploy.sh`, `packages/cli/src/meter.ts`,
  `tooling/standards-gate/src/publish-config.test.ts`, `.changeset/*.md` (12 pending).

## Goal (WHAT + WHY)

The ADR-0178 members-fold this item was opened for is **already realized in the published index
and deployed** — `registry/index.json` shows `@caisson/compliance@0.2.0` folding
`@caisson/alerting@0.1.1` + `@caisson/retention-runner@0.1.1`, and `@caisson/agent-dev@0.2.0`
folding `@caisson/tool-exec@0.1.1`; `docs/state/decisions-and-forks.md:179` marks it
`CLOSED — ADR-0178`. **No action remains for ADR-0178's own fold.**

What genuinely remains is a **second, later fold** riding the same "manifest edited, not yet
republished" state ADR-0178 started in: `@caisson/agent-runner` was added to
`packages/agent-dev/manifest.ts` `members` (pinned `"0.1.0"`, at the PR #47 merge, ADR-0186 F5)
and published _standalone_ (registry grew 32→33 modules), but the **last-published
`@caisson/agent-dev@0.2.0` snapshot in `registry/index.json` predates that edit and carries NO
`agent-runner` member key**. Twelve changesets sit unconsumed in `.changeset/`.

**Goal:** run the gated, ledger/index-only republish that (a) consumes the pending changesets,
(b) snapshots the `agent-runner` fold into a fresh `agent-dev` ledger entry, (c) rebuilds
`registry/index.json` deterministically, (d) redeploys the registry Worker — so the _published_
index agrees with the manifest source, an Agentic-Dev license entitles `agent-runner`, and a
generated Agentic-Dev repo folds it into `package.json` deps. The real npm/GitHub-Packages
publish stays out of scope (still gated).

## Why now / trigger

The manifest-vs-index drift is **silent**: no CI gate diffs a live `manifest.ts` against the
last-published ledger snapshot for that same package. `registry/scripts/full-tree-index.test.ts`
only checks that _already-published_ snapshots are internally coherent (byte-identical rebuild +
every member pin resolves to a published pair) — it never notices that `manifest.ts` has grown a
member the last snapshot lacks. This is exactly the gap ADR-0178 described before its own
republish, now recurring for `agent-runner`.

The business consequence is live: ADR-0186 F5 sells `agent-runner` as an Agentic-Dev _inclusion_
(no standalone SKU), but the published index doesn't reflect the fold — so a buyer generating an
Agentic-Dev repo _today_ gets deps **without** `@caisson/agent-runner`, and the Worker's
entitlement gate (same index snapshot) does not unlock it under an Agentic-Dev license. The
edition is being sold with a member it doesn't yet ship.

## Non-goals

- **Re-doing the ADR-0178 fold.** Alerting + retention-runner → Compliance and tool-exec →
  Agentic-Dev are already in the live `0.2.0` snapshots and deployed. Untouched here.
- **The real npm / GitHub-Packages publish flip.** `CAISSON_PUBLISH_DRY_RUN` stays `"true"`
  (ADR-0111/0069/0208 §5); this republish writes only `registry/ledger.jsonl` +
  `registry/index.json`. The publish flip is a separate operator act.
- **Any reprice.** `agent-runner`'s edition-included / no-standalone-SKU economics are already
  locked (ADR-0186 F5 + ADR-0137). This SPEC republishes; it does not touch pricing.
- **The Compliance edition.** Already at `0.2.0` with its two folded primitives; no changeset,
  no re-snapshot.
- **A new drift-detection CI gate.** Worth adding (see Risks) but a separate follow-up — this
  SPEC ships the one pending republish, not the guardrail against the next one.

## Current state (verified)

- `packages/agent-dev/manifest.ts` `members` **already lists** `@caisson/agent-runner: "0.1.0"`
  (and `@caisson/tool-exec: "0.1.1"`); `dependencies` already lists `@caisson/agent-runner`.
  `packages/agent-dev/package.json` `version` is **still `"0.2.0"`** — unbumped since the
  manifest source changed.
- `registry/index.json` `@caisson/agent-dev` `latest = 0.2.0`; its `members` map =
  `{agent-dev, agent-kernel, ai-config, kernel, local-store, tool-exec}` — **no `agent-runner`
  key**. Index spans **33 modules**; `@caisson/agent-runner` is present as its own standalone
  module at `0.1.0`.
- `registry/ledger.jsonl` = **65 lines**. The `0.2.0` wave entries carry
  `gateAttestation: "adr-0208-republish@2d4f70d"`, `publishedAt 2026-07-02T16:01:41.000Z`; the
  final line is the standalone `@caisson/agent-runner@0.1.0`
  (`gateAttestation: "local-lift-harvest@59ff2b1…"`) — a fresh module publish that **never
  re-published `@caisson/agent-dev` with the fold snapshotted in**.
- `.changeset/` holds **12 pending `*.md`**: `harvest-slice2-agent-runner.md` (bumps
  `@caisson/agent-runner`, `@caisson/agent-dev`, `@caisson/app-agent-dev`, `@caisson/registry` —
  all `patch`), 10 other `harvest-slice2-*` (ai-config/ai-evals/ai-kit/ai-meter/billing/
  guardrails/jobs/kernel-money/mcp-server/tenancy-rls), and `strix-security-hardening.md`. None
  consumed. These represent **already-merged work** (PR #45 strix, PR #47 harvest slice-2), not
  unbuilt code.
- **Republish mechanic** (`registry/scripts/ci-publish-step.ts`): scans every
  `packages/*/manifest.ts`, appends any `manifest.id@manifest.version` **not already in the
  ledger**, then rebuilds `index.json` deterministically. `manifest.version` reads
  `package.json` (single source), so a new ledger entry appears **only when `package.json`
  bumps** — and that append snapshots the _current_ `members` map. `--dry-run` is the script's
  own flag (ledger/index write), independent of `CAISSON_PUBLISH_DRY_RUN` (which gates the real
  npm publish). Private packages are excluded (`isPrivatePackage`).
- **Entitlement/generator consumer** (`packages/cli/src/meter.ts` `resolveEditionMembers`):
  reads the index's latest edition snapshot and folds the frozen pins into a buyer's generated
  `package.json` deps, **fail-closed** on an absent pin. Same index snapshot the registry
  Worker's entitlement filter reads.
- **Deploy** (`registry/worker/deploy.sh`): Cloudflare Wrangler deploy; esbuild **inlines
  `../index.json` at bundle time** — so the deploy must run _after_ the rebuilt index is
  committed. Operator-gated DEPLOY, separate from SHIP.

## Design

The republish is the reusable ledger/index-only playbook, reconstructed from the ADR-0208
precedent commit trail (`2ded1b0` pin members → `2d4f70d` `changeset version` → `7ec3107`
ledger append + index rebuild) and ADR-0208 §5:

1. **Consume** — `bunx changeset version` (per Fork A). All-or-nothing: bumps `agent-runner`
   `0.1.0→0.1.1`, `agent-dev` `0.2.0→0.2.1`, plus the 10 harvest packages + the strix wave to
   their next versions. Writes `package.json`s + `bun.lock`.
2. **Sync** — `bun install` to reconcile `bun.lock`.
3. **Hand-repin BEFORE the append** (ADR-0077/0208 discipline, per Fork B): update
   `packages/agent-dev/manifest.ts` `members["@caisson/agent-runner"]` from `"0.1.0"` to the
   version the changeset just produced. The manifest carries no publish-time rewrite step — the
   pin is hand-maintained, and a stale pin snapshots a stale fold (see Risks).
4. **Append + rebuild** —
   `bun registry/scripts/ci-publish-step.ts --run-id members-fold-republish --sha <short-sha> --published-at <iso> --dry-run false`.
   Appends the new `(id,version)` pairs to `registry/ledger.jsonl`, rebuilds
   `registry/index.json` deterministically. Run once with the default `--dry-run true` first to
   read the planned appends without writing.
5. **Re-baseline the guard test** — `registry/scripts/full-tree-index.test.ts` hardcodes "the
   ADR-0208 republish versions" (`agent-dev` `0.2.0`, `agent-runner` `0.1.0`, PATCH_ONLY set →
   `0.1.1`, else `0.2.0`). The second republish invalidates every expectation; the test's
   version map must be rewritten to the new wave. **Required, not optional** — the test WILL
   fail until re-baselined.
6. **Deploy** (operator-gated, separate act) — `registry/worker/deploy.sh` pushes the rebuilt
   `index.json` live.

**Entitlement + pricing consequence.** Once the Worker carries the new index, an Agentic-Dev
license unlocks `agent-runner` (Worker entitlement filter reads the index) and a generated
Agentic-Dev repo folds `agent-runner` into deps (`resolveEditionMembers`). `agent-runner` keeps
**no standalone SKU** (ADR-0186 F5) — unlike ADR-0178's Compliance primitives, which retain
à-la-carte module rows. ADR-0137's Agentic-Dev `$249` basis (`$298` = agent-kernel 199 +
agent-dev 99) does **not** count `agent-runner`, so it rides free inside the edition price. No
reprice.

## Open forks (operator decides — DO NOT auto-decide)

### Fork A — republish scope

`changeset version` is all-or-nothing; there is no selective consume.

| Option                                         | Tradeoff                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1 — consume all 12 together (Recommended)** | One coherent wave. All 12 changesets are already-merged work (PR #45 strix, PR #47 slice-2) — the republish is the pending _publish_ of shipped code, exactly the ADR-0208 precedent ("all riding pending bumps"). One index bump, one Worker deploy. |
| A2 — republish only agent-runner + agent-dev   | Physically move the other 11 `.changeset/*.md` aside, run `changeset version`, restore. Isolates the fold but is manual + fragile and defers 11 real, ready bumps for no benefit.                                                                     |
| A3 — defer the whole republish                 | Leaves the manifest-vs-index drift (and the standalone-published `agent-runner`'s missing edition membership) live longer; the edition keeps being sold without shipping the member.                                                                  |

**Recommendation: A1** — confidence **HIGH**. The changesets are merged work, the precedent is
exact, and A2 buys nothing since the other bumps are equally ready.

### Fork B — agent-runner member pin after the bump

The changeset bumps `agent-runner` `0.1.0→0.1.1`; the manifest fold pin is `"0.1.0"`.

| Option                                                                  | Tradeoff                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1 — repin to the changeset-produced `0.1.1` (Recommended)**          | Hand-repin-before-append; buyers fold the current patch; honors the changeset as written.                                                                                                                              |
| B2 — drop the agent-runner bump from its changeset (fold stays `0.1.0`) | The fold is a bundling change, not an `agent-runner` code change, so a patch bump isn't strictly required — but the changeset couples agent-runner + agent-dev + app-agent-dev + registry, and unpicking it is manual. |

**Recommendation: B1** — confidence **MEDIUM-HIGH**. The guard test passes either way (both
`0.1.0` and `0.1.1` are published pairs), but folding the freshly-bumped version keeps the pin
honest.

### Fork C — record the second republish as an ADR?

ADR-0208 §5 authorized the _first_ ledger/index-only republish; the guard test comment names
"the ADR-0208 republish versions". This is a _second_ application to a new version wave.

| Option                                                       | Tradeoff                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1 — file a short ADR / ADR-0208 amendment (Recommended)** | Records the second republish + the guard-test re-baseline; append-only ADR discipline (repo SOT rule) favors a decision trail for a published-artifact change. |
| C2 — pure execution under ADR-0186 + ADR-0208 §5, no new ADR | The fold decision is already locked; the republish is mechanical. Lighter, but leaves the version re-baseline undocumented.                                    |

**Recommendation: C1** — confidence **MEDIUM**. If picked, use the next free ADR number and
**confirm the ceiling on `main` first** (currently 0217; ADR-0088 collision rule — file only at
merge to avoid a renumber).

## Tasks (atomic — run only after operator lock + fork picks)

1. **Pre-flight: confirm the drift is still live.** Verify:
   `bun -e "const i=require('./registry/index.json');const m=i.modules.find(x=>x.id==='@caisson/agent-dev');const v=m.versions.find(y=>y.version===m.latest);process.exit('@caisson/agent-runner' in v.manifest.members?1:0)"`
   (exit 0 = still missing → proceed; exit 1 = already republished → stop).
2. **Consume changesets** per Fork A. Verify: `bunx changeset status --since=origin/main`
   reports no remaining pending changesets (A1), and `grep '"version"'
packages/agent-dev/package.json` shows the bumped version.
3. **`bun install`.** Verify: `bun install --frozen-lockfile` re-runs clean (lockfile in sync).
4. **Hand-repin `agent-dev` members.agent-runner** per Fork B. Verify:
   `bun test tooling/standards-gate/src/publish-config.test.ts` green (manifest ⇄ package.json
   agreement holds through the bump).
5. **Ledger append + index rebuild:**
   `bun registry/scripts/ci-publish-step.ts --run-id members-fold-republish --sha $(git rev-parse --short HEAD) --published-at "$(date -u +%FT%TZ)" --dry-run false`
   (run once with the default `--dry-run true` first and read the planned appends). Verify:
   `git diff --stat registry/ledger.jsonl registry/index.json` shows the appended entries and
   the rebuilt index.
6. **Re-baseline `full-tree-index.test.ts`** version expectations to the new wave. Verify:
   `bun test registry/scripts/full-tree-index.test.ts` green (byte-identical rebuild + member
   pins resolve + wave versions match).
7. **Full gate.** Verify: `bun run check` green; `bun test registry/` green; CI `registry-index`
   (`git diff --exit-code` on a fresh rebuild) clean.
8. **(Fork C1 only) file the recording ADR** at the next free number (confirm ceiling on `main`
   first). Verify: `test -f knowledge/decisions/ADR-02*-*republish*.md`.
9. **DEPLOY (operator-gated, separate act):** `registry/worker/deploy.sh`. Verify:
   `curl -fsSL https://<worker-host>/index.json` shows `agent-dev.latest` with `agent-runner` in
   `members`, zero drift vs the committed `registry/index.json`.

## Verification (goal-backward)

Re-ask the goal against the result, not the task checkboxes:

- `registry/index.json` `@caisson/agent-dev@latest` `members` **contains** `@caisson/agent-runner`
  at the picked version; `@caisson/compliance@latest` still folds alerting + retention-runner
  (untouched).
- `index.json` is a byte-identical deterministic rebuild of `ledger.jsonl`
  (`full-tree-index.test.ts` green; CI `registry-index` git-diff clean).
- Every edition member pin resolves to a published `(id,version)` ledger pair (guard test); no
  `0.0.0` sentinel.
- `bunx changeset status --since=origin/main` reports no pending changesets (A1) — or only the
  deliberately-held ones (A2).
- A generated Agentic-Dev repo's `package.json` deps include `@caisson/agent-runner`
  (`resolveEditionMembers` fold) — spot via the generator/composition test.
- The live Worker `/index.json` matches the committed `registry/index.json` (deploy verified),
  so an Agentic-Dev license unlocks `agent-runner` at the entitlement gate.
- `CAISSON_PUBLISH_DRY_RUN` unchanged (`"true"`) — no real npm/GitHub-Packages publish occurred.

## Risks

- **Hardcoded guard-test versions (CONFIRMED, blocking).**
  `registry/scripts/full-tree-index.test.ts` pins the exact ADR-0208 republish versions
  (`agent-dev 0.2.0`, `agent-runner 0.1.0`, PATCH_ONLY→`0.1.1`, else `0.2.0`). A second
  republish breaks it until Task 6 re-baselines the version map. This is the CI trap — the test
  fails on the new wave by design. Not optional.
- **Stale member pin (CONFIRMED, silent).** If `agent-runner` bumps to `0.1.1` but the manifest
  pin stays `"0.1.0"`, the guard test still passes (`0.1.0` is a published pair) yet the edition
  folds the OLD version — silent staleness. Mitigate: hand-repin-before-append (Task 4 / Fork B).
- **All-or-nothing consume (HIGH-awareness).** `changeset version` publishes all 12 changesets;
  A2's isolation requires physically moving changeset files and is error-prone. Mitigate:
  default A1 — they are all merged work.
- **No drift-detection gate (CONFIRMED gap).** Nothing diffs a live `manifest.ts` against the
  last-published snapshot, so this drift class recurs on every future edition-manifest edit not
  immediately republished. Out of scope here; recommend a follow-up test asserting each edition
  manifest's current `members` map equals its last-published ledger snapshot OR a pending
  changeset bumps that package.
- **Reconstructed playbook (MEDIUM).** The step sequence is inferred from the
  `2ded1b0→2d4f70d→7ec3107` commit trail + ADR-0208 §5 + prior-session memory, not a written
  runbook. Mitigate: run `ci-publish-step.ts` with the default `--dry-run true` first (reports
  planned appends without writing).
- **Worker deploy is a live external side-effect (external-system).** DEPLOY is operator-gated
  and separate from SHIP; the Worker inlines `index.json` at bundle time, so the deploy must run
  **after** the rebuilt index commits. Standard registry-Worker posture.

## ADR interactions

- **ADR-0178 (edition members-fold)** — its own fold (alerting/retention-runner → Compliance,
  tool-exec → Agentic-Dev) is **CLOSED + deployed**; this SPEC does NOT touch it. Named for
  lineage only.
- **ADR-0186 F5 (agent-runner, edition-only SKU)** — **REALIZES**: this republish snapshots the
  fold ADR-0186 locked into the _published_ index; agent-runner keeps no standalone SKU.
- **ADR-0208 §5 (first ledger/index-only republish)** — **EXTENDS**: reuses the exact
  ledger/index-only mechanic (`CAISSON_PUBLISH_DRY_RUN` stays `"true"`) for a second version
  wave; the guard test's "ADR-0208 republish versions" comment is re-baselined here.
- **ADR-0077 (frozen edition member pin map)** — **EXTENDS**: the hand-maintained pin map gets a
  new snapshot; the full-tree-index guard (every pin resolves to a published pair) still holds.
- **ADR-0137 (editions repriced below module-sum)** — **no change**: Agentic-Dev's `$249` basis
  already excludes agent-runner from the module-sum; the fold rides free, no reprice. Named to
  confirm the pricing implication is already locked, not reopened.
- **ADR-0111 / ADR-0069 (publish-readiness flip)** — **UNCHANGED**: the real npm/GitHub-Packages
  publish stays gated; this is ledger/index-only.
- **(Fork C1) a new ADR (next free number, confirm ceiling on `main` first — ADR-0088 collision
  rule)** — would record the second republish + guard-test re-baseline if the operator picks C1.

## Effort / Value

Effort: **S** (~0.5 day: mechanical consume + hand-repin + one test re-baseline + operator-gated
deploy), gated on the three fork picks. Value: **MEDIUM** — closes the published-index drift so
`agent-runner` actually ships inside Agentic-Dev (entitlement + generator), the thing ADR-0186
already sells; a follow-up drift-detection gate would keep it from recurring.
