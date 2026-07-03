# SPEC — P2 internal-prose-leakage wave + anti-regression tooling

---

id: p2-prose-tooling-wave
title: "P2 — strip internal-prose leakage from shipped packages + gate the regression"
tags: [] # untagged: REVIEW-only at SHIP — no security/auth/secrets/external-system surface
status: spec
source: audit-v2 (ADR-0233)
---

## Goal (WHAT + WHY)

A buyer who opens any `packages/*` README, CHANGELOG, `package.json` description, or `.ts`
comment sees only buyer-readable prose — no `gridwork-core`, `media-pipeline`, `Wardfile`,
`tessera`, `prospector`, `gw-ms-a2`, no bare `ADR-NNNN`/`CAISSON-NNN`/`PR #NN` ids, no
`Wave-N`/`harvest slice`/`picker round`/`P6`/`T13`/`Gate-2`/`fork-X`/`ponytail:` shorthand —
because a standards-gate guard fails the build on any new leak, and the one-pass sweep plus
the changeset formatter keep it clean by construction. This closes the audit-v2 D3+D4 cluster
(~140 of 302 open findings — the single biggest-ROI wave) and, as a side-effect, the parallel
`oss-mirror` D3/D4 reflection findings.

## Context

- The audit-v2 ledger (`outputs/audit/ledger.toml`) carries **302 open** findings; **139 D3**
  (customer-facing quality) + **55 D4** (internal-vs-sold leak) sit on `packages/`, `apps/site`,
  `apps/base`, `services/license`, `services/docs`. A single root cause — internal process
  narrative copy-pasted into shipped source — generates nearly all of them. The shipped-source
  rubric (`docs/shipped-source-quality-rubric.md`, ADR-0233 Fork-E) defines the citable SS-N
  rules; this SPEC is the wholesale remediation + the guard that holds it.
- Confirmed leak shape (real `path:line` hits, grep-grounded):
  - `packages/agent-dev/README.md:6,10` — `gridwork-core` + `media-pipeline` "pro-private" framing.
  - `packages/agent-kernel/README.md:62-63` — "Rebuilt clean from the public gridwork-core".
  - `packages/ai-config/README.md:6,10` — same pattern, `gridwork` + `media-pipeline`.
  - `packages/alerting/README.md:65-66` — `ADR-0135` + `gridwork` + `media-pipeline`.
  - `packages/cli/README.md:6` — `## Wave-0 scope (skeleton)`.
  - `packages/prompt-registry/README.md:5` — "Composes the Wave-0 substrate".
  - `packages/billing/CHANGELOG.md:41`, `packages/credits/CHANGELOG.md:49`,
    `packages/field-crypto/CHANGELOG.md:23-32`, `packages/tenancy-rls/CHANGELOG.md:45` —
    `CAISSON-5..13` Linear ids verbatim from internal commit messages (changeset formatter
    inlines the markdown body unchanged).
  - **33 SS-12 opens**: `package.json` `description` fields across most packages end in a bare
    `ADR-0014/0060/0070`-style citation string; the registry `index.json` (built from manifest)
    surfaces these on npm.
- Standards-gate machinery: `tooling/standards-gate/src/checks.ts` exports check fns returning
  `Finding[]` (`severity: "error"` fails the gate); `cli.ts` runs them in sequence. Existing
  checks already prove the pattern (`checkCopyPaste`, `checkOpenCoreLicensing`). The new guard
  slots in alongside.
- Changeset formatter: `.changeset/config.json` declares `"changelog": "@changesets/cli/changelog"`
  (the default). The default formatter inlines the changeset markdown SUMMARY verbatim into each
  per-package `CHANGELOG.md` — which is exactly how `CAISSON-NN` + `ADR-NNNN` + "harvest slice"
  land in shipped tarballs.

## Findings covered

