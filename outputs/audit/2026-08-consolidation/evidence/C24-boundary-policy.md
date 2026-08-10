# C24 — centralize duplicated boundary-policy data

**Verdict:** VERIFIED FOLD-INTO one policy data source  
**Size:** roughly neutral to 15 net LOC  
**Risk:** medium enforcement correctness

## Evidence

Duplicated policy data:

- Provider SDK list: `tooling/eslint-config/boundaries.js:16-59`.
- Dependency-cruiser provider regex: `.dependency-cruiser.cjs:15-20`.
- Standards-gate meta/bundle list: `tooling/standards-gate/src/checks.ts:42-61`.
- Dependency-cruiser meta list: `.dependency-cruiser.cjs:22-35`.
- Canonical six bundle IDs: `packages/registry-schema/src/bundle-vocabulary.ts:25-33`.

The copies have drifted: dependency-cruiser knows four legacy names, omits five current bundle
roots, and still names deleted `local-ai`. Standards-gate delegates dynamic/transitive direction to
dependency-cruiser (`tooling/standards-gate/src/checks.ts:1168-1174`), so this is a live false-green
class rather than cosmetic duplication.

## Safe shape

Use mirror-safe data for provider names/exempt paths and Node-readable data for bundle/meta package
classes. Generate each engine's native regex/rules; preserve ESLint, standards-gate, and
dependency-cruiser as separate enforcement mechanisms. Add a completeness/parity test.

## Registry/revenue

No registry content change. Correct bundle IDs are read from source truth, not rewritten.

## Refute attempt

Merging enforcement engines was refuted. Shared policy data survived. Provider data cannot live only
in private standards-gate because the OSS mirror exports eslint tooling.

**Buyer/site notice:** none; CI stops silently omitting package classes.
