---
date: 2026-07-21
status: armed
scope: one overnight autonomous run of the ADR-0374 visual-remediation wave
---

# RUN-AUTH — overnight autonomous execution (operator pre-authorization, 2026-07-21)

Operator-granted standing answers for ONE fully-autonomous overnight run executing the
ADR-0374 wave (SPEC.md in this dir). Everything below is pre-authorized — the run does NOT
page the operator overnight. Anything not covered here falls back to the authority floor
(always-page classes stay always-page: secrets, deploy, restart, force-push, data-migration).

## Execution shape (operator override of ADR-0374 lock 4, ops-level)

- W1–W4 still run as **parallel worktree lanes**, but fold into **one integration branch
  `fix/vr-integration` → ONE PR** (override of "one PR each"; recorded here + on the board).
- **End state: PR OPEN on green. Stop there.** Merge and any deploy stay operator acts in
  the morning. No auto-merge, no Railway deploy, no npm/registry publish overnight.

## Blocker policy

- **Fix-forward; carve out unfixables.** Iterate until green; if a finding's fix is truly
  stuck (needs an operator-only call, breaks a gate irreconcilably), drop it from the PR,
  keep its ledger row open, list it in the morning report. The run never stalls and never
  pages overnight.

## Vendor lanes

- **Codex** via `gw dispatch` (headroom-checked, `gw codex limits`) for bounded
  mechanical/review dispatches — subscription lane, no cap.
- **kimi-k3** via the opencode headless lane (`openrouter/moonshotai/kimi-k3`) —
  XDG-isolated with the **deny-all permissions config written explicitly**
  (`{"permission":{"*":"deny"}}`; default opencode perms are NOT fail-closed).
- **OpenRouter hard spend cap for the run: $10.** At the cap, stop OpenRouter calls and
  continue CC-native; note it in the report.
- Model routing per the binding repo rule: explicit `model` on every dispatch; fable only
  on crypto/money/license seams, never for fan-out.

## Design judgment

- Agents pick the **most polished / full-featured option**, holding the same standards
  (ADR-0078 brand system · ADR-0080 copy laws · impeccable/refero craft, refero research
  first on the new surfaces).
- **kimi-k3 adversarial round on the KEY design calls** before they land: light-mode Shiki
  token tuning (post theme-following flip), the truthful-signals block, the accent-token
  darken.
- **Limited flex:** where the brand floor/design system prohibits the clearly better
  option, the agent may deviate — every deviation logged as a decided-by-evidence note in
  the PR body for morning review. **No flex on the ADR-0082/0237 truth floor** (never
  fabricate proof, counts, or claims) and none on the security floor.

## Gates (all must be green before the PR opens)

`check` · `standards-gate` · `registry-index` · `oscal-conformance` · `deterministic` ·
`bun run sot` · golden-file re-snapshots (W2) · changesets for any `packages/*` change ·
in-session SHIP audits: gw-code-reviewer + UI review (`ui`/`frontend` tags), findings
adversarially verified and fixed in-branch.

## End-of-run deliverables

1. The ONE PR on `fix/vr-integration`, body carrying: wave map, design decided-by-evidence
   notes + any brand-floor deviations, carve-out list, gate/audit results.
2. A **run-summary Artifact** (private) covering the whole run: per-wave diffs, scores
   touched, gates, audits, design decisions, carve-outs, vendor spend vs the $10 cap.
3. Morning report in-session + ledger note (`docs/state/outstanding-work.md` row update
   rides the PR).
