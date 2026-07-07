# Kickoff — git hygiene + package-set standards (Session B)

**Authored:** 2026-07-06 (state-sweep session; the parallel sibling is the site-design/admin-fix
session running in the MAIN checkout on its own branch). **Builds:** THIS session, in this
worktree. **Branch:** `chore/hygiene-package-standards` off `main` @ `bc764947`
(worktree `~/lab/caisson-hygiene`). **Session model routing:** mechanical sweeps + doc updates →
**haiku/sonnet**; bounded package fixes → **sonnet**; synthesis + review → **opus** main thread;
money-seam stretch items → **fable audit at SHIP** (this repo's license/credit seams).

## Grounding (verified 2026-07-06 by the state sweep — don't re-derive)

`main` is clean: sot green (7/7), `bun run check` green (176/176), zero registry↔local version
drift, no stray branches/worktrees besides this one, no open PRs. First action in this worktree:
`bun install` (fresh worktree has no `node_modules`; stale/empty installs produced phantom
`Cannot find module '@caisson/kernel'` test failures in the sweep sandbox).

## Out of scope — owned by the parallel site session (DO NOT TOUCH)

- `apps/site/**` and `content/docs/**` (all site copy, docs MDX, nav, glossary surfaces) — the
  sibling session owns these trees. Its `apps/site/package.json` license field too.
- `apps/admin/**` — the sibling session owns the admin 502 fix (pg pool guards + redeploy).
- `packages/email/**` and `services/license/src/deploy.ts` + any email/lifecycle wiring in
  `services/license` — the sibling session owns the email surface build (receipt, license
  delivery, credit-expiry emailer wiring). T5/T6 items may touch OTHER license-service
  files (plans, apply-billing-event, clawback, entitlement-store) but never `deploy.ts` or
  email paths.
- `git stash@{0}` (2026-07-04 email+auth WIP) — CLAIMED by the site session; leave it alone.
- Internal `EditionCard`/`EDITION_ROUTES`/`cs-editions` renames — deferred entirely this round
  (cross-tree; would collide with the site session through `packages/ui`). Exception: the
  `@caisson/ui` exports fix below is allowed — it touches `packages/ui/package.json` + tsconfig
  only, no component files.
- No DEPLOY acts: no Worker redeploy, no Railway ops, no npm publish. Stage + document; the
  operator gates every deploy (doctrine).

## Task list (ordered)

### T1 — git hygiene closeout (haiku-mechanical)

1. Delete the dangling tag `backup/pre-sync-91a2a5f` (2026-06-27, not an ancestor of `main`,
   its sync is 9 days and ~10 merges stale): `git tag -d backup/pre-sync-91a2a5f` and if it
   exists on the remote, `git push origin :refs/tags/backup/pre-sync-91a2a5f`.
2. Confirm nothing else: no other tags, stashes beyond stash@{0} (claimed elsewhere), or refs.

### T2 — package standards pass (sonnet, bounded)

1. **`@caisson/ui` exports defect (the one real bug):** exports point at raw `./src/*.ts` with
   no `types` condition and `noEmit: true` — non-Bun consumers get zero declarations. Bring it
   to the repo convention every other library package uses:
   `{"bun": "./src/index.ts", "types": "./dist/index.d.ts", "default": "./dist/index.js"}` with
   a real `dist` build (mirror a sibling package's `build` script + tsconfig emit settings).
   Verify with the full turbo build + a node16-resolution typecheck of a scratch consumer.
2. **READMEs (5):** `local-inference`, `local-privacy`, `local-sync`, `license-issue`, `brand`.
   Short and real — what it is, install, one usage block, license line. Match sibling README tone.
3. **`license` fields:** add to `apps/{ai-kit,compliance,agent-dev,base}/package.json`
   - root `package.json` (all private/unpublished — use the same value convention the other
     private packages carry, e.g. `LicenseRef-Caisson-Commercial`; check a private sibling first).
     NOT `apps/site`/`apps/admin` — the sibling session owns those trees and adds theirs.
4. **pg pool idle-error guard in `packages/tenancy-rls/src/supabase.ts:110`:** `new Pool(...)`
   has no `.on("error")` listener — an idle pooled connection dying rethrows as an uncaught
   exception and kills the host process (this exact bug took down `caisson-admin`; the sibling
   session is fixing the `apps/admin` + `apps/site` call sites). Add
   `pool.on("error", ...)` logging guard right after construction, same shape the sibling uses.
5. NOTE (operator, not this session): `apps/studio/` on the MAIN checkout is gitignored disk
   cruft (empty `.next`/`.turbo`/`node_modules`, nothing tracked) — operator runs
   `rm -rf ~/lab/caisson/apps/studio` at leisure. Do not cross checkouts to do it from here.

### T3 — catalog/registry correctness (sonnet; fail-closed discipline)

1. **CAISSON-24 — compliance republish prep:** in-tree `@caisson/compliance` manifest still says
   `kind:"edition"` + `priceCents: 79900` vs the locked six-bundle truth (`kind:"bundle"`,
   104900, ADR-0257/0258). Flip the manifest, append the ledger entry (append-only — never edit
   prior entries; UUID-ledger-order gotcha applies), rebuild `registry/index.json`, and STAGE the
   Worker redeploy (document the exact command; operator executes). Update the Linear issue.
2. **Legacy placeholder prices:** `ai-kit` ($499) and `agent-dev` ($49) manifests carry explicit
   unpriced placeholders. True them to the alias-target bundle prices or mark them per whatever
   convention `local-ai` used when it was correctly trued — read `local-ai`'s manifest first and
   match it. These are retired-alias packages: behavior must not change, ids alias forever.
3. **Catalog view reconcile:** `audit-harness` + `brand` are flagged in
   `docs/state/package-catalog.md` as "not yet reconciled into this catalog view" — add their
   sold-as/never-sold rows.
4. **Changeset release cut (decision + prep):** 7 well-formed changesets are pending
   (audit-worm, cli, registry-schema, tenancy-rls, pricebook, agent-kernel+agent-dev,
   field-crypto+ai-config+ai-kit). Consume them in one version cut so the CAISSON-24 index
   rebuild publishes current versions in the same wave. Follow the PR#46 consume mechanics
   (memory: consume-mechanics + release-PR-gate gotchas; changeset-prose CI gotcha). If anything
   about the cut looks fork-shaped (major bumps, unexpected graph ripple), STOP and surface it —
   never auto-decide a fork.

### T4 — doc/spec hygiene (haiku/sonnet sweeps)

1. **`docs/state/public-surface.md`** is still edition-era (updated 07-05, one day before the
   PR#130 rework): rewrite its §2 to six-bundle truth, matching the treatment its sibling
   `docs/state/package-catalog.md` already got (including the "historical `kind:"edition"`
   manifests stay valid forever" nuance), or forward-point to it.
2. **Stale spec headers:** executed specs still reading "DRAFT — awaiting lock" (the four
   `outputs/specs/lift-phase/` specs, `harvest-slice2` headers) — flip to EXECUTED with the
   PR/ADR cite. Do NOT renumber or edit ADRs themselves (append-only).
3. **`outputs/specs/deferred-respec/SPEC-members-fold-republish.md`** — stale never-locked draft;
   ADR-0228 (executed) subsumed it. Add a superseded banner pointing at ADR-0228; don't delete.
4. **ADR-0119 numbering note:** the board's interim "ADR-0119" vs `adapter-expansion.md`'s
   proposed 0119–0128 range were never reconciled. Housekeeping only: add a one-line
   clarification where the collision lives (no renumbering, ceiling stays 0268).
5. Regenerate/update `docs/state/outstanding-work.md` rows this session closes.

### T5 — Developer-plan entitlement grant (OPERATOR-LOCKED 2026-07-06 — direction only)

The operator locked the FORK "the Developer plan should actually grant updates, not have its
copy walked back" (the Plans page advertises "framework and module updates as they ship" +
"new-edition access on release" while `packages/pricebook/src/plans.ts:82-87` ships
`entitlements: []` — credits only). Direction is locked; the exact grant SHAPE is not:

1. Draft the ADR first. Recommended shape (label as recommendation, confidence medium-high):
   while the subscription is active, the plan extends/overrides the per-entitlement
   updates-window gate on entitlements the buyer ALREADY OWNS (the ADR-0255 mechanism —
   subscription-sourced access, own `expiry` claim governs), NOT a perpetual grant of new
   bundles. "New-edition access" needs its own definition — likely registry read access to
   new bundle releases while active, never a perpetual entitlement. Mirror how the
   Compliance-Updates plan already re-grants `compliance` as `source_kind:'subscription'` in
   `services/license/src/apply-billing-event.ts:100-123`.
2. If any part of the shape feels fork-shaped beyond this recommendation, STOP and surface it
   (picker) — never auto-decide. Otherwise implement: `plans.ts` grant rows +
   `apply-billing-event` handling + tests. Money seam → fable audit at SHIP mandatory.
3. The SITE copy fix is NOT yours (sibling owns apps/site) — but record in the PR body that
   the Plans-page copy becomes true once this merges, so the sibling can align wording.
   Also, small rider while in `packages/cli`: its README's stated canonical command
   (`npx create-caisson ...`) is wrong — the locked install command (operator picker 2026-07-06)
   is `bunx @caisson-sh/cli@latest` (npx variant ok as secondary). Fix the README; the site copy
   sweep is the sibling's.

### T5c — CLI six-bundle vocabulary migration (`packages/cli`) — added 2026-07-06 post-launch

`packages/cli/src/cli.ts` still offers ONLY the four legacy editions
(`--edition compliance|ai-kit|local-ai|agent-dev`) — the generator lags the ADR-0257/0258
six-bundle catalog. Migrate the interactive prompt + flags to the six bundles
(compliance · ai-production · local-first · agentic-dev · provenance · everything) while
keeping the legacy edition ids working forever as aliases (ADR-0257 single-alias-point rule —
reuse the existing alias map, don't hand-roll a second one). Update the CLI's own docs/help
text; `content/docs/cli/create-caisson.mdx` + `content/docs/base/mcp-server.mdx` are the
sibling's trees — record in the PR body that those docs can flip to bundle vocabulary once
this merges (they currently document the legacy behavior accurately).

### T6 — STRETCH (only if T1–T5 land early; each needs the full audit lane)

- **CAISSON-20:** clawback read-then-claw race — purchase-remainder read at READ COMMITTED
  before the wallet row lock; two concurrent clawbacks can over-claw. Money seam → fable audit.
- **entitledSince gate wiring (SHIP-audit F3):** the signed snapshot is consumed by no live
  caller; wire `bundleMembershipTimeline` from `@caisson/pricebook` into `expandEntitlements`
  at the Worker/license gates. Remember the PR#130 lesson: tokens sign PURCHASED ids, never the
  expansion.
- **CAISSON-21** (low): extract the platform migration chain into a shared package for a real
  admin PGlite parity gate.

## Gates + SHIP

Every commit conventional + atomic (scopes: `ui` `state` `specs` `adr` + per-package). Before
PR: `bun run check` green, `bun run sot` green, standards-gate 0 violations, changeset preflight
consistent with the T3.4 cut. Review = in-session SHIP audit lane (Greptile is retired):
`gw-code-reviewer` (opus) on the full diff; `gw-security-auditor` (fable) IF any T5 money-seam
item shipped. One PR to `main`; merge on green CI (`check` · `standards-gate` · `registry-index`
· `oscal-conformance`). Then update Linear (CAISSON-24 → Done or In Review; 20/21 if touched)
and append the session's rows to `docs/state/outstanding-work.md` bucket 4.

## Boundaries (binding)

Never auto-decide a fork. Linear owns WORK, git owns DECISIONS. ADRs append-only. No deploys.
Do not touch the site session's trees. Set `model` explicitly on every dispatch — never default
a subagent to the session model.
