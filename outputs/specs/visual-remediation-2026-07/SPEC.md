---
slug: visual-remediation-2026-07
status: shipped
date: 2026-07-21
tags: [ui, frontend]
adr: ADR-0374
---

# SPEC — Visual-audit remediation wave (2026-07-21 run, full scope)

## Goal

Close the 2026-07-21 visual-audit ledger: every open finding (4 P0 · 42 P1 · 188 P2 ·
268 P3 new + 89 still-present priors) either fixed or operator-`accepted` — verified by a
follow-up audit re-run whose reconcile flips the rows. Scope, contract lock, and execution
mode per **ADR-0374**; finding detail per `outputs/reviews/visual-audit-2026-07-21.md` +
`tooling/design-critic/findings.toml`.

## Non-goals

- No pricing, catalog, or commerce logic changes (SKU state is ADR-0373 territory).
- No new external reviewer/vendor; the SHIP gate stays the in-session audit lane.
- No hand-editing ledger rows to "fixed" — closure comes from the next reconcile run.

## Wave clusters (ADR-0328: one PR each, push-not-merge, reconcile at 2+)

| Wave | Branch                   | Owns (tree)                                                                                | Work                                                                                                                                                                                                                                                                                                                                                                   | Linear                                |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| W1   | `fix/vr-docs-shell`      | `apps/site/app/docs/*` + **`apps/site/app/global.css` (exclusive)** + legal pages' anchors | The 4 P0s (`min-width:0` content track · `overflow-wrap:anywhere` prose-only · `overflow-x:auto` code/tables) · re-enable DocsLayout mobile nav · TOC-pill offset · link-a11y: `.cs-link` on the 6 legal anchors then the scoped `.cs-prose a` underline inversion (verify G183 first) · docs-family P2/P3 sweep                                                       | CAISSON-136, CAISSON-138              |
| W2   | `fix/vr-ui-tokens-code`  | `packages/ui/*` + the Shiki/mdx config                                                     | Contrast gate re-pointed at **gamut-mapped hexes** + accent-token darken + golden-file re-snapshot · code-affordance: real thin scrollbar + shadow edge on both primitives, **never soft-wrap code** · ADR-0374 lock 1: theme-following code unification + glossary Shiki-lang fix + light-mode token tuning · complete the `verifyChain` glossary sample              | CAISSON-137, CAISSON-139              |
| W3   | `fix/vr-truth-copy`      | `apps/site/app/(marketing)/*` + email templates                                            | **First commit: F6 bundle count/composition truth** (derive from `members.length` or delete number words — ADR-0082 violation) · copy sweep: `workspace:*` leak · local-sync grammar · ADR ids out of buyer prose · email footer claim + receipt support path · em-dash sweep (ADR-0080) · **truthful-signals block** (ADR-0374 lock 2) on bundle popout + marketplace | CAISSON-135, CAISSON-142, CAISSON-143 |
| W4   | `fix/vr-dashboard-admin` | `apps/site/app/dashboard/*` + `apps/admin/*`                                               | Dashboard gutter (per-page audit before padding; opt-out for full-bleed tables) · admin: table-scroll wrapper + overflow guard · ReactFlow dark theme + hydration · duplicate-key fixes · support "(0)"-on-error honesty · F7: PostHog web-vitals spot-check, collapse NaN ledger items to one P3 · dashboard/admin P2/P3 sweep                                        | CAISSON-140, CAISSON-141              |

**Shared-file rule:** `app/global.css` belongs to W1 alone; W2 stays inside `packages/ui`;
`DashboardShell`/`.cs-shell__main` belong to W4. Any cross-tree need is deferred to the
reconcile session, not edited in-branch.

**P2/P3 tail routing:** each wave consumes its surface families' P2/P3 rows from the ledger
(`all-findings.json` in the audit scratchpad is mirrored into `findings.toml`); unsampled
sibling surfaces inherit the cross-surface fixes by construction (shared shell/kit).

## Verification

- Per-wave: `bun run check` + standards-gate + the wave's own visual spot-check
  (`apps/site/scripts/visual-harness.ts` on the touched routes, 390px + desktop).
- Phase-end: audit re-run (`/uiux-audit` standard) + `bun tooling/design-critic/src/cli.ts
reconcile` — target: 0 open rows outside `accepted`; W2's golden files re-snapshotted.
- SHIP: in-session audit lane (gw-code-reviewer + UI review per `ui`/`frontend` tags).
