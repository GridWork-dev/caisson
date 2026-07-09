# SPEC — audit-harness v2: complete-coverage, sales-ready whole-repo audit

**Status: DRAFT — awaiting operator lock (proposed at the next free ADR number, 0233+ — ceiling 0232 after the fourth picker round; amends ADR-0134/0188).** No code
lands, and the v2 audit does not re-run, until this SPEC + its forks are locked (Caisson cadence:
no product/tooling code before the spec it implements is locked). **Tags:** `ai` `security`.

- **Type:** internal tooling refinement + the re-run program it drives. Not a registry module.
- **Target package:** `packages/audit-harness` (private, unsold — `private: true`, no `publishConfig`).
- **Driver:** a Workflow-orchestrated audit program, per `outputs/specs/lift-phase/AUDIT-RUNBOOK.md`.
- **Supersedes for the re-run:** the hand-grown `AUDIT_DOMAINS` list in
  `packages/audit-harness/src/domains.ts` and the 2026-07-01 ledger (`outputs/audit/ledger.toml`).

---

## Goal (WHAT + WHY)

The 2026-07-01 whole-repo audit (`outputs/audit/REPORT-2026-07-01.md`, PR #40, ADR-0134/0188) found
51 findings, fixed 50 — but it discovered its own scope **mid-run**: the domain list
`AUDIT_DOMAINS` grew **6 → 24** across five rounds because each round's completeness critic kept
naming surfaces the hand-picked globs never reached (Python services, IaC, telemetry egress, the
registry edge, the generator's emitted output, auth, email, the eval judge, MCP transport, agent
governance, admin plane, metering, destructive jobs, composition roots, WORM). Round 5 also caught a
**critic name-collision** — the round-3 critic named the close-out domain `audit-harness` when it
meant `audit-worm` — a class of silent misattribution.

**The core defect is structural: the domain axis was hand-grown and risk-themed, with overlapping
globs, so "did we cover everything?" was answered by re-running until a critic stopped finding gaps.**
That is not a coverage guarantee; it is luck plus persistence.

v2 makes coverage **mechanical and gated** (you cannot start a run with an unclaimed tree dir), adds
**two customer-facing quality dimensions** the v1 audit never had (the packages ARE the product —
buyers read the source), and formalizes the ad-hoc "run again until dry" loop into an explicit
program with a termination oracle. Since v1 the tree also gained large new surfaces —
`apps/admin` mutation plane (ADR-0220/0225), registry npm delivery + Worker deny-set (ADR-0223/0225),
the live-verification harness (ADR-0224), members-fold republish (ADR-0228), `@caisson/agent-runner`

- the 10-package hardening wave (ADR-0210–0217), and the **public OSS mirror** `caisson-sh/caisson-oss`
  (the 15 Apache-2.0 base packages, a public GitHub front door) — none of which existed when the v1
  domain list was frozen.

**Definition of done:** a single re-run reconciles against ONE ledger, with a coverage gate that
proves every tree unit was claimed and every applicable (domain × dimension) cell was executed —
green on the first pass, never grown mid-flight.

---

## Why now

- The re-run is queued (`docs/state/opportunity-backlog.md`); re-running on the v1 hand-grown domain
  list reproduces the under-scan on a repo that is ~40% larger.
- The mirror flips **public at launch** (`docs/state/public-surface.md` §4). Jargon, gridwork-isms,
  internal ADR shorthand, `~/.gridwork` paths, operator names, or TODO/FIXME residue in the 15
  Apache packages become the public first impression the moment the repo is un-privated. That is a
  launch-blocking quality bar the v1 audit had no dimension for.
- The top confirmed v1 finding was a **docs-vs-code lie** (`apps/site/app/security/page.tsx:67` —
  "static export, no server, no database" on a live Postgres-backed Railway app). That class recurs
  and deserves a first-class dimension, not a security-domain accident.

---

## Current state (real file cites)

**The harness package** (`packages/audit-harness/src/`) — built + wired (ADR-0188), already ran once:

- `domains.ts:12` — `AUDIT_DOMAINS`: 24 hand-authored domains, **risk-themed with overlapping
  globs** (e.g. `security` globs `packages/**/src/**`, `financial-integrity` globs
  `packages/billing/src/**` — the same file is in both). This is the axis v2 replaces.
- `domains.test.ts:6` — the "inventory" test hard-codes the 24 ids as a literal `toEqual` list. It
  asserts the list didn't change; it does **not** assert the list covers the tree. That is the
  under-scan, encoded as a passing test.
- `findings.ts:57` — `stableId(domain, subject, title) = sha256(domain ∷ subject ∷ normTitle)[:16]`.
  Two distinct findings that normalize to the same tuple **collapse to one id**; `reconcile()`
  (`findings.ts:97`) keys its `seen`/`prev` maps on `id`, so a collision silently keeps one and
  drops the other. Adding a dimension axis multiplies this risk (security vs customer-facing finder,
  same file, similar title).
- `surface.ts` — `enumerateSurface(domain, root?)` resolves globs → real files via `Bun.Glob`
  (reuse this for derivation). `scope-guard.ts:12` — `matchesGlob` via `Bun.Glob`. `validate.ts` —
  `validateHighRisk` + `majorityKills` (PAL-challenge ×2, default-to-refuted). `cli.ts:35` —
  `reconcile` / `check-scope` / `report` subcommands, `--domains` required (the ADR-0188 fix). All
  reusable as-is.
- `AGENTS.md` — the binding boundary: **no checker implementations, no dispatch, no model calls
  in-package**. v2 honors it — derivation + coverage gate are pure library additions; the loop,
  fan-out, and critics stay in the Workflow driver.

**The driver** — `outputs/specs/lift-phase/AUDIT-RUNBOOK.md` (the repeatable Workflow procedure) +
`outputs/audit/{REPORT-2026-07-01.md,ledger.toml}` (the v1 output; 1 finding still `open` — the
admin CF-Access origin-bypass operator-fork).

**Surface classification data already on disk** — `docs/state/public-surface.md` (the authoritative
Apache-2.0 / commercial / internal-only split), `scripts/export-public-mirror.ts` (selects the 15
Apache packages, renames `@caisson/` → `@caisson-sh/`, fails loud on any commercial dep), and
`tooling/standards-gate/src/checks.ts` (`OPEN_BASE_NAMES`). v2 reads these instead of re-deriving.

**Copy law** — ADR-0080 (precise-scope honesty, "claim nothing we do not ship") governs marketing
copy today; there is **no written standard for shipped-source inline comments** (see Fork E).

---

## Design

### The reframe: two independent axes, cleanly split

v1 conflated **WHERE** (which files) with **WHAT** (which risk). v2 separates them:

- **DOMAIN = a tree partition (WHERE).** One domain per top-level workspace unit. Every path in the
  repo belongs to **exactly one** domain — a clean partition, not overlapping risk globs. Derived
  mechanically, gated for completeness.
- **DIMENSION = an audit lens (WHAT).** A fixed, small set of quality/risk questions applied to each
  domain. New each run only if a lens is added by ADR, never discovered mid-flight.

A **cell** = (domain × applicable-dimension) = one finder shard. The matrix is sparse: a dimension
applies to a domain only if the domain's **surface class** warrants it (below).

### DOMAIN axis — mechanically derived + gated (fixes the under-scan, requirement #1)

`deriveDomains(root)` (new, pure, in-package) globs the tree and emits one domain per unit:

```
packages/*            → 35 domains (one each)
apps/*                →  8 domains (one each)          # incl. apps/studio — see hygiene dimension
services/*            →  3 domains (docs, license, support-bot)
registry/{worker,scripts,schema}  → 3 domains          # the service, not the re-exported schema pkg
tooling/*             →  6 domains
infra/*               →  6 domains (discord, kms, license-issuer, signoz, terraform, worm)
.github/workflows     →  1 domain (all 8 workflows)
packages/cli/templates → 1 domain (generator EMITTED buyer output — distinct from cli source)
docs-content          →  1 domain (docs/ + specs/ + knowledge/ prose + site MDX)
scripts/              →  1 domain (repo scripts incl. export-public-mirror + mirror-assets)
oss-mirror            →  1 synthetic domain (the exporter's output — see Fork D)
```

≈ **66 domains**, all derived — none hand-typed. The **domain-coverage gate** (`coverage-gate.test.ts`,
new) is the mechanical guarantee:

1. Enumerate every leaf tree-unit under the repo, minus an **explicit** `IGNORE` set
   (`node_modules`, `dist`, `.turbo`, `coverage`, `outputs`, `.git`, lockfiles).
2. Assert every remaining unit maps to **exactly one** derived domain. **Fail loud** on any unit
   that is _unclaimed_ (the under-scan) OR _double-claimed_ (the v1 overlap bug).
3. The `IGNORE` set is a reviewed constant — adding to it is a visible diff, not a silent skip.

This replaces the `domains.test.ts:6` hard-coded 24-id `toEqual`. You **cannot** start a run with an
unclaimed dir; the 6→24 mid-run growth is structurally impossible.

### Surface classification (requirement #4 — internal-vs-sold separation)

Every domain carries a class, read from `docs/state/public-surface.md` + package `license`/`private`
fields (not re-derived). Four classes on two sub-axes — _distribution_ (does a buyer get the source?)
× _audience_ (is the output buyer-facing?):

| Class             | Members                                                                                                                                                                 | Distribution              | Buyer-facing               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------- |
| **oss-source**    | the 15 Apache-2.0 pkgs = the public mirror set                                                                                                                          | buyer + world gets source | yes (public GitHub)        |
| **sold-source**   | edition members, à-la-carte (`ai-evals`), `agent-runner`, field-crypto, `packages/cli/templates` emitted output                                                         | buyer gets source         | yes (buyer reads it)       |
| **buyer-runtime** | `apps/site`, `services/docs`, `services/license`                                                                                                                        | internal source           | **output** is buyer-facing |
| **internal-only** | `apps/admin`+`studio`, `tooling/*`, `infra/*`, registry service, `pricebook`, `license-issue`, `audit-harness`, `platform-reads`, `scripts/`, `docs-content`, `.github` | never buyer-visible       | no                         |

The classification is itself an audit output: a domain whose class is ambiguous or mis-declared is a
finding.

### DIMENSION axis — ranked (requirements #3, #4, #5)

Seven dimensions. Applicability keys off surface class (sparse matrix). Ranked by
`risk × buyer-exposure × base-rate` (how likely it is actually present):

| #      | Dimension                                       | What it hunts                                                                                                                                                                              | Checker (lane)                            | Applies to                                                 |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| **D1** | **security-floor**                              | secrets-compare, shell-exec, auth/RLS, timing-safe, SSRF, injection, money-integer (the entire v1 harness content)                                                                         | `gw-security-auditor` (sonnet)            | all code domains                                           |
| **D2** | **secret / credential leakage**                 | hardcoded keys/tokens, private infra endpoints, `~/.gridwork` refs, live URLs in files that ship                                                                                           | `gw-security-auditor` (sonnet)            | all                                                        |
| **D3** | **customer-facing / sales-ready quality** (NEW) | copy·README·`package.json` metadata·**inline comments**: no gridwork-isms, no session/ADR shorthand, no jargon, no TODO/FIXME, professional tone (ADR-0080); error messages as buyer UX    | `gw-code-reviewer` + copy critic (sonnet) | oss-source, sold-source, buyer-runtime                     |
| **D4** | **internal-vs-sold leak** (NEW)                 | internal-only refs leaking into shipped surfaces: operator names, private infra paths, internal repo/ADR/session references, `apps/admin`/`tooling`/`infra` mentions in sold or oss source | `gw-code-reviewer` (sonnet)               | oss-source, sold-source; **output-only** for buyer-runtime |
| **D5** | **license-tier correctness**                    | SPDX header + `LICENSE` file + `no-depend-up` matches declared tier; mirror self-containment (no commercial dep in the Apache set)                                                         | `standards-gate` (shell)                  | all packages + oss-mirror                                  |
| **D6** | **docs-vs-code truthfulness**                   | claims in docs/site/READMEs match built reality (the `security/page.tsx` static-export lie class)                                                                                          | `gw-code-reviewer` (sonnet)               | buyer-runtime, docs-content, every README                  |
| **D7** | **hygiene / residue**                           | dead code + dead flags, orphaned dirs (`apps/studio` — ADR-0140 said "removed", still on disk), dependency-hygiene/supply-chain, versioning + changelog coherence after the 0228 republish | haiku recon + `standards-gate`            | all                                                        |

Consolidations (ponytail): error-message quality folds into D3 (it is buyer-facing copy);
dependency-hygiene + versioning-coherence fold into D7 (both are mechanical residue checks). Seven
dimensions, not ten.

### The re-run as a Workflow program (requirement #6 — loop, models per doctrine lanes)

One Workflow, per `AUDIT-RUNBOOK.md`, extended with the loop + oracle. **Never fable for fan-out**
(binding, Caisson CLAUDE.md):

```
ENUMERATE  (haiku / main): deriveDomains() → coverage-gate (fail-loud) → build cell list
                           (domain × applicable-dimension), each cell → enumerateSurface() files
FAN-OUT    (sonnet + haiku): one finder per cell.
             D1/D2 cells → gw-security-auditor (sonnet)
             D3/D4/D6   → gw-code-reviewer / copy critic (sonnet)
             D5         → standards-gate (shell, deterministic)
             D7         → haiku recon + standards-gate
           each returns RawFinding[] {domain, dimension, subject, title, severity}
VALIDATE   (PAL challenge ×2, default-to-refuted): high-severity only — existing majorityKills spine
SYNTHESIZE (opus, main thread): reconcile(prev, all, scope=every cell's domain this run);
             unique-key assert (below); write ONE ledger; summarize
CRITIC     (opus): completeness critic — given derived domains + coverage ledger + tree, NAME any
             escaped surface or unaudited cell. Non-empty ⇒ it is a new cell ⇒ LOOP.
LOOP until DRY.
```

**Harness-mechanics fixes (requirement #6):**

- **Under-scan** → `deriveDomains()` + `coverage-gate.test.ts` (above). Domain list derived + gated,
  never hand-grown.
- **Critic name-collision drop** → (a) `stableId` gains the `dimension` input:
  `sha256(domain ∷ dimension ∷ subject ∷ normTitle)`; (b) `reconcile()` **asserts no two distinct
  `current` RawFindings share an id** — a collision throws (fail-loud) instead of silently keeping
  one; (c) a finding whose `domain ∉ deriveDomains()` throws (extends the existing scope guard from
  the hand list to the derived set), so a mislabeled domain like `audit-harness`-for-`audit-worm`
  aborts the run instead of misattributing.
- **Per-round coverage ledger** → each round appends a `coverage.toml` row per cell:
  `{round, domain, dimension, files_scanned, findings, executed:true}`. Unaudited cells are
  visible, not inferred.
- **Loop-until-dry, explicit criteria** → a round is DRY iff **all** hold: (1) coverage-gate green
  (every unit claimed), (2) every applicable cell shows `executed:true` in the coverage ledger,
  (3) the round produced **zero** findings whose id is not already in the ledger, (4) the
  completeness critic names nothing. Loop rounds until DRY. Replaces v1's "run again and see."
- **Adversarial verify pass** → keep PAL-challenge ×2 on high-severity findings (existing); ADD one
  adversarial pass on the **coverage claim** — a skeptic prompted to name an unaudited surface, run
  before declaring DRY.
- **Final completeness critic** → opus, the loop's termination oracle (above). v1's rounds 2–5 were
  this critic firing by hand; v2 makes it the explicit loop condition.

### What v2 reuses vs adds (ponytail)

**Reuse unchanged:** `enumerateSurface`, `validateHighRisk`/`majorityKills`, `summarize`,
`check-scope`, the `reconcile` scope-discipline, the PAL-challenge `Challenger` port, the
`AUDIT-RUNBOOK` Workflow shape. **Add (small, pure, in-package):** `deriveDomains()`,
`coverage-gate.test.ts`, the `dimension` field on `RawFinding`/`stableId`, the reconcile
collision-assert, a `dimensions.ts` data list + class→dimension applicability map. **Add (driver,
outside package):** the loop, the coverage ledger, the completeness critic, the two new copy-lens
finder prompts. No new framework; the harness stays a pure library, boundary intact.

---

## Tasks (atomic — for the PLAN, each with a verify command)

1. **`deriveDomains(root)` + `coverage-gate.test.ts`** — glob the tree, one domain per unit, explicit
   `IGNORE` set; test fails on unclaimed/double-claimed. Delete the `domains.test.ts:6` hard-coded
   24-id list.
   _Verify:_ `bun test packages/audit-harness/src/coverage-gate.test.ts` green; temporarily add a
   throwaway `packages/zzz-probe/` → gate FAILS; remove → passes.
2. **Dimension model** — `dimensions.ts` (the 7-dimension data list) + surface-class map read from
   `docs/state/public-surface.md` + package fields; `RawFinding.dimension` field.
   _Verify:_ `bun test packages/audit-harness/src/dimensions.test.ts` — every class resolves to a
   non-empty applicable-dimension set; oss-source ⊇ {D1..D7}.
3. **Unique-key + collision fixes** — `stableId` adds `dimension`; `reconcile()` throws on duplicate
   `current` ids and on `domain ∉ deriveDomains()`.
   _Verify:_ `bun test packages/audit-harness/src/findings.test.ts` — two distinct findings with the
   same domain+dimension+subject+title raise the collision error; existing reconcile scope tests
   still green.
4. **Coverage ledger + report** — extend `summarize`/`report` to emit `coverage.toml` (per-cell
   executed rows) alongside the findings ledger.
   _Verify:_ `bun run --cwd packages/audit-harness src/cli.ts report` prints a per-cell coverage grid.
5. **Driver: loop + completeness critic + coverage-adversary** — extend `AUDIT-RUNBOOK.md` + the
   Workflow with the DRY predicate, the opus completeness critic, and the coverage-claim adversary.
   _Verify:_ dry-run over ONE domain (`packages/kernel`, all applicable dimensions) → coverage ledger
   shows every kernel cell `executed:true`, other domains untouched in the findings ledger.
6. **Driver: two copy-lens finder prompts** — D3 (customer-facing) + D4 (internal-leak) finder
   agents, grounded in ADR-0080 + the Fork-E comment standard (if locked).
   _Verify:_ run D3 over `packages/kernel/README.md` + a seeded jargon line → the seeded line is
   flagged; a clean line is not.
7. **Ledger migration** — per Fork C: archive `outputs/audit/ledger.toml` →
   `ledger-v1-2026-07-01.toml`; carry forward only the 1 open admin CF-Access finding.
   _Verify:_ fresh `ledger.toml` contains exactly the carried-forward finding; v1 ledger preserved.
8. **`bun run check` green** across the harness package after all of the above.
   _Verify:_ `bun run check` (turbo) + `bun run gate` (standards-gate) both green.

> Tasks 1–4 + 7–8 are in-package/data (S). Tasks 5–6 are driver/prompt (M). The re-run itself is a
> separate operator-gated act **after** this SPEC locks — this SPEC does **not** run the audit.

---

## Verification (goal-backward vs the Goal)

Re-ask the Goal, not the checklist:

- **"Complete, cleanly-split coverage, nothing discovered mid-run?"** → the coverage gate is green on
  round 1, and the completeness critic names nothing on the first DRY check. If the critic names a
  surface after a green gate, the derivation missed a tree unit → **fix `deriveDomains`, do not grow
  a hand list.** Success = zero domains added by hand across the whole run.
- **"Mirror + all customer-deliverable packages first-class?"** → every oss-source + sold-source
  domain shows D3+D4 cells `executed:true` in the coverage ledger; the `oss-mirror` domain was
  audited (per Fork D).
- **"Customer-facing quality enforced?"** → D3/D4 produced findings for any real jargon/leak, and a
  seeded gridwork-ism in a shipped file is caught (task 6 verify).
- **"Harness mechanics fixed?"** → the collision test throws (not drops); a mislabeled domain aborts;
  the loop terminates on the explicit DRY predicate, not on exhaustion.
- **Fail condition:** any tree unit unclaimed at run start, OR the domain list grows mid-run, OR a
  finding is silently dropped by id-collision ⇒ VERIFY fails, do not trust the run.

---

## Risks

- **Coverage gate is only as good as its `IGNORE` set** — an over-broad ignore silently re-opens the
  under-scan. Mitigation: `IGNORE` is a small reviewed constant; any addition is a visible diff and a
  review line-item.
- **D3/D4 are subjective** — "jargon" and "internal-ism" are judgement calls; sonnet finders will
  produce false positives. Mitigation: ground both in a written rubric (ADR-0080 + Fork E), keep them
  advisory (non-blocking per ADR-0134), operator triages `open → accepted`.
- **~66 domains × up-to-7 dimensions** could be a large fan-out. Mitigation: sparse matrix (class
  gates most cells off), haiku for D7/recon, D5 is deterministic shell — the sonnet finder count is
  bounded to real code domains × the applicable lenses, not the full cross-product.
- **Mirror audits a generated artifact** (Fork D) — auditing `mirror-out/` means auditing something
  not committed. Mitigation: run the exporter deterministically in the round, audit its output +
  the diff it introduces.
- **Fresh ledger loses v1 history** (Fork C) — the new dimension key makes v1 ids incomparable
  anyway; mitigation: archive, don't delete, and carry the 1 open finding forward explicitly.

---

## Open forks (operator-owned — recommendation + confidence; do NOT auto-decide)

Per the one-operator rule, these wait for an explicit lock; nothing below is pre-bound.

- **Fork A — domain granularity: per-dir (~66) vs per-group (~10 coarse: packages/apps/…).**
  _Rec:_ per-dir. Coarse groups reintroduce the under-scan — a single `packages` domain lets a finder
  skim 35 packages as one surface. Per-dir is the whole point of the mechanical partition.
  **Confidence: HIGH.**
- **Fork B — advisory (ADR-0134) or does v2 promote any dimension to a blocking gate?** The
  customer-facing (D3) + internal-leak (D4) + coverage dimensions are arguably launch gates (you
  don't ship jargon to buyers).
  _Rec:_ keep the RUN advisory per ADR-0134; in a **separate follow-up**, promote the coverage-gate +
  D3/D4 into `standards-gate` as blocking checks **only after** the v2 run establishes a clean
  baseline (can't gate on a dirty tree). **Confidence: MEDIUM.**
- **Fork C — this run: fresh ledger vs incremental on the 51-finding v1 ledger.**
  _Rec:_ FRESH. The tree changed massively (agent-runner, admin mutation surface, npm delivery,
  members-fold) and the new `dimension` key makes v1 ids incomparable. Archive
  `ledger.toml → ledger-v1-2026-07-01.toml`, carry forward only the 1 open admin CF-Access finding.
  **Confidence: HIGH.**
- **Fork D — the OSS mirror: audit the generated `mirror-out/` output, or audit the 15 source pkgs +
  trust `export-public-mirror.ts`?**
  _Rec:_ BOTH — audit the source pkgs (they carry the D1/D2 risk) AND run the exporter once and audit
  the output diff (scope-rename, dropped tests, restamped licenses), because D3/D4 must see exactly
  what lands on public GitHub, and the `@caisson/` → `@caisson-sh/` rewrite could leave a dangling
  internal specifier. **Confidence: MEDIUM-HIGH.**
- **Fork E — inline-comment sales-ready standard: extend ADR-0080 with a written "shipped-source
  comment" rubric, or let the D3 finder judge on ADR-0080 marketing-copy laws alone?**
  _Rec:_ extend ADR-0080 with a one-paragraph shipped-source comment standard (no ADR/session
  shorthand, no operator names, explains-for-a-buyer-not-a-teammate) as part of this lock, so the
  finder has a rubric instead of vibes and D3 is reproducible. **Confidence: MEDIUM.**

---

## Effort / Value

**Effort:** S (tasks 1–4, 7–8 — in-package derivation + keying + ledger) · M (tasks 5–6 — driver
loop + two copy-lens prompts). The re-run itself is a separate, larger, operator-gated act.
**Value:** HIGH — turns "we re-ran until a critic went quiet" into a proven-complete, sales-ready
audit before the mirror goes public and before launch; the two new dimensions guard a launch-blocking
quality bar the v1 audit could not see.
