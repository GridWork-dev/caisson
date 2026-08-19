# ADR-0414 — Automate the docs + support-bot deploys, and promote the Python gate to required first

- **Date:** 2026-08-19
- **Status:** Accepted (operator lock at the session picker, 2026-08-19 — "Automate both, promote the gate first")
- **Numbering:** drafted as 0413 and renumbered at merge per ADR-0088 — ADR-0413 (the C13/C25
  consolidation execution) merged first out of the same three-branch wave.
- **Parent:** ADR-0325 (release-train leg 4 deploys at the tag) · ADR-0400 (apps/demos as its own
  deploy unit, the precedent for appending a service to this workflow) · ADR-0016/0208/0327 (the
  required-check set) · ADR-0096/0105 (services/docs, services/support-bot)
- **Corrects:** the standing claim in `docs/deploy/STATE.md` and `docs/state/production-readiness.md`
  that docs and support-bot "deploy only via the release train"

## Context

`caisson-docs` and `caisson-support-bot` had **no automated deploy path of any kind**. No workflow
referenced either service. `.github/workflows/support-bot.yml` is a CI gate — ruff, pyright, pytest,
the offline eval regression — with zero Railway steps, and `deploy-railway.yml` had only ever
covered admin, license, demos and site.

The release train did not cover them either, and the belief that it did is the interesting part:
**leg 4 is a `workflow_dispatch` of `deploy-railway.yml`**, so the train's scope is exactly that
workflow's scope. The `v2026.08.06.1` ride that appeared to carry both services was the operator
hand-running `tooling/scripts/railway-deploy.ts` in the same sitting; the deploy log says so in that
entry. Two live state docs nonetheless recorded the train as their deploy path, and that wrong
sentence is why the drift was never treated as a gap: docs has sat at `d9a56601` and support-bot at
`26092936` while the other four rode every merge.

The generalizable form: **a service that ships in the same sitting as a train is not a service the
train ships.**

## Decision

### 1. Both services join `deploy-railway.yml`

`services/docs/**` and `services/support-bot/**` join the push-path filter, and two steps append
after `site` in the order **docs → support-bot**.

The order is the same dependency-before-dependent rule that puts demos before site: the bot is a
**client** of the docs API (`DOCS_SERVICE_URL=https://docs-api.caisson.sh`, with a shared
`DOCS_SERVICE_TOKEN`), so the API must already be serving this release before the client restarts
against it. They land after site rather than before because nothing in the site image points at
either, and because docs is the slowest leg by an order of magnitude — putting a twenty-minute cold
boot ahead of the buyer-facing site deploy would delay every release's most visible surface behind
its least visible one.

**One guard each** (`steps.guard.outputs.armed == 'true'`), with no second `CAISSON_DEMOS_ARMED`-style
gate. That extra gate exists because demos was merged before its Railway service existed; both of
these have been Online since 2026-06-30, so the hazard it protects against does not apply.

### 2. `railway-deploy.ts` gains `--wait-minutes`, and docs passes 40

The script's poll budget was a fixed 15 minutes (90 polls × 10s). `caisson-docs` answers `/health`
with a warming `503 {"warming":true}` while it re-embeds its corpus, its `railway.toml` sets
`healthcheckTimeout = 1500` (25 minutes), and `DOCS_EMBED_PHASE_DEADLINE_MS` is 20 minutes in the
service env because the volume embed-cache does not persist across boots — so a cold boot
legitimately re-embeds from scratch.

At the default this step would throw `timed out waiting for the deployment to reach a terminal
state` on a deploy that was **still succeeding**, and take the support-bot step down with it. The
flag defaults to 15, so every existing caller's behaviour is byte-identical. `pollsForWait` rounds
UP and refuses a non-finite budget: `NaN` would make `poll < maxPolls` false on the first iteration,
skipping the poll loop entirely and reporting a timeout on a deploy nobody ever asked about.

### 3. The job timeout goes 25 → 125 minutes

`timeout-minutes: 25` was **exactly equal** to docs' `healthcheckTimeout` of 1500s. Adding the docs
leg without raising it would have guaranteed a job-level kill on any cold-boot re-embed, before
counting the four legs that run ahead of it.

**The cap must exceed the sum of the step budgets it backstops**, and a first pass got this wrong in
the same shape as the bug it was fixing. It raised the cap to 70 on the reasoning "five fast
services plus one docs boot" — self-refuting arithmetic, since five services at the 15-minute
default is 75 before docs' 40 is counted. The real sums are 100 minutes on the push path and 115 on
dispatch (license adds a sixth leg), plus setup. Hence 125.

