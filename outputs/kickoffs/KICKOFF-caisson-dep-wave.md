# KICKOFF — dep wave 2026-08-11: drain the expiring scan-baseline accepts (CAISSON-190)

**Lane:** solo worktree `/home/gw/lab/caisson-wt-deps`, branch `fix/dep-wave-2026-08-11` (cut from
`main` @ `45707a1a`). One PR, conventional commits (`chore(deps): …` / `chore(security): …`).
**Open the PR and leave it unmerged — the coordinator session merges on green** (ADR-0328 wave
convention). Linear: CAISSON-190 (move In Progress → In Review at PR-open). CAISSON-151
(better-auth) is already closed — 1.6.25 landed in #379; do NOT touch better-auth.

**Deadline mechanics:** every accept below carries `ignoreUntil`/`expired_at = 2026-08-12` and
self-revokes that day — if this PR is not merged by 2026-08-11, the `deterministic` CI gate goes
red repo-wide on 08-12.

## Mission

Land the six in-range dependency bumps the 2026-08-09 baseline promised, then delete every dated
accept they retire. Proof: `bun run security:scan` rc=0 with ZERO date-carrying entries left in
either baseline file.

## The bumps (all in-range; priority order)

1. **dompurify** 3.4.12 → 3.4.13 — GHSA-55q2-fjhq-7xh7 (IN_PLACE XSS). Enters via posthog-js in
   the SITE BROWSER BUNDLE — the one prod-adjacent item; land it first.
2. **nanoid** 3.3.16 + 3.3.8 → 3.3.17 — CVE-2026-67213/-67214 (one trivy-HIGH). postcss +
   `@trigger.dev/core` chains.
3. **hono** 4.12.30 → ≥4.12.34 — GHSA-8j4g-w8fx-2239 + CVE-2026-71848/-71849/-71850. Dev-only
   wrangler/miniflare chain (registry Worker harness).
4. **brace-expansion** 1.1.16 → 1.1.18, 2.1.2 → 2.1.4, 5.0.8 → 5.0.9 — GHSA-rgw5-rvv9-x895
   (+ retires resident GHSA-mh99-v99m-4gvg). minimatch chains under eslint/glob tooling.
5. **fast-uri** 3.1.4 → 3.1.5 — GHSA-7p8r-x3mc-p8w7. This one is a ROOT `package.json`
   `overrides` entry — direct edit, then re-install.
6. **js-yaml** 3.15.0 → 3.15.1, 4.3.0 → 4.3.1 — GHSA-5p4m-2wfm-xmqj. changesets CLI / eslint
   config chains.

Everything except fast-uri is transitive (bun `overrides` are TOP-LEVEL-ONLY — you cannot pin a
nested copy). The sanctioned mechanism is a lock refresh: `bun update <pkg>` per target (or
delete the stale lock entries and re-`bun install`), then verify each locked version with
`grep -o '"<pkg>@[^"]*"' bun.lock | sort -u`. A broad re-resolve is now expressible because the
youngest fix (nanoid 3.3.17, published 2026-08-03) clears the 7-day release-age floor on
2026-08-10 UTC.

## Release-age floor — two traps

- **Never bypass the floor.** If a bump refuses because a fix is still inside the 7-day window,
  wait for the UTC date to roll — no override flags, no manual lock editing to smuggle a version.
- **Cold-cache trap (project memory, reconcile-241):** with a cold bun cache the age floor can
  mis-evaluate and fail a bump that is actually clear. If the floor trips on a package whose fix
  is ≥7 days old, re-run after the cache warms before concluding red.

## Baseline cleanup (after bumps are locked + scan-proven)

- `osv-scanner.toml`: delete ALL TEN `[[IgnoredVulns]]` entries carrying
  `ignoreUntil = 2026-08-12` (GHSA-rgw5, GHSA-7p8r, GHSA-8j4g, GHSA-5p4m, CVE-2026-67213,
  CVE-2026-67214, CVE-2026-71848, CVE-2026-71849, CVE-2026-71850, GHSA-55q2) **plus** the
  resident `GHSA-mh99-v99m-4gvg` entry (its 2026-08-06 amendment says it retires with this wave's
  brace-expansion bump). The `CVE-2026-54285` OTel accept STAYS (undated resident, not this
  wave). Update the header's "NOT listed here" comment block if any bump graduates into it.
- `.trivyignore.yaml`: delete the two `vulnerabilities:` mirrors (CVE-2026-67213,
  CVE-2026-69152). The `secrets:` and `misconfigurations:` sections are untouched.
- `docs/security/tooling-playbook.md`: move the retired accepts' rows in the Accepted-findings
  table to the retired convention used there (keep the audit trail — rows move, never vanish).
- `docs/state/outstanding-work.md`: nothing to do — the coordinator owns tracker rows at wrap.

## Verification (in order)

```sh
bun install                                     # fresh worktree
bun run security:scan                           # rc=0, zero filtered-by-date entries remaining
grep -n "ignoreUntil\|expired_at" osv-scanner.toml .trivyignore.yaml   # expect NOTHING
bunx turbo run typecheck test build --continue=never   # lock refresh touches everything — full gate
bun run sot                                     # BEFORE the PR, not after (project memory)
```

Gotchas under load (project memory): PGlite suites flake under parallel build load — confirm any
red with `--concurrency=1` before debugging; bun's 5s per-package test timeout is the flake class,
not your diff.

## Changesets

A lock refresh + root-override bump touches no `packages/*` manifest → no changeset. IF a bump
forces a `packages/*` or workspace `package.json` edit, that package needs a changeset (prose
without ADR citations — the gate bans them). `bun run sot` runs the preflight; trust it.

## Hard don'ts

- No unrelated version bumps — this PR is exactly the six groups above.
- No release-age bypass, no hand-edited lock versions, no `--force` anything.
- No registry `ledger.jsonl` writes, no tag or publish work, no deploy.
- Site bundle sanity for the dompurify path: `apps/site` must still build (`bunx turbo run build
--filter=site`); no other site changes.

## Context

Accepts were operator-locked in-session 2026-08-09 (docs PR #408) to unblock the audit-remediation
wave; each entry is flagged for operator retro-veto and each reason block names this wave as its
retirement. Full accept texts: `osv-scanner.toml` lines 43–95, `.trivyignore.yaml` lines 10–30,
playbook table `docs/security/tooling-playbook.md` (Accepted findings).
