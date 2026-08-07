# STATUS — Caisson repo state audit — 2026-08-06

Domain: **caisson** (single-repo). Repo: `/home/gw/lab/caisson` (`caisson-sh/caisson`).
Linear: team **Caisson** (key `CAISSON`). Audit ran as a 5-lane read-only fan-out
(session recap / Wave B topology / renovate recon / sot+docs drift / Linear sweep),
626k subagent tokens, all facts probed live — nothing asserted from memory alone.

Operator locks for the follow-on pass (2026-08-06 picker): **full finish** (cleanup +
Wave B ship + all four renovate merges + single release train + deploy + wrap docs),
**Linear filed for real**, **renovate: merge all 4 including the majors**.

---

## Phase 1 — Repo & git state

**Main**: `main` @ `42f69edf`, exactly even with `origin/main` (0/0 ahead/behind).
Working tree clean except ONE untracked file: `outputs/plans/clean-main-wave-2026-08-02.md`
(the wave PLAN — Phase-7 wrap owns committing it). **No stashes.**

**Branch census — 47 local branches:**

| Class                                                                                                             | Count | Disposition                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`                                                                                                            | 1     | —                                                                                                                                                      |
| Wave-A squash-merged (`fix/poke-*`, `chore/deps-*`, `docs/accepted-findings-closeout`, `fix/site-test-typecheck`) | 16    | Delete (`-D`; every tip predates its PR's mergedAt, zero post-merge commits — verified per branch)                                                     |
| Wave-A true-merged money quad (`fix/poke-{ai-meter,billing-orchestration,credits,prompt-registry}`)               | 4     | Delete (`-d` works — tips are ancestors of main)                                                                                                       |
| `worktree-wf_aa4141af-4ab-1..20` placeholder base refs                                                            | 20    | Delete (all sit at old base `74f07569`, zero unique commits)                                                                                           |
| `pr-382` orphan                                                                                                   | 1     | Delete `-D` — leftover reconciliation attempt for PR #382; its substance (close 5 findings + restamp) IS in main via squash `5ac940f0`; no unique work |
| Wave B (`fix/poke-guardrails-local-inference`, 2× `-part`, 2× `-remediation`)                                     | 5     | See Phase 2 — one ships, two are patch-identical duplicates, two carry dirty worktrees                                                                 |

**Worktrees — 26 registered + 1 orphan dir:**

- 20× `.claude/worktrees/wf_aa4141af-4ab-N` — checked out on the merged Wave-A branches, all clean → `git worktree remove` (before deleting their branches).
- 5× `wave-b-*` — two DIRTY (see Phase 2).
- `.claude/worktrees/agent-aeda887bc94330426` — **not a git worktree at all** (no `.git` inside, absent from `git worktree list`): a stray 40K `apps/site/.next` dev-cache leftover from a Jul-7 agent run → plain `rm -rf`.

**Remote**: only 5 refs on origin — `main` + the 4 live `renovate/*` branches. GitHub's
auto-delete-on-merge already cleaned every wave ref; **nothing stale to prune remotely.**

**Local-only commits**: only the 7 Wave-B commits (see Phase 2). Nothing else anywhere.

## Phase 2 — Session recap / in-flight work

**The 2026-08-02 session** (reconstructed from first-parent history `74f07569..main`):
the clean-main wave merged all 20 PRs in one drive — poke-fix branches first
(#385→#390→#388→#393→#383→#384→#386→#392→#396→#394, all "retire the X poke mirror
against the real package, ADR-0396"), then the deps wave (#379 safe-wave, #378
htmlparser2 8→12, #381 web-vitals 6, #380 @types/culori 4), #397 site typecheck fix,
#382 docs closeout, and finally the four-branch **money quad** (#387 ai-meter → #391
credits → #389 billing-orchestration → #395 prompt-registry) as serial true-merges,
each reconciled against the fast-moving base. Merges finished 23:38Z.

**What the session did NOT reach:** Wave B ship, the release train, deploy, wrap docs.

**In-flight work (the load-bearing findings):**

1. **Wave B is complete and green but stranded local-only.** Five branches, three
   content states; `fix/poke-guardrails-local-inference` @ `ea32c7b5` is the strict
   superset (7 commits vs main, 49 files, +1937/−1364: browser-safe `./browser`
   entries for guardrails, local-inference, kernel, local-privacy, field-crypto; the
   guardrails/local-inference/local-privacy poke mirrors retired onto real package
   entries; 4 changesets covering all 6 touched surfaces). The two `-part` branches
   are **patch-identical duplicates** (verified via `git patch-id --stable`) of
   commits already on the ship branch — discard. **Every gate passes** on the ship
   branch: full ADR-0396 invariant suite (export conditions, offenders=[] pins,
   positive controls, one-way subset, exact module allowlists, nodeGlobalTaint pins),
   637-test package suites, 393-test poke suite, changeset coverage.

2. **`wave-b-poke-remediation` worktree (4 dirty files) — FINISHED work that MUST be
   ported before ship.** The committed branch ships a site demo that renders
   `outcome: "egressed"`, "1 request, 128 tokens metered" while sending **zero**
   requests — a fabricated metric on a live marketing surface, straight against the
   ADR-0082 "artifacts true-to-built" floor. The dirty files fix the claim
   (`allowed`/0 requests/no usage + honest verdict copy), add loading/error unions
   fixing two permanent-spinner bugs (rejected `evaluateGuard`/`computeSampleEmbedding`
   hang forever), and pin it all with tests (15 pass / 60 expects, verified green).
   Base-file identity with the ship branch verified — clean port guaranteed.

3. **`wave-b-guardrails-remediation` worktree (11 dirty files) — UNIQUE but
   INCOMPLETE security work, NOT Wave B.** A separate DoS/fail-closed hardening pass
   on `packages/guardrails`: work ceilings (100K text / 1024 matches), bounded PII
   substitution, a hand-rolled ReDoS screen over caller-configured regexes, a strict
   parser for untrusted moderator verdicts. Helper layer written and green; **call-site
   wiring never happened** — 9 tests red, including a measured **5-second wall-clock
   DoS on 100KB input still open**, a telemetry-sink throw that can swallow a
   `GuardrailError`, and a live caller-supplied-ReDoS path in `cheapDeny`. ~588 lines
   existing nowhere else. Disposition: WIP-commit to `fix/guardrails-dos-hardening`,
   file a Linear issue, finish in a dedicated fable-lane pass (security seam). Do NOT
   block Wave B on it; do NOT `worktree remove --force` before the WIP commit.

**Local config/env drift**: none found — no uncommitted config, no unreflected env changes.

## Phase 3 — Open PRs

Four open PRs, all renovate, all created 2026-08-03 (right after the deps wave):

| PR   | What                                                                                          | CI (at audit)                                                                                          | Verdict                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #398 | actions/setup-java digest (1 line, workflow-only)                                             | GREEN 19/19 (Aug-3 run)                                                                                | Merge as-is; no changeset needed                                                                                                                                                                                                                                                                                                                                                |
| #400 | @types/node ^22→^26 in `apps/ai-kit` (the LAST straggler — root catalog already pins ^26.0.0) | standards-gate FAIL (Aug-3), rest green                                                                | Read the gate log, fix any real type error, rebase, add changeset, merge                                                                                                                                                                                                                                                                                                        |
| #401 | bullmq ^5.60→^6 in `packages/jobs`                                                            | All red — **pure lockfile mismatch**: renovate's artifact step hit bun's 7-day `minimumReleaseAge`     | **Age gate OPENED 2026-08-06 11:56Z for exactly 6.0.0** (6.0.1–6.0.8 blocked until ≥Aug 12). Rebase triggered 19:2xZ today. Blast radius: bullmq imported ONLY in `packages/jobs/src/bullmq.ts`; all 8 documented v5→v6 breaking changes checked against it — zero hits (driver already uses `upsertJobScheduler` + `deduplication`). Cleanest possible major. Changeset needed |
| #399 | all-minor-patch group (24 deps, 10 files)                                                     | artifact step FAILED: `@better-auth/kysely-adapter@1.6.26` under the age floor until **Aug 11 21:20Z** | Rebase triggered — bot should shed the too-young dep(s) and regenerate; changeset needed; merge LAST                                                                                                                                                                                                                                                                            |

No stale PRs, no blocked-on-review PRs, no local branches missing PRs (wave-B is
Phase-2 scope) and no PR branches missing locally (renovate branches are bot-owned,
remote-only — expected). Merge order: **398 → 400 → 401 → 399**, all before the train.
Renovate is NOT configured to emit changesets — each packages/*-touching PR needs one
added by hand (plain prose, no ADR cites).

## Phase 4 — Linear (team Caisson)

33 open issues + 10 completed-in-14d reviewed (full dump preserved by the audit lane).

- **Stale (30+ days): NONE.** Oldest open items are 2026-07-25 (12 days).
- **No project: 24 of 33** — nearly all cadence-agent output (monthly dispatches, AEO
  probes, competitive watches, dep watches) legitimately awaiting operator triage.
  Left as-is; don't trust `project` when filing against this batch.
- **Duplicates**: CAISSON-155 ("better-auth update available 1.6.23→1.6.25") duplicates
  CAISSON-151 ("update held", filed 30 min apart) → close 155 as dup, note on 151 that
  renovate #399's group touches the better-auth constellation. CAISSON-158/160 (PostHog
  into site vs mcp-server) are coupled-not-duplicate — track together.
- **Done-but-open**: CAISSON-130 (July gw-gtm-copywriter cadence marker) superseded by
  CAISSON-174 (August) → close.
- **Coverage of upcoming work: ZERO** — nothing in Linear covers Wave B, the bullmq/
  @types/node majors, the release train, hygiene, wrap docs, the guardrails hardening,
  or the anti-slop dep fix. Filed in Phase 7 below.
- **Labels**: only support/Feature/Bug/Improvement exist — **no operator-action label**;
  created as part of Phase 7.
- A fifth project "Clean state 2026-07 (caisson)" exists beyond the four canonical
  areas, still active (CAISSON-150 In Progress) — flagged, not touched.

## Phase 5 — Operator-only items (NOT attempted)

1. **npm publish leg** of the release train — publish stays operator-gated by standing
   convention; the train will run every other leg. (Filed with `operator-action`.)
2. **Announcement post** — deliberately never commissioned (operator act). Adjacent:
   CAISSON-105 "OSS launch W3: public flip + Show HN" is the broader launch container —
   kept separate.
3. **better-auth exact-pin bump decision** (CAISSON-151 "held") — the session-adapter
   lockstep pin is an operator hold; renovate #399 does not decide it.
4. **CAISSON-150** board-audit fork-walk (D1–D15) — explicitly operator-gated, In Progress.

## Phase 6 — Triage & replan (the next-up list)

Prod is **48–77 commits behind main** (docs/support-bot on `f9c04f33` = 59 behind;
admin/site/license on `d9ae893e` = 48 behind); 25 changesets queued (49 patch/20 minor);
`bun run sot` red on exactly ONE gate (branch-hygiene). The order below is dependency-
driven and matches the live task board (#15–#19):

1. **Preserve then prune** (task #15): WIP-commit the guardrails hardening to
   `fix/guardrails-dos-hardening`; port the 4 poke files into the Wave-B ship worktree;
   THEN remove the 20 wf_ worktrees + orphan dir, delete the 41 disposable branches,
   and the 4 subsumed wave-b refs/worktrees as they're consumed.
2. **Ship Wave B** (task #16): ported files + amended changeset prose → gates → push →
   PR → SHIP audit (gw-code-reviewer opus; gw-security-auditor fable — PII masking/
   fail-closed guard moves onto a public `./browser` entry, exactly fable's class) → merge.
3. **Renovate ×4** (task #17): 398 → 400 → 401 → 399 as above. #401 is time-sensitive
   (the 6.0.0 window closes when 6.0.1+ clears Aug 12 and renovate re-proposes). If
   #399's retry can't produce a clean artifact pass today, it self-clears Aug 11 —
   defer it past the train rather than override the age floor (convention).
4. **Anti-slop engine fix** (new, small PR before the train): `apps/site/scripts/anti-slop/detector/engines/static-html/{detect-html,css-cascade}.mjs`
   dynamically imports `css-select`/`css-tree`/`domutils`; none declared in
   `apps/site/package.json`, `css-select` not even in `bun.lock` → the import throws,
   the catch silently falls back to text-only detection, so **the CSS-cascade engine
   has likely never run in CI** (the repo's known fail-soft class). Declare the three
   deps + changeset.
5. **Release train** (task #18): single train consuming all queued changesets → tag →
   legs (**`-f ref=<tag>` on every dispatched leg** — the leg-4-deploys-main-HEAD trap;
   and the RAILWAY_TOKEN-unset arm-check false-green trap) → redeploy all five services
   → `index-parity-probe` must return PARITY OK. npm publish leg: operator.
6. **Wrap docs PR** (task #19): tracker matrix + Recently-closed for the wave;
   build-state body restamp ("Current state (2026-07-30)" heading, not just
   frontmatter); deploy STATE entry; package-catalog spot-check; commit the wave PLAN
   file; adr-index/CLAUDE.md ceiling bump IF anything mints an ADR; `bun run sot` all-green.
7. **Follow-on (not this pass)**: guardrails DoS hardening completion (fable lane,
   ~2–4h + audit — issue filed); better-auth pin decision (operator).

**Backlog disagreements**: none material — Linear's open set is orthogonal to this
work. The only reprioritization: the guardrails hardening was invisible (uncommitted
in a worktree, zero tracking) and is now the highest-severity open engineering item
in the repo (measured 5s DoS + verdict-swallowing sink on the guard seam).

## Phase 7 — Linear actions (filed this session)

- Created label `operator-action`.
- Created: guardrails DoS/fail-closed hardening completion (Platform & Infra, from the
  WIP branch, red-test inventory in description); anti-slop CSS-cascade engine silent
  degradation (Site & Buyer Dashboard); clean-main completion umbrella (Platform &
  Infra, In Progress — Wave B + renovate ×4 + train + deploy + wrap, closed when the
  pass lands); npm publish leg (`operator-action`); announcement post (`operator-action`).
- Closed: CAISSON-130 (superseded by CAISSON-174), CAISSON-155 (duplicate of
  CAISSON-151, cross-referenced with renovate #399).
- Left alone deliberately: the 24 no-project cadence-output triage items (operator
  triage queue, 2–4 days old), CAISSON-146 (already status=Duplicate), CAISSON-150
  (operator-gated), CAISSON-105 (broader launch scope).

---

_Generated by the 2026-08-06 audit pass; execution of Phase-6 items proceeds in the
same session under the operator's full-finish lock._
