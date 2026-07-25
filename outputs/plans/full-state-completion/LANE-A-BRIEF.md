# Lane A goal prompt — code residuals and the provider adapter wave

You are executing lane A of the ADR-0380 completion wave in an isolated worktree at
`/home/gw/lab/caisson-lane-a` on branch `feature/completion-lane-a`.

## Read first (absolute paths)

- `/home/gw/lab/caisson/CLAUDE.md` — repo working rules and engineering invariants
- `/home/gw/lab/caisson/outputs/plans/full-state-completion/LANE-A-PLAN.md` — your task list
- `/home/gw/lab/caisson/outputs/specs/full-state-completion/SPEC.md` — the program goal
- `/home/gw/lab/caisson/knowledge/decisions/ADR-0380-completion-fork-locks-and-module-depth-slice.md` — the locks you implement
- `/home/gw/lab/caisson/knowledge/decisions/ADR-0379-full-state-completion-program-locks.md` — the program locks

## Goal

Ship A1–A7 from LANE-A-PLAN.md: the internal proof proxy, the admin proof viewer and export, the
tenant self-service proof route, the buyer crosswalk, the Inngest v4 jobs adapter, the widened KMS
deletion receipt plus the Azure Key Vault adapter, and the artifact version identity plus the Azure
Blob WORM adapter.

Run two parallel sub-lanes: **A-app** (`apps/`, tasks A1 → A2 · A3 · A4) and **A-pkg**
(`packages/`, tasks A5 · A6 · A7). A1 lands before A3 and A4 start.

## Method

TDD per task: smallest failing test first, keep the failure evidence, implement the minimum
compatible behavior, re-run targeted tests, then the package build and lint. One logical change per
commit, conventional commit scopes from CLAUDE.md.

## Hard constraints

- TypeScript strict, Bun only. Zod `.strict()` at every boundary. No `any`, no `console.log`.
- `fetchWithTimeout` on every outbound fetch; `crypto.timingSafeEqual` for every secret compare.
- No object-store or KMS credential may enter `apps/site`. The proof proxy owns it.
- A pending, cancellable, or recoverable key deletion must never be reported as irreversible.
- Do not touch `apps/site/lib/module-pages.ts`, `apps/site/lib/marks.ts`,
  `apps/site/lib/media-manifest.ts`, `apps/site/components/poke/**`, or `packages/ui/**` — lane B
  owns those files in a concurrent worktree.
- No deploy, migration, restart, tag, publish, secret write, or commerce change. Those are held
  operator gates.
- Changeset for every touched package. The KMS port widening is breaking — say so in the changeset.
- The three provider SDKs need a network install. `bunfig.toml` enforces a 7-day
  `minimumReleaseAge`; a package newer than that needs an explicit exclude entry. Surface the
  install command in the pane and get it approved rather than working around the gate.

## Done means

`bun run check`, `bun run format:check`, and `bun run sot` are green in the worktree, every task has
its evidence, and one PR is **pushed, not merged**. Report the PR URL and anything you could not
finish with the reason.
