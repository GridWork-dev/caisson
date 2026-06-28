# SECURITY — Wave 1 / P5: Generator + registry full drive

SHIP-act security audit of **PR #12** (`feature/p5-generator`, 19 commits) for the Caisson
monorepo. Tags firing this audit: **external-system · security · billing**.

- **Scope:** the P5 diff only (`git --no-pager diff main..feature/p5-generator`). Pre-existing
  unchanged code was not re-audited.
- **Method:** FORCE stance — every declared mitigation treated as absent until a code location
  proves it. Each threat in `outputs/specs/wave1-p5-generator/PLAN.md` §"Threats to model" plus
  the `identity/security.md` floor items named in the audit brief verified by `path:line`.
- **ASVS posture:** L2-equivalent (the gridwork-core security floor).

## Verdict: **PASS**

| Severity   | Count |
| ---------- | ----- |
| BLOCKER    | 0     |
| HIGH       | 0     |
| MEDIUM     | 0     |
| LOW / INFO | 2     |

All seven P5 threats (TM-P5-1 … TM-P5-7) and every named floor item are **MITIGATED** with a
proving code location. Two LOW/informational hardening notes are recorded; neither blocks ship.
No implementation file was modified by this audit (read-only; only this `SECURITY.md` written).

---

## Threat verification

| Threat ID | Category                  | Disposition | Status        | Evidence                                                                                  |
| --------- | ------------------------- | ----------- | ------------- | ----------------------------------------------------------------------------------------- |
| TM-P5-1   | security / path           | mitigate    | **MITIGATED** | `packages/cli/src/writer.ts:47-80,106-179`                                                |
| TM-P5-2   | security / injection      | mitigate    | **MITIGATED** | `packages/mcp-server/src/server.ts:248-257`; `packages/cli/src/generate.ts:36-46,107-114` |
| TM-P5-3   | billing                   | mitigate    | **MITIGATED** | `packages/cli/src/meter.ts:210-240`; `meter.integration.test.ts:129-175,217-235`          |
| TM-P5-4   | external-system / secrets | mitigate    | **MITIGATED** | `.github/workflows/ci.yml` publish-and-index job                                          |
| TM-P5-5   | external-system           | mitigate    | **MITIGATED** | `registry/scripts/append-ledger.ts:31-51`; `ci-publish-step.ts`                           |
| TM-P5-6   | security / supply-chain   | mitigate    | **MITIGATED** | `packages/cli/src/engine-templates.ts:1-67`; `cli.ts:99-125`                              |
| TM-P5-7   | security / entitlement    | mitigate    | **MITIGATED** | `packages/mcp-server/src/server.ts:156-212,239-292`                                       |

---

## TM-P5-1 — Path traversal / zip-slip in the disk FileSetWriter (security) — **MITIGATED**

Declared mitigation: every generated file path validated against the target root **before any
write** (resolve + `startsWith(root + sep)`), reject `..`/null-byte/absolute/symlink, atomic
temp→rename leaves no half-tree.

Evidence (`packages/cli/src/writer.ts`):

- `assertSafePath` (`:47-80`) rejects, **before any disk op**: null bytes (`:49-53`), absolute
  Unix/Windows paths (`:55-63`), any `..` segment via pre-resolve segment split (`:64-70`), and a
  post-`resolve` containment check `resolved.startsWith(resolvedTargetDir + sep)` (`:71-78`) — the
  `+ sep` closes the `<target>-escape` sibling-prefix bypass.
- All paths validated **up front** for the whole set (`:117-120`) — one bad path aborts the entire
  write before the filesystem is touched (fail-closed).
- Non-empty target refused unless `overwrite: true` (`:122-134`), default `false`.
- Atomicity: files written to a sibling `mkdtemp` buffer (`:136-149`) then `rename(2)` into place
  (`:163-171`); the cwd case moves files individually since you cannot rename the running dir
  (`:152-162`); on any error the temp dir is purged and the target is left untouched —
  **no half-tree** (`:172-179`).

