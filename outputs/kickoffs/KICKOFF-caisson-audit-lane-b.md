# KICKOFF — Audit remediation Lane B: folds + namespace + copy truth

- **Worktree:** `/home/gw/lab/caisson-wt-lane-b` · **Branch:** `fix/audit-folds-namespace` (cut from main)
- **One PR, hard.** Push the branch and OPEN the PR; never merge — the reconcile session merges (ADR-0328).
- **Decisions already locked:** ADR-0398 (verify-pack), ADR-0399 (agent-usage fold), ADR-0401 §1-3 (copy truth, platform-reads, tooling/ moves) in `knowledge/decisions/`. Do not edit ADRs, `docs/adr-index.md`, or `docs/state/decisions-and-forks.md` — boards frozen.
- **Skip-and-note rule:** if an item resists (a live reference or gate the locks didn't anticipate), SKIP it and list it under "Skipped" in the PR description with the evidence. Never force.
- **Money/license seams touched here (platform-reads, verify-pack) get extra care: behavior-identical refactors only, tests must stay byte-equivalent in assertions.**

## Part 1 — agent-usage folds into agent-trajectory (ADR-0399)

1. Add a `./usage` subpath entry to `packages/agent-trajectory` (`{bun → src, types/default → dist}` conditions, matching the existing subpath pattern in the repo — see `@caisson/kernel`'s package.json exports for the house shape). It carries, moved from `packages/agent-usage/src`: `priceUsage` + the price normalization, the alias map, and the Codex-rollout JSONL parser (~193 lines, genuinely independent code). Tests move with the code.
2. The engine-neutrality rule the fold must honor (this answered the July t4-memo objection): the `.` barrel and `./browser` entry must NOT re-export anything from `./usage` — engine-specific usage adapters live behind the subpath only. agent-trajectory's `browser-safety.test.ts` walk must keep passing; extend it to pin that `./usage` stays OFF `./browser`.
3. Delete `packages/agent-usage`. It was never published (sellable:false, rider-3): no ledger/delist row exists or is needed. Regenerate whatever index artifacts the build derives (`registry/index.json` / `packages/cli/registry-index.json` mention it — run the registry index build and commit the regenerated files if the build owns them; if regeneration is train-only, note it for reconcile instead of hand-editing).
4. `bun install` to reconcile the lockfile. Changeset: minor for `@caisson/agent-trajectory` (new public subpath). Plain prose, no ADR citations in changeset text.

## Part 2 — verify-pack publish prep (ADR-0398) — PREP ONLY, no flip

- The NEXT release train performs the publish; this lane only preps. Add the changeset for `@caisson/verify-pack` (its first: describe the out-of-band evidence-pack verifier in buyer-facing prose, no ADR cites). Do NOT flip `private:true`, do NOT add publishConfig, do NOT touch the registry ledger — the train's version PR does the flip so the ledger row is real (this is the locked shape; the manifest's own header documents it).
- Check `tooling/standards-gate` treats a pending-publish verify-pack correctly (it is currently carved as never-published in spirit; if the gate hard-codes verify-pack anywhere as permanently-unpublished, adjust the carve to "publishes at next train" semantics — smallest possible change, note what you did).

## Part 3 — bundle-lede copy truth (ADR-0401 §1)

Three surfaces sell dissolved edition metas that no bundle manifest contains and the registry no longer serves. Rewrite each lede to name the REAL member packages (read the manifest, don't guess):

- `apps/site/app/(marketing)/local-first/page.tsx:228` — claims "ships @caisson/local-ai". Real members per `packages/local-first/manifest.ts`: kernel, local-store, license-verify, field-crypto, local-privacy, local-inference, local-sync.
- `apps/site/app/(marketing)/ai-kit/page.tsx:197` — claims "ships @caisson/ai-kit". Real members per `packages/ai-production/manifest.ts`: ai-config, ai-meter, credits, field-crypto, guardrails, kernel, prompt-registry, tenancy-rls, ai-evals.
- `apps/site/lib/module-pages.ts:1297` — claims composition "into @caisson/agent-dev inside the Agentic-Dev bundle". Real members per `packages/agentic-dev/manifest.ts`: agent-kernel, agent-runner, agent-trajectory, ai-config, kernel, local-store, tool-exec.

Copy laws bind: ADR-0080 voice, em-dash convention for buyer-facing prose, committed prices untouched, no roadmap/future framing (ADR-0237 full V1-live posture). Keep each edit surgical — the lede sentence(s) only. While in there: the stale "alias forever" claims inside `packages/{local-ai,ai-kit,agent-dev}` manifest comments are NOT yours to fix (Lane A deletes two of those packages; ai-kit's comment can ride a later pass).

## Part 4 — renames (ADR-0401 §4), public API unchanged

- `packages/local-store/src/egress-guard.ts` → `embed-scrub-guard.ts` (it scrubs embedder text; the current name collides with local-privacy's genuine egress guard). INTERNAL rename only: update relative imports + the package's own barrel; the public export NAMES (`scrubForEgress`, `looksLikeSecret`, etc.) must not change. If the file itself is a public subpath in package.json exports, SKIP and note.
- `packages/ai-meter/src/pricebook.ts` → `token-rates.ts` (name collision with the commerce `@caisson/pricebook`, acknowledged in both files' comments). Same rule: internal rename, exported names unchanged, update the collision-acknowledging comments to their new truth.

## Part 5 — tooling/ namespace moves (ADR-0401 §3)

Move `packages/audit-harness` → `tooling/audit-harness` and `packages/demo-registry` → `tooling/demo-registry` (`git mv` the directories; package names `@caisson/audit-harness` / `@caisson/demo-registry` UNCHANGED). Then:

- Root `package.json` workspaces: confirm `tooling/*` is a workspace glob (tooling/eslint-config etc. already are); `bun install` to re-link.
- `tooling/standards-gate/src/checks.ts` — the `NEVER_PUBLISHED` set (~line 313) and any path-based logic: the moved packages leave the sold `packages/*` namespace, so path-scoped carves that existed only to exempt them should SHRINK. Also `isProseScanTarget` starts with `relDir.startsWith("packages/")` minus audit-harness — that carve simplifies.
- Importers to re-verify (names unchanged, so imports should be untouched — verify, don't assume): `apps/site/components/ui-showcase/registry-gallery.tsx`, `apps/admin/src/app/catalog/components/page.tsx`, `packages/demo-registry` internals, `tooling/standards-gate/src/checks.ts:321`, `packages/*` that reference audit-harness.
- `turbo.json`, `knip.json`, coverage/changeset gates: grep for `packages/audit-harness|packages/demo-registry` literal paths and update.
- `packages/brand` STAYS in packages/ (live product-UI consumer in site+admin) — locked, don't touch.

## Part 6 — platform-reads becomes the canonical read-SQL home (ADR-0401 §2)

The duplication: `packages/platform-reads/src/index.ts` re-expresses `services/license`'s SQL — including the `netCharged` money expression — as raw strings, guarded only by `columns-contract.test.ts`. The locked fix is the INVERSION (fold-into-service was rejected — platform-reads is a sold catalog package):

1. platform-reads keeps/owns the shared read expressions ONCE (the `netCharged` expression and each duplicated read query fragment), exported with clear names.
2. `services/license` imports those exports from `@caisson/platform-reads` (service→sold-package runtime dep is legal; add it to services/license's package.json) and deletes its local copies where they are byte-duplicates. Where the service's version is embedded in bigger write-side SQL and extraction would change behavior, leave that site and note it — behavior-identical only.
3. `columns-contract.test.ts` (the DDL-drift guard importing the service's schema constants as a devDep) STAYS exactly as-is.
4. This is a money expression: assertions in both packages' tests must not change. If the extraction cannot keep `netCharged` byte-identical in generated SQL, STOP and skip the whole part with notes.

## Gates before opening the PR

```bash
cd /home/gw/lab/caisson-wt-lane-b
bun install
bun run check                    # must be green
bun run sot                      # advisory; never touch board/ADR files (frozen)
bunx changeset status --since=origin/main
```

**Changesets:** every changed `packages/*` needs a naming changeset (private ones too). Plain buyer-facing prose, NEVER cite ADR numbers. agent-trajectory = minor (new subpath); moved/renamed-internals packages = patch; verify-pack = its prep changeset (Part 2); platform-reads = minor if new exports, service-license is a service (no changeset).

**Commit style:** conventional commits, plain-ASCII subjects, one logical change per commit (suggested: one commit per Part). PR title `fix(scaffold): audit wave lane B — folds, namespace, copy truth (ADR-0398/0399/0401)`. PR body: per-part summary + "Skipped" list with evidence.
