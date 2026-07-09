# Kickoff B (code tree) — repo hygiene wave + full audit-findings remediation

**Authored:** 2026-07-05 (operator picker: split-by-tree; the docs-tree sibling is
`outputs/kickoffs/sot-expansion-and-automation.md`). **Builds:** NEXT session, parallel with
Kickoff A (worktree-isolated, trees are disjoint).
**Specs:** `outputs/specs/repo-improvement-program/SPEC.md` (hygiene wave) + the audit ledger
`outputs/audit/ledger.toml` (ADR-0233 harness) with `outputs/specs/audit-v2-remediation/TRIAGE.md`
as the triage record.
**Branch:** `fix/hygiene-audit-remediation` off `main` (worktree). **Session model routing:**
class sweeps + bounded fixes → **sonnet**; adversarial high-verification + synthesis → **opus**;
grep/classify → **haiku**. Never Fable for fan-out.

## Operator locks carried in (2026-07-05 picker — do not re-ask)

1. **Audit scope = ALL 264 open findings** (91 high · 117 warn · 56 info) — including the TRIAGE
   §3 roadmap-only buckets (D6 stale-docs tail, missing-README wave, D7 hygiene residue), which
   this lock un-parks. Drive the ledger toward terminal.
2. **Verify-then-fix ALL 91 open-highs** — every high gets an adversarial reproduce-check before
   any fix (TRIAGE §5: ~29 round-3 highs may be refuted; every open-high is a candidate, not a
   verdict). A refuted finding is closed with the refutation recorded, never "fixed".
3. **Hygiene wave rides here** (program spec build-now rows): #4 dep catalog (zod-line mini-audit
   FIRST — v3 vs v4 per package family is a judgment call) · #5 build-vs-buy page (copy-gate
   pipeline) · #6 Content-Signals header · #7 knip advisory CI · #8 renovate · #10 changesets
   `privatePackages` policy. (#3 CLAUDE.md trim rides Kickoff A — docs tree.)

## The open-findings shape (measured 2026-07-05, post PRs #110–#115)

- **264 open of 941** (677 fixed, 0 accepted): 91 high · 117 warn · 56 info.
- By dimension: **D3 = 149** (shipped-source prose class dominates) · D4 = 54 · D6 = 48 ·
  D2 = 7 · D7 = 5 · D1 = 1.
- Top domains: oss-mirror 20 · root-docs 18 · agent-dev 13 · ui 12 · then a long ~5–9-per-package
  tail across ~30 packages.
- Known reconcile hazards (TRIAGE §5): the `packages/billing` LemonSqueezy/Polar CONTRADICTION
  (`7187ceba82df7646` dead-exports vs `8a94468dbc3385e6` live-but-undocumented — reconcile which
  is true BEFORE touching either) · the D3 SS-12 trailing-ADR-citation class (~25 package.json
  descriptions — sweep as ONE class, never adjudicate one-by-one).

## Session flow

1. **Class-first clustering (haiku/sonnet recon):** bucket the 264 by mechanically-identical
   class (SS-x prose classes, missing-README, description-jargon, stale-doc claims) vs
   genuinely-individual findings. Expect the ~140-finding D3/D4 prose mass to collapse into a
   handful of class sweeps.
2. **High-verification wave (opus, parallel):** all 91 highs through adversarial
   reproduce-checks — does the finding still hold at HEAD? Output per finding: CONFIRMED (fix
   in wave 3) or REFUTED (close with evidence). Perspective-diverse verifiers on the
   security-adjacent domains (billing, license-verify, tenancy-rls, field-crypto, audit-worm).
3. **Fix waves (sonnet, worktree-parallel by domain):** class sweeps first (one agent per class,
   repo-wide), then per-domain residuals. The hygiene-wave rows run as their own parallel lane
   (#4 leads with the zod mini-audit; #5 goes through the F7 draft→skeptic→gate copy pipeline).
4. **Info-row disposition:** fix what rides a class sweep for free; anything proposed for
   `accepted` instead of a fix goes to the OPERATOR as one batch list — the ledger convention is
   that only the operator hand-edits `open→accepted` (`ledger.toml` header). Never auto-accept.
5. **Ledger reconcile LAST:** re-run the harness reconcile so fixed findings flip mechanically.
   The absence rule applies (absent-from-input reads as fixed) — the reconcile input must cover
   every domain touched or verified, same discipline as the design-critic reconcile (PR #122).
6. **Verify goal-backward:** full gate green (149 turbo tasks + kernel gate) · ledger open-count
   reported before/after with every remaining open row either operator-accepted or carrying a
   named trigger · program-spec Verify block for the hygiene rows (install clean after catalog
   repoint, knip/renovate/changesets configs present, Content-Signals header observable,
   build-vs-buy shipped through the copy gate).

## Boundaries

- Changesets: EVERY touched versioned package needs a named changeset (empty ones don't count;
  untracked ones are invisible to `changeset status` — git add first). The prose-class sweeps
  will touch many packages — batch the changeset authoring, and keep bodies buyer-neutral
  (ADR-0241 prose gate).
- greptile-gate WILL fire (billing, license, tenancy-rls, field-crypto, audit-worm, tool-exec
  paths are in the critical glob) — resolve every inline P0/P1 before merge.
- Never `.strict()` a provider webhook envelope (PR #114 lesson) — relevant to any billing-domain
  finding fix.
- No product-behavior changes ride a prose fix; a finding whose fix would change behavior gets
  its own task + review, not a sweep slot.
- The do-not-copy ledger (program spec) is binding — no ADR-enforcement bots, no doc-sync bots.
