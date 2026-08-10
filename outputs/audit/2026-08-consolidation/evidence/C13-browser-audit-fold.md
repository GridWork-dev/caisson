# C13 — fold browser-audit package into its skill

**Verdict:** CONDITIONAL FOLD  
**Size:** about 46 net LOC  
**Risk:** medium because deletion-only loses required CI coverage

## Evidence

- Sole production caller:
  `.agents/skills/caisson-production-browser-audit/scripts/finalize.ts:1-5`.
- Entire package implementation is a 39-line status adapter over the shared reconciler:
  `tooling/browser-audit/src/reconcile.ts:1-39`.
- Package footprint is 39 source + 25 tests + 47 metadata/config = 111 lines.
- The skill already has finalization tests:
  `.agents/skills/caisson-production-browser-audit/scripts/finalize.test.ts:1-29`.
- `tooling/browser-audit/package.json:7-19` is currently the only Turbo-owned build/lint/test home.
- `.agents` is outside root workspaces (`package.json:6-16`), while required CI runs workspace tests
  (`.github/workflows/ci.yml:123-135`).

## Required fold shape

Move the local interfaces/reconcile call and assertions into the skill, then add an explicit required
CI invocation for the skill tests. A deletion-only patch is invalid.

## Registry/revenue

Private tooling package, no registry/bundle rows. Production browser-audit behavior stays in-repo.

## Refute attempt

The package boundary has no semantic consumer beyond the skill, but its test ownership is real.
Refutation downgraded the fold to conditional CI-preserving work.

**Buyer/site notice:** none; audit operators notice if CI wiring is omitted.