Containment also re-asserted at the seam (`packages/cli/src/seam.ts:39`: file paths are "always a
fixed literal … never built from input") and the buyer project dir is a validated lowercase slug
(`seam.ts:19-25`; MCP `server.ts:131-135`), so no attacker-controlled segment reaches the writer.

> **LOW / INFO (hardening, non-blocking):** the symlink-escape sub-claim is closed _structurally_
> (fresh `mkdtemp` tree built from scratch, empty-target default, and file paths being fixed
> template literals) rather than by an explicit `lstat` O_NOFOLLOW check. In `overwrite: true`
> mode a pre-existing symlinked subdir inside the target would be followed by `writeFile` because
> `resolve()` operates on the logical path, not the realpath. Not exploitable today — `overwrite`
> is never reached on the remote MCP path (default writer, fresh slug target) and no path segment
> is caller-controlled. Suggested future hardening: `lstat` each materialized directory component,
> or write with `O_NOFOLLOW`, before the `overwrite` swap.

## TM-P5-2 — Unknown module id/version reaching a path/subprocess (security) — **MITIGATED**

Declared mitigation: the MCP `generate` path validates id+version against the **built index BEFORE**
any entitlement check / host call / path use, the raw allowlist-miss `Error` is wrapped (no attacker
text into a thrown message reaching a shell/path), and the CLI `generate` likewise gates before the
writer/git-init.

Evidence — MCP (`packages/mcp-server/src/server.ts`):

- In the `generate` handler, every `{id, version}` is checked via `assertKnownModule` +
  `assertKnownVersion` (`:248-257`) **first** — before entitlement expansion (`:263-276`), key mint
  (`:279`), and the `onGenerate` host call (`:282-290`).
- The raw assert `Error` (which embeds `JSON.stringify(id)` — `registry/schema/registry-index.ts:82-108`)
  is **caught and discarded**; only a generic `ValidationError("Unknown registry module or version")`
  is thrown, with the attacker string confined to a structured 400 detail field, never interpolated
  into a shell or path (`server.ts:252-256`). Input shape is `strictObject` (`:128-146`), so unknown
  fields are rejected at the boundary.

Evidence — CLI (`packages/cli/src/generate.ts`):

- `validateSelection` (`:36-46`) runs `Selection.parse` (Zod `.strict()`) then
  `assertKnownModule`/`assertKnownVersion` for every module; `generate` (`:107-114`) runs validation
  **before** `engine.materialize` is ever invoked. In `cli.ts` the gate (`runCli` → `generate`,
  `:55-60,176`) precedes the writer (`:191-192`) and `tryGitInit` (`:193`). The CLI's raw error
  surfaces only to its own stderr (`cli.ts:195-198`) — not a shell/path sink.

`assertKnownVersion` enforces the version is in the module's published set (`registry-index.ts:99-109`),
closing the raw-version-to-path surface called out in ADR-0021.

## TM-P5-3 — Generate-without-paying / runaway loop (billing) — **MITIGATED**

Declared mitigation: debit-before-spend — `meterGeneration`/`debit` strictly precedes any file
write in `runGeneration`; a 402 aborts the whole `withTenant` txn (nothing written, nothing
recorded); a same-`idempotencyKey` retry debits once.

Evidence (`packages/cli/src/meter.ts:210-240`):

- Order is explicit: `composeGeneratedFileSet` (read-only, in-memory — `:217`) → `meterGeneration`
  (`:218`, comment "debit-before-spend; 402 throws here") → writer (`:221-226`) → `recordGeneration`
  (`:227-232`). A 402 (`InsufficientCreditsError`) thrown at `:218` means steps 3–4 are never
  reached: **nothing written, nothing recorded.** Edition-pin and migration resolution fail closed
  _before_ the debit (`:101-127,154-180,188-197`), so a non-resolvable selection is never charged.
- Idempotency: `recordGeneration` is `INSERT … ON CONFLICT (account_id, idempotency_key) DO NOTHING`
  (`generation-record.ts:91-103`); the credit `debit` dedups on the same key (`meter.ts:36-46`), so
  a true retry debits once and records one row.
- The host wires the whole flow inside `withTenant` (`apps/base/src/generate.integration.test.ts`),
  so a thrown 402 (or a post-debit writer failure — the writer is atomic) rolls the txn back.

Test evidence (`packages/cli/src/meter.integration.test.ts`, PGlite + `withTenant`): "a short
balance returns 402 and writes NOTHING" → `spy.calls === 0` (`:129-144`); "a 402 leaves NOTHING on
disk AND records no generation row" (`:217-227`); "a retried generation with the same
idempotencyKey debits once" (`:153-175`); "an unknown module id throws before any debit or write"
(`:178-193`).

## TM-P5-4 — Publish credential leak / laptop publish (external-system/secrets) — **MITIGATED**

Declared mitigation: only the ephemeral workflow `GITHUB_TOKEN` publishes; no PAT/`NODE_AUTH_TOKEN`;
publish CI-only; commit-back writes only ledger+index.

Evidence (`.github/workflows/ci.yml` — `publish-and-index` job):

- Auth is the built-in `${{ secrets.GITHUB_TOKEN }}` written to `~/.npmrc` at runtime; the job
  comment and step name assert **no stored PAT / no `NODE_AUTH_TOKEN`** repository secret (ADR-0069).
- `needs: [check, standards-gate, registry-index]` and `if: github.ref == 'refs/heads/main'` — a
  green golden/standards gate precedes publish; runs main-only.
- `CAISSON_PUBLISH_DRY_RUN: "true"` default — `changeset version`/`publish` are skipped unless the
  operator explicitly sets `"false"` (no live publish in CI by default).
- Commit-back stages **only** `registry/ledger.jsonl` + `registry/index.json`
  (`git add registry/ledger.jsonl registry/index.json`) — no other path is written back.

A diff scan of every `+` line for `execSync`/`fetch`/`localhost`/`127.0.0.1`/hardcoded
secret/`api_key`/`password` returned **zero** hits outside the audited `GITHUB_TOKEN` usage — no
hardcoded secret and no prod loopback fallback entered the diff.

## TM-P5-5 — Ungated / tampered registry index (external-system) — **MITIGATED**

Declared mitigation: CI-only append validates the manifest schema; byte-identical rebuild detects
tamper; `publishedAt` from CI clock; provenance recorded.

Evidence:

- `appendLedger` (`registry/scripts/append-ledger.ts:31-51`) re-validates the manifest
  (`ModuleManifest.parse`, `:36`) and the assembled `LedgerEntry` (`:39-45`) **before** the append
  (`:48`) — fail-closed; a malformed manifest throws before the file is touched.
- `publishedAt` is supplied by the caller (CI clock via `--published-at`), **never** `Date.now()`
  inside the builder (`:32,48`; `ci-publish-step.ts:28-29,109-111`); `gateAttestation =
"<run-id>@<commit-sha>"` records provenance (`ci-publish-step.ts:169`).
- The index is rebuilt from the ledger (`buildIndexFromLedgerFile`, `ci-publish-step.ts:178-179`);
  the PLAN exit gate asserts the committed `index.json` is byte-identical to a fresh rebuild
  (PLAN T23) — any drift is a detectable tamper signal.
- `module-manifest.ts` adds the edition `members` exact-semver pin map with `kind === "edition" ⟹
non-empty members` refinement (`:64-70 schema, refine`), and the `semver` regex rejects
  `latest`/ranges — pins cannot smuggle a floating version into the resolver.

## TM-P5-6 — Network / supply-chain during generation (security) — **MITIGATED**

Declared mitigation: in-repo templates (no network); post-gen install/git opt-in; subprocess
`execFile` arg-arrays only.

Evidence:

- `engine-templates.ts` reads the in-repo `templates/` tree resolved from `import.meta.url`
  (`:22-27,49-67`) — "NO network … never writes, fetches, or spawns" (`:1-5`). The template root is
  a fixed in-repo path, never caller input (`:48`).
- Post-gen `git init` uses `execFile` with an **argument array** `["init", dir]`
  (`cli.ts:99-125`) — the helper comment binds it to "no shell-string interpolation … never called
  with template-literal or concatenated input"; it is fail-soft (`:119-125`).
- No outbound `fetch` exists anywhere in the diff (grep clean), so the `fetchWithTimeout` floor item
  is **N/A by absence** — confirmed.

## TM-P5-7 — MCP returns data the caller isn't entitled to (security) — **MITIGATED**

Declared mitigation: per-tool entitlement gating (resolver-expanded), timing-safe Bearer,
fail-closed.

Evidence (`packages/mcp-server/src/server.ts`):

- Bearer auth is timing-safe: `authenticate` compares every issued token with `safeEqualFixed`
  (constant-time, no early return — `:177-188`); `safeEqualFixed` uses `crypto.timingSafeEqual`
  (`packages/kernel/src/crypto.ts:11-15`). Intact, unchanged by P5.
- Per-tool gate: `isEntitled` (`:156-163`) scans all owned entitlements with **no early return**,
  comparing slugs with `safeEqualVariable` (hash-then-`timingSafeEqual`, `crypto.ts:23-27`); a base
  tool (`requiredEntitlement === null`) is universally visible. `handleToolCall` returns the same
  `NotFoundError` for an unregistered tool **and** an unentitled tool (`:202-210`) — an edition tool
  is invisible, never leaking its existence. `listTools` filters by entitlement (`:190-195`).
- `generate` per-module ownership uses `expandEntitlements` (editions/bundle → member slugs) then
  rejects any unowned id, **fail-closed, before the host call** (`:263-276`).

> **Floor confirmation (set-membership compare):** the NEW module-ownership check at `:266-269`
> uses plain `Set.has` membership, not `timingSafeEqual`. This is **correct**: module/edition slugs
> are PUBLIC catalog identifiers, not secrets, so there is no timing side-channel to close — the
> reasoning is documented at `registry/schema/entitlements.ts` (the "Security (threat TM-E)" block)
> and the timing-safe compare correctly lives at the per-tool Bearer/entitlement gate. The reasoning
> holds.

---

## Security-floor checks (identity/security.md)

| Floor item                                                                                                                               | Status         | Evidence                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell/exec — `git init` via `execFile` arg-array, no shell-string interpolation anywhere in the diff                                     | **PASS**       | `cli.ts:99-125` (`execFile("git", ["init", dir])`); diff-wide grep for `execSync`/`exec(`/`spawn` clean                                                                                                                                                                                                                                                       |
| Secret/token compares use `crypto.timingSafeEqual`                                                                                       | **PASS**       | MCP Bearer `safeEqualFixed` (`server.ts:181`), per-tool gate `safeEqualVariable` (`server.ts:160`), both → `crypto.timingSafeEqual` (`kernel/src/crypto.ts:11-27`); new module-ownership check correctly plain membership on PUBLIC ids                                                                                                                       |
| Zod `.strict()` at every boundary (MCP args, writer options, CLI parse)                                                                  | **PASS**       | MCP `strictObject` (`server.ts:127-146`); `WriterOptionsSchema.strict()` (`writer.ts:27-34`); CLI `Selection.strict()` + `ModuleSelection.strict()` (`seam.ts:11-35`); `strictObject = z.object().strict()` (`kernel/src/schema.ts:7-11`)                                                                                                                     |
| RLS fail-closed — generation INSERT + ON-CONFLICT retry SELECT tenant-scoped; append-only                                                | **PASS**       | `recordGeneration` INSERT + SELECT both bound to `account_id` (`generation-record.ts:91-115`); RLS `USING`+`WITH CHECK (account_id = current_setting(GUC))` with `FORCE ROW LEVEL SECURITY` (`tenancy-rls/src/rls.ts:61-73`); absent-row-after-ON-CONFLICT **throws** (`:117-123`); no UPDATE/DELETE/DROP in the module (grep clean) → append-only (ADR-0006) |
| `fetchWithTimeout` on any outbound fetch                                                                                                 | **PASS (N/A)** | No `fetch` in the diff (grep clean) — none required                                                                                                                                                                                                                                                                                                           |
| No hardcoded secrets; no localhost/127.0.0.1 prod fallback; CI uses only ephemeral `GITHUB_TOKEN` with `CAISSON_PUBLISH_DRY_RUN` default | **PASS**       | Diff-wide grep clean; `ci.yml` `publish-and-index` (TM-P5-4 above)                                                                                                                                                                                                                                                                                            |

> **LOW / INFO (non-blocking):** in the `create-caisson` bin, `--out <dir>` is unvalidated and
> passed both to the writer (`targetDir`) and to `execFile("git", ["init", dir])`. There is no
> privilege boundary — the bin runs on the buyer's own machine against their own chosen path, and
> `execFile` arg-array semantics prevent shell injection. A `--out` value beginning with `-` could
> be interpreted by `git init` as a flag rather than a path (e.g. `--bare`); harmless on the
> buyer's own machine. **ADDRESSED** (`cli.ts:tryGitInit`): the dir is `resolve()`d to an absolute
> path before `git init`, so a leading-`-` value can never be read as a flag (and it matches the dir
> the writer materialized into). INFO-1 (writer symlink-escape) remains structurally closed only —
> no behavior change required.

---

## Unregistered flags

`SUMMARY.md` contains **no `## Threat Flags` section** (the executor declared none). No new attack
surface was flagged during implementation that maps to an unregistered threat. The diff scan for
new sinks (outbound network, shell exec, loopback binds, stored credentials) found none beyond the
audited, documented `GITHUB_TOKEN` CI usage — consistent with the ADR-0068 "in-repo templates, no
network" boundary. Nothing to reconcile.

---

## Closing

All seven P5 threats resolve to **MITIGATED** with a proving `path:line`, and every named floor item
**PASSES**. Two LOW/informational hardening notes (writer symlink `lstat`, bin `--out` validation)
are recorded as optional future work — neither is reachable by a remote attacker on the audited
paths and neither blocks ship.

**Overall verdict: PASS — clear to ship.**