| id                                                              | severity | file / surface                                                          | disposition                                                            |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 009f844970a4fe81                                                | warn     | packages/ai-meter/manifest.ts (relative-path leak)                      | fixed-by-this-spec (sweep t3)                                          |
| 7187ceba82df7646                                                | warn     | packages/billing/src/index.ts:19-32 (LemonSqueezy/Polar "dead exports") | **reconcile-needed**                                                   |
| 8a94468dbc3385e6                                                | high     | packages/billing/README+AGENTS+package.json (drivers undocumented)      | **reconcile-needed**                                                   |
| (139 D3 opens)                                                  | mixed    | packages/* + apps/site + apps/base + services/*                         | fixed-by-this-spec (sweep t3)                                          |
| (55 D4 opens)                                                   | mixed    | packages/* (sold-source leak)                                           | fixed-by-this-spec (sweep t3)                                          |
| (33 SS-12 opens)                                                | warn     | packages/*/package.json `description`                                   | fixed-by-this-spec (sweep t4)                                          |
| (8 oss-mirror D3/D4)                                            | mixed    | oss-mirror reflection of packages/*                                     | fixed-by-this-spec (closes when source closes — re-mirror side-effect) |
| `Wave-0`/`T13`/`P6`/`Gate-2`/`fork-X` shorthand opens (theme C) | warn     | packages/*/src/**, README, AGENTS                                       | fixed-by-this-spec (sweep t3)                                          |

**Reclassified (1):** `7187ceba82df7646` (D7 "dead LemonSqueezy/Polar exports") is NOT a
prose leak — it is a code-vs-doc contradiction paired with `8a94468dbc3385e6` (D6). One says
delete the drivers as dead; the other says document them because they ship. The operator must
reconcile which is true before either is touched; this SPEC parks both. They are listed here
only to keep them OUT of the sweep's blast radius (Non-goals).

## Approach

### Task 1 — standards-gate guard `checkShippedProse` (the regression blocker)

**File (new):** `tooling/standards-gate/src/checks.ts` — add `checkShippedProse(pkgs, root)` (same
signature shape as `checkCopyPaste(root)`; return `Finding[]`). Wire into `cli.ts` alongside
`checkCopyPaste`.

**The internal-term regex** (canonical set, anchored to the rubric SS-1/SS-2/SS-3/SS-4/SS-8
rules):

```ts
const INTERNAL_TERM =
  /\b(gridwork|tessera|media-pipeline|Wardfile|prospector|gw-ms-a2|GW\s+Digital|CAISSON-\d+|Linear\s+\w|PR\s*#\d+|Wave-[0-9]|harvest\s+slice|picker\s+round|Wave-0|ponytail:)\b|\b(P[56]|T1[0-8]|Gate-[0-9]|fork-[a-z])\b/;
```

**The bare-ADR-citation rule** (SS-3 parenthetical allowance — "BYOK inference is billed at
zero credits (ADR-0182)" is fine; "see ADR-0182" alone is not). Flag a comment line ONLY when
the ADR id is the dominant content:

```ts
// matches "// see ADR-0182" or "// per ADR-0182" or a comment whose only substantive token is the id
const BARE_ADR = /^\s*(\/\/|\/\*|\*)\s*(see|per|cf\.?)\s+ADR-\d{4}\b/i;
// and the "trailing ADR id is the whole description" shape for package.json
```

**Surfaces scanned** (the rubric's `oss-source`/`sold-source`/`buyer-runtime` class — exempt
surfaces `tooling/`, `infra/`, `apps/admin`, `registry/`, `audit-harness`, `docs/`, `.github/`,
`.changeset/`, `outputs/` are NOT scanned):

- `packages/*/README.md`, `packages/*/AGENTS.md`, `packages/*/CHANGELOG.md`
- `packages/*/package.json` — the `description` field only (SS-12: a bare `ADR-NNNN` anywhere
  in `description` fails; an ADR id is allowed in `description` only as a parenthetical after
  ≥4 plain-English words, mirroring SS-3).
- `packages/*/src/**/*.{ts,tsx}` — comments only (a `// …` / `/* … */` / `* …` line). Strings
  and code are out of scope (an exported symbol named `parseWave` is fine).
- `apps/site/**`, `apps/base/**`, `services/license/**`, `services/docs/**` — same extension
  set, README + comments.

**Allowlist** (legitimate mentions, not flagged): `@caisson/*` package names; the SS rubric
file itself; the standards-gate's own fixtures + test assertions; a code-comment line that
ALSO carries ≥4 plain-English words on the same physical line as the ADR id (SS-3
parenthetical). Implement as a per-line allowlist check before pushing a `Finding`.

**Severity:** `error` (fails the gate, blocks publish). Rule id: `shipped-prose`. Message
shape: `SS-N: internal term "<match>" in <file>:<line> — shipped source must be buyer-readable`.

**Fixture + test** (lazy: one runnable check, no framework sprawl): extend
`tooling/standards-gate/src/checks.test.ts` with a `describe("checkShippedProse")` block:

- a clean fixture → `[]`.
- a fixture with each of the 5 leak classes (gridwork-ism, CAISSON-NN, Wave-N, bare-ADR-only,
  trailing-ADR-in-description) → one finding each, naming the right SS-N rule.