A job-level cancel is strictly worse than a step timeout: no `timed out waiting for the X
deployment` line is printed, because that diagnostic only fires when a _step_ budget expires — and
the likeliest cancellation point is the last step, leaving a new docs API serving an old bot, the
exact skew the docs → support-bot ordering exists to prevent. **A backstop set below the thing it
backstops is not a backstop**, whichever level it sits at.

### 4. The `support-bot` gate is promoted to required — and it is sequenced FIRST

`support-bot` becomes the sixth required check: `check` · `standards-gate` · `registry-index` ·
`oscal-conformance` · `deterministic` · `support-bot`.

The sequencing is the substance of the decision, not ceremony. **An advisory gate in front of an
automatic deploy blocks nothing** — a red bot would reach production and the only thing standing
between it and buyers would be someone noticing. Automating the deploy is precisely what makes the
gate's advisory status untenable.

**Its `paths:` filter is removed in the same commit**, and that removal is what makes the promotion
sound. Two independent rules force it. `ci.yml`'s header states the PR-side rule: a path-skipped
required job never reports, so the PR blocks forever. `scripts/release-readiness.ts` enforces the
release-side rule from the other direction — it counts a check with zero runs as `missing`, so a
path-scoped required check would red the readiness gate on every release whose diff happened not to
touch the bot. The only permitted `if:` remains the CAISSON-96 draft guard.

## Consequences

- **The required-check set now has a guard of its own.** `scripts/release-readiness.test.ts` asserts
  that every name in `REQUIRED_CHECKS` is a job some workflow actually defines, and that none of
  those workflows carries a `paths:` filter. Both failures were previously silent until a release
  was already in flight. Mutation-verified: restoring the filter, adding an undefined name, and
  dropping `support-bot` each turn a distinct test red. `release-readiness.ts` gained an
  `import.meta.main` entry-point guard so it can be imported at all — it previously parsed argv and
  `process.exit`ed at module load.
- **A CI coverage hole is now named rather than assumed away.** `tooling/scripts/` and `scripts/`
  have no `package.json`, so the `tooling/*` workspace glob skips them and turbo has never run their
  tests; they are covered only by being named in `ci.yml`'s outside-turbo `bun test` line. This
  change names the two suites it touched. Six remain uncovered — including `sot-check`, whose 100+
  tests guard the drift tool this repo runs every session. They are tracked in
  `docs/state/outstanding-work.md` rather than added blind, because that line runs inside the
  required `check` job where an unproven leg reds `main`, not a PR.
- **A stale comment on the receipt gate is corrected, and it is not cosmetic.**
  `railway-deploy.ts` claimed receipts were "a local uncommitted ledger… a fresh clone/CI checkout
  reads empty here and the gate is a no-op there." All six `docs/deploy/receipts/*.json` are
  tracked, so a CI checkout reads the full committed history and the single-use gate **does** hold
  in CI. The consequence lands squarely on this change: a `workflow_dispatch` at a ref whose sha
  already carries a committed receipt for any fleet service throws on that service and skips every
  later one — and docs and support-bot, the two legs added here, carry the most hand-committed rows
  precisely because they were only ever deployed by hand. `--force` is the deliberate escape.
- **Re-running `release-readiness.ts` against a PRE-merge tag will now red.** Those SHAs have no
  `support-bot` check run — the paths filter suppressed it — and the script counts a check with
  zero runs as `missing`. This is correct behaviour, not a defect: the set is evaluated as it
  stands today. Every tag cut after this merge carries the check. Worth knowing before someone
  re-runs readiness on `v2026.08.18` and reads a red as a regression.
- **Merging this PR IS the first ride — it is not inert.** The diff changes
  `.github/workflows/deploy-railway.yml`, and that path is itself a line in that workflow's own
  `paths:` filter, so the merge commit matches and the workflow fires on the merge push. The
  version that runs is the merged one: an armed (`RAILWAY_TOKEN` live since 2026-07-29),
  unattended, five-service deploy — admin → demos → site → **docs (`--wait-minutes 40`) →
  support-bot** — exercising the two legs that have never run automatically before. A first draft
  of this ADR said "this does not deploy anything… the first ride is whichever merge next touches a
  filtered path", which is exactly the sentence that would stop someone watching the run. **Watch
  the run.** The repo's doctrine treats DEPLOY as a distinct recorded act; this one is recorded
  here.
- **License stays dispatch-only.** Nothing here changes that: it carries `preDeployCommand`
  migrations, and the rule that the repo never migrates production unattended is untouched.
- The cost is real and accepted: every PR now runs a ~2-4 minute uv + pyright + pytest + eval job
  whether or not it touches Python, and every filtered merge now waits on two more serial deploy
  legs. Unconditional is the price of required, and the alternative — an advisory gate guarding an
  automatic production deploy — is not a gate.
