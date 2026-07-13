# VERIFY — Codex production browser audit lane

Goal-backward verification against the accepted SPEC and the implementation diff.

**Verdict: PASS for the requested reusable playbook/tooling goal.** A live production audit was not part of this implementation run; the first real `@Browser`/`@Chrome` run remains an operator-visible use of the new skill.

## Acceptance criteria

1. **Repo skill and visual model route:** `.agents/skills/caisson-production-browser-audit/` validates with the official skill validator, includes Codex UI metadata, selects GPT-5.6, and excludes text-only Spark from visual verdicts.
2. **Grounding order:** `SKILL.md` and `references/method.md` require Exa, Refero styles/screens/flows, a reference lock, then Caisson/Impeccable context before production interaction.
3. **Three rings:** the generated manifest contains 27 public, 10 buyer, and 14 admin surfaces derived from the marketing registry and real page trees.
4. **Mutation contract:** strict manifest validation requires owner, precondition, expected transition, compensator, cleanup assertion, and stop condition.
5. **Denylist:** `preflight.ts` and `references/safety.md` deny purchases, irreversible cancellation, account/identity/auth/permission changes, real-recipient messages, uploads, and non-fixture admin mutation.
6. **Cleanup fail-stop:** journal tests prove only `planned → applied → observed → reverted → verified`; cleanup failure sets a P0 lock and concurrent unresolved mutation is rejected.
7. **Evidence:** strict run validation requires route/journey/browser context, evidence paths, governing rule, and clean-session replay for P0/P1; absolute and escaping paths fail.
8. **Design/behavior quality:** the references encode the Refero lock, Caisson identity, Impeccable brand-versus-product register split, accessibility, responsive, recovery, negative-path, and degraded-state checks.
9. **Advisory boundary:** reconciliation always returns `advisory: true`; candidate tests require operator acceptance and clean replay and only produce markdown. No existing Playwright or live-test file changed.
10. **Bundle output:** finalization produces `REPORT.md`, `findings.json`, `mutation-journal.json`, and `forks.md`; candidate markdown is separately staged after acceptance.

## Fresh evidence

- Focused suite: 18 tests passed across the skill and `@caisson/browser-audit` after RED/GREEN cycles.
- `bun run check`: 197/197 Turbo tasks successful; standards gate clean.
- Official skill validator: `Skill is valid!`.
- TypeScript and ESLint: skill scripts typecheck; browser-audit package build/lint pass.
- Manifest dry run: 51 surfaces, stable ring order, written mode `0600` under the ignored evidence root.
- Credential preflight: all four required credentials present as booleans only; no value or length emitted.
- Journal dry run: final state `verified`, `mutationLock: false`.
- Targeted Semgrep over the new TypeScript surface: 0 findings. TruffleHog: 0 verified secrets.
- `git diff --check`: run separately at final wrap.

## Honest boundary

This shell does not expose the Codex app's interactive `@Browser`/`@Chrome` surface, so it did not claim a real Ring-1 visual verdict or perform a Ring-2 production mutation. The skill makes those actions explicit, operator-visible, profile-separated, and cleanup-gated when invoked in the Codex app.
