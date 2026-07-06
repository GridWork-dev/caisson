# Kickoff C — Catalog rework: editions as bundles over a sellable package catalog

> **SUPERSEDED same day (2026-07-05):** the operator ran the F1–F8 picker directly in the
> SOT-expansion session instead — locks landed as **ADR-0246/0247/0248** and the remaining work
> (brainstorm → follow-up picker → pricing pass → SPEC) continues in that worktree. The tmp-dir
> session below never runs as written; kept for the record. See
> `docs/state/decisions-and-forks.md` § "2026-07-05 catalog-rework picker".

**Authored:** 2026-07-05 (SOT-expansion session, after the operator redirected the R3 price
fork). **Runs:** its own dedicated session, any time after the SOT-expansion PR lands
`outputs/research/catalog-doctrine-2026-07.md` on `main`. **Type:** spec kickoff — SPEC + PLAN +
full fork-lock; **no product code**. **Isolation:** the session writes to a TMP DIR, not a repo
checkout, and ends by printing an integration prompt (see the session prompt below) — so it can
run alongside any busy worktree.

## What it decides

The operator direction (2026-07-05, recorded on the board — NOT locked): all editions become
**bundle options over an individually-sellable package catalog**, with written standards for
(a) the OSS/base ↔ commercial line and (b) when a package splits into sellable surfaces. The R3
compliance-split **price re-lock folds into this round** (against the ADR-0227 $799 anchor +
ADR-0238 11-module catalog). Evidence base + fork queue:
`outputs/research/catalog-doctrine-2026-07.md` (F1–F8: granularity · bundle mechanics · discount
formula · OSS-line standard · split checklist · R3 price shape · growing-bundle policy · upgrade
crediting).

## Copy-paste session prompt

```
Catalog-rework spec session (Kickoff C — ~/lab/caisson/outputs/kickoffs/KICKOFF-C-catalog-rework.md).

MISSION: fully spec + plan the editions-as-bundles catalog rework and LOCK EVERY FORK this
session, operator present. No product code. Read-only against the repo; ALL artifacts go to a
tmp dir; the session ends by printing an integration prompt.

SETUP
- Read-only source checkout: ~/lab/caisson (main). Do NOT edit any repo tree this session.
- mkdir -p /tmp/catalog-rework-$(date +%m%d)/{adrs,spec,patches} — every file you author goes
  under that dir (call it $OUT). If the dir already exists from an earlier attempt, ask before
  reusing.
- Read first: outputs/research/catalog-doctrine-2026-07.md (the evidence base + fork queue F1-F8)
  · docs/state/decisions-and-forks.md 2026-07-05 Kickoff-A picker section (the redirect record)
  · ADR-0094/0136 (current OSS line) · ADR-0129/0137/0227/0238/0240 (the price chain any lock
  supersedes) · ADR-0244/0245 (updates window + credit policy — locked constraints, not open)
  · ADR-0223 (registry delivery = entitlement mechanics floor) · docs/state/package-catalog.md
  · apps/site/lib/pricing.ts (committed numbers) · docs/gtm/pricing-packaging.md.

FLOW
1. PICKER ROUNDS — present the research doc's full fork queue (F1-F8 plus any forks it added)
   via AskUserQuestion, 2-4 options each, one Recommended with confidence + evidence, NEVER
   auto-decide. Multiple rounds are fine; every fork gets an explicit lock or an explicit
   park-with-trigger. The R3 price shape (F6) MUST come out locked or parked — it has been
   deferred twice.
2. DRAFT ADRs — one per locked fork (or one consolidated round-ADR if the operator prefers at
   the time; ask as a final picker question). House format (see ADR-0243..0245 for the current
   shape). Number them ADR-CAT-01, ADR-CAT-02, ... — REAL numbers are assigned only at
   integration against main's then-ceiling (ADR-0088 renumber law; ceiling was 0245 when this
   kickoff was authored, Kickoff B may claim numbers in parallel). Write to $OUT/adrs/.
3. SPEC — $OUT/spec/SPEC.md: goal, locked decisions table (citing the CAT drafts), the target
   catalog (every sellable SKU with price + license + bundle membership), entitlement/grant
   migration design (whole-edition grants -> bundle grants), storefront implications, standards-
   gate rule changes, registry/Paddle product deltas, tags (billing + external-system at
   minimum), non-goals, goal-backward Verify block.
4. PLAN — $OUT/spec/PLAN.md: atomic tasks with per-task verify commands + model routing, split
   into PRable waves (pricing/manifest wave, entitlement wave, storefront wave, standards-gate
   wave). Flag which waves are checkout-flip-blocking vs post-flip.
5. PATCHES — $OUT/patches/board-append.md (the decisions-and-forks section recording the locks)
   + $OUT/patches/adr-index-rows.md (catalog table rows) + $OUT/patches/gtm-pricing-note.md
   (the docs/gtm/pricing-packaging.md fork-flip: open fork -> locked, with the new numbers).

CLOSEOUT (when I say wrap / close out): print the INTEGRATION PROMPT — a single copy-paste
block for a fresh session in ~/lab/caisson that:
  a. git pull, read the CURRENT ADR ceiling (ls knowledge/decisions | sort | tail-1), assign
     real numbers to the ADR-CAT-* drafts in filename order, fixing every cross-reference
     inside the moved files;
  b. cp the files: $OUT/adrs/* -> knowledge/decisions/ · $OUT/spec/* ->
     outputs/specs/catalog-rework/ · apply the three patch files to their targets (append,
     never rewrite history sections);
  c. bump docs/state/decisions-and-forks.md frontmatter adr_ceiling + CLAUDE.md ceiling line +
     the adr-index header ceiling;
  d. bunx prettier --write on every touched file, run bun run sot expecting GREEN (check #1
     parity is the point), fix drift it reports;
  e. commit (docs(adr) + docs(specs), conventional, atomic — subject rules: no +, no @, no
     em-dash, no second paren) on a fresh branch feat/catalog-rework-locks, push, open the PR.
The integration prompt must inline the actual $OUT path and the real file list (ls $OUT -R at
closeout), not placeholders.

RULES: never auto-decide a fork · ADR-0244/0245 are locked constraints (updates window, credit
policy) — design within them · subscriptions and registry delivery mechanics are out of scope
except where bundle grants touch entitlements · model routing per identity/doctrine.md (picker
prep + synthesis = opus main thread; bounded doc reads = sonnet dispatches; this session ships
no code).
```

## Boundaries

- This kickoff does NOT authorize building the rework — the SPEC/PLAN it produces is the
  authorization vehicle after its own locks land on `main`.
- If `outputs/research/catalog-doctrine-2026-07.md` is not on `main` yet when the session
  starts, stop and integrate the SOT-expansion PR first — the fork queue is the session's spine.
- Tmp-dir isolation is deliberate: no branch, no worktree, no dirty checkout; integration is a
  separate, explicit act by the operator.