- the SS-3 parenthetical fixture (`// BYOK inference is zero credits (ADR-0182)`) → `[]`
  (proves the allowlist).

### Task 2 — changeset formatter (strip from released CHANGELOG, keep internal commit text)

**Fork for operator lock (do NOT pre-decide):**

- **(2a) Custom changelog formatter** — write
  `tooling/changesets/release-line.ts` exporting `getReleaseLine` (per the `@changesets/cli`
  formatter contract): takes the changeset summary, applies the same INTERNAL_TERM strip +
  bare-ADR drop that the gate does, then defers to the default `@changesets/cli/changelog`
  for formatting. Flip `.changeset/config.json` → `"changelog": ["./tooling/changesets/release-line.ts", null]`.
  Internal commit text (the changeset `.md` summary) keeps Linear ids + ADR citations for
  operator reads; only the rendered CHANGELOG line is stripped. **Recommended** — smaller
  ongoing diff than policing every author, and the strip-rule lives in ONE module shared with
  the gate.
- **(2b) Changeset-source gate** — leave the default formatter; add a standards-gate check
  that scans `.changeset/*.md` summary blocks and rejects leak terms at PR time. Forces
  author discipline instead of a formatter transform. Cheaper to write but a per-PR friction
  tax and the historical CHANGELOGs (already leaked) still need task 3.

Either resolution: the canonical INTERNAL_TERM + BARE_ADR regex lives in ONE shared module
(`tooling/standards-gate/src/prose-regex.ts`) imported by both the gate and the formatter, so
the two can never drift. Park in `docs/state/decisions-and-forks.md` for the operator to lock.

### Task 3 — one-pass prose sweep (the cleanup the gate then keeps clean)

Mechanical sweep across the enumerated high-count packages, applying the rule the gate
enforces. Per-package touch:

- **README.md** (SS-9/SS-10/SS-11): rewrite the "Seeds (rebuild-clean)" / "Build per /plan.md"
  / "Pro-private media-pipeline" blocks into a one-line buyer purpose + install/usage snippet.
  Drop the ADR-chain opening. Drop internal links into `knowledge/`/`outputs/`/`docs/state/`.
  Representative packages: `agent-dev`, `agent-kernel`, `ai-config`, `alerting`, `cli`,
  `prompt-registry`, `observability`, `local-store`, `compliance`, `agent-runner`, `credits`,
  `field-crypto`, `audit-worm`, `retention-runner`, `billing`, `auth`, `mcp-server`,
  `ai-evals`, `tenancy-rls`, `license-verify`, `migrate`, `kernel`, `ui`.
- **CHANGELOG.md** (SS-2/SS-4): historical entries that leaked Linear ids + "harvest slice" +
  ADR-only framing get a one-pass rewrite — keep the buyer-relevant fact ("added X",
  "fixed Y"), drop the `CAISSON-NN` / `ADR-NNNN` citations. If task 2 is also in flight, the
  formatter handles forward-going entries; this task catches the back catalog.
- **AGENTS.md** (SS-1/SS-3): same treatment — these are buyer-visible in the npm tarball.
- **package.json `description`** (SS-12 — see task 4).
- **inline `.ts` comments** (SS-3/SS-5): replace bare `// see ADR-0182` with the rule stated
  in plain terms (the ADR id may follow parenthetically); drop `ponytail:` markers from
  shipped packages (keep them in `tooling/`/`infra/` where they're internal).
- **manifest.ts** relative-path leaks (`009f844970a4fe81`): the `packages/ai-meter/manifest.ts`
  monorepo-relative import becomes a runtime-agnostic reference (or the manifest drops the
  import entirely if it's only used for type resolution — verify against
  `registry/scripts/ci-publish-step.ts`'s manifest loader).

Execution shape: one workflow dispatch per package cluster (kernel/credits/pricebook cluster,
ai-* cluster, edition cluster, ops cluster) — parallel writers, worktree-isolated per
`identity/doctrine.md`. Each cluster produces a NAMING changeset (`@caisson/<pkg>: patch`).

### Task 4 — package.json description sweep (SS-12, 33 opens)

Single rule, applied across all `packages/*/package.json`: drop the trailing bare
`ADR-NNNN/NNNN` citation string; rewrite the description to a plain one-line capability
statement (no ADR ids, no "internal", no session shorthand). Examples:

- `"... money path. (ADR-0060/0014/0070)"` → `"... money path."`
- `"Provider-agnostic AI config resolver ... + buyer-supplied keys. ADR-0070/0090"` →
  `"Provider-agnostic AI config resolver ... + buyer-supplied keys."`

Verify the registry `index.json` regenerates clean post-sweep (the description is the
manifest's, mirrored into the index).

## Verify (goal-backward)

- **Gate green + leak-free** (the proof):
  ```bash
  bun run tooling/standards-gate/src/cli.ts   # standards-gate, includes checkShippedProse
  ```
  Exit 0 with zero `shipped-prose` findings.
- **Grep proves no internal-term leakage** in the shipped surface:
  ```bash
  grep -rnE '\b(gridwork|tessera|media-pipeline|Wardfile|prospector|gw-ms-a2|CAISSON-[0-9]+|Wave-[0-9]|harvest slice|picker round|ponytail:)\b|\b(P[56]|T1[0-8]|Gate-[0-9]|fork-[a-z])\b' \
    packages/*/README.md packages/*/AGENTS.md packages/*/CHANGELOG.md packages/*/package.json packages/*/src
  ```
  Zero hits (allowlist-respecting).
- **Bare-ADR-only citations gone**:
  ```bash
  grep -rnE '^\s*(//|\*).*\b(see|per)\s+ADR-[0-9]{4}\b' packages/*/src
  ```
  Zero hits.
- **SS-12 trailing-ADR gone**:
  ```bash
  grep -lE '"description":.*ADR-[0-9]{4}' packages/*/package.json
  ```
  Zero files.
- **CHANGELOG forward-going entries are clean**: simulate a changeset with a `CAISSON-NN` +
  `ADR-NNNN` summary, run `bun x changeset version` (or the formatter unit test), confirm
  the rendered `CHANGELOG.md` line has neither.
- **Audit-harness D3/D4 reflection**: re-run `audit-harness` over the swept surface (or the
  oss-mirror re-snapshot) and confirm the D3+D4 packages findings drop to ≤ noise threshold
  (the operator triages residual `open → accepted`).
- **Standards-gate test green**: `bun test tooling/standards-gate/src/checks.test.ts`.

## Non-goals

- **Billing LemonSqueezy/Polar contradiction** (`7187ceba82df7646` D7 + `8a94468dbc3385e6`
  D6) — RECONCILE-NEEDED before either is touched. One finding says the drivers are dead
  exports to delete; the other says they're live-but-undocumented. The operator must lock
  which is true; this SPEC's sweep will skip `packages/billing/src/index.ts` driver exports
  AND `packages/billing/README.md` driver docs until reconciled (a `ponytail:` DEFER comment
  in the SPEC's tracking issue, not in shipped source).
- **The ~160 non-D3/D4 opens** (D5 license-tier, D6 truth-to-built outside prose, D7 dead
  code, D2 internal-endpoint strings) — separate waves; this SPEC touches only prose.
- **Re-licensing or moving files** — out of scope; the sweep edits prose, not license fields
  or package boundaries.
- **Auditing exempt surfaces** (`tooling/`, `infra/`, `apps/admin`, `registry/`,
  `audit-harness`, `docs/`, `.github/`, `.changeset/`, `outputs/`) — explicitly exempt per
  the rubric; gridwork-isms + ADR shorthand stay fine there.
- **Eradicating every ADR citation from code comments** — SS-3's parenthetical allowance
  ("… zero credits (ADR-0182)") is preserved; only BARE citations fail.

## Out-of-scope (other homes)

- D5 license/metadata mismatches → P3 metadata wave.
- D6 truth-to-built (capability gaps, not prose) → P4 capability-truth wave.
- D7 dead-code deletion (incl. the unresolved billing drivers) → P5 dead-code wave.
- D2 internal-endpoint strings in error messages → P6 error-UX wave (cites SS-14).
- The `decisions-and-forks.md` row for the changeset-formatter fork (2a vs 2b) — operator
  locks before EXECUTE.

## Effort + value

**Effort: M** (one mechanical sweep + one guard + one formatter/shared-module). **Value:
HIGH** — biggest single ROI of the audit-v2 remediation backlog (closes ~half the open ledger
and arms the gate against regression). Parallelizable across package clusters.

## Cross-cutting note

Fixing the source prose ALSO closes the parallel `oss-mirror` D3/D4 reflection findings
(8 opens) — the mirror is a snapshot of `packages/*`, so a clean source re-snapshots clean.
No separate mirror-side work; the next mirror sync (gated on `confirm=publish` per ADR-0222)
carries the fix. Note this in the SHIP REVIEW.
