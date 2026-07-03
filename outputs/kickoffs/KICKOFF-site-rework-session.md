# Kickoff prompt — site presentation rework session (paste into the new Claude session)

Launch from `/home/gw/lab/caisson/.claude/worktrees/site-rework` (see the account-isolation steps
in the session that created this file). Paste everything below the line as the first message.

---

ultracode

You are the dedicated SITE REWORK session for caisson. Your mission: close out glossary batch-1,
then execute the FULL site presentation rework (ADR-0237, all three waves) to merged PRs.

## Session boundaries (BINDING)

- You work ONLY in this worktree: `/home/gw/lab/caisson/.claude/worktrees/site-rework`
  (branch `feat/site-rework`). NEVER touch the main checkout `/home/gw/lab/caisson` or the other
  worktrees (`audit-v2`, `glossary-b1`) — another live session owns them.
- The other session owns: whole-repo audit v2 closeout, registry/deploy ops, everything non-site.
  You own: glossary batch-1 closeout + the entire ADR-0237 rework. Do not start work outside that.
- Sub-branches for your PRs: cut them from THIS worktree (`git checkout -b <branch>` here), push,
  PR, merge, then `git fetch && git merge origin/main` back into your worktree. Parallel writer
  agents inside a workflow need their own worktree isolation.

## Read first (decision surface — do not re-litigate)

1. `knowledge/decisions/ADR-0237-site-presentation-rework-locks.md` — the 8 locks + 2 riders.
2. `outputs/specs/site-presentation-rework/SPEC-site-presentation-rework.md` — workstreams,
   pre-authorized clear items, verification.
3. `knowledge/decisions/ADR-0235-glossary-program-fork-locks.md` +
   `outputs/specs/glossary-program/SPEC-glossary-program.md` — the glossary you are closing out.
4. `CLAUDE.md` (repo root — engineering invariants, commit rules, PR gate, Linear boundary;
   ADR ceiling 0237) and `docs/state/decisions-and-forks.md` (fifth-round sections).

## Step 1 — glossary batch-1 closeout

A background workflow (run by the other session) is finishing branch `feat/glossary-batch-1`:
the section-union renderer + `/glossary` hub + 12 adversarially-verified term pages, committed in
its own worktree. The other session pushes the branch to origin when it completes.

- `git fetch origin` and look for `origin/feat/glossary-batch-1` with subject
  "glossary program batch 1". If it is not there yet, start Step 2's design research (read-only)
  and poll.
- When present: open the PR `feat/glossary-batch-1 → main`, watch checks, root-cause any red
  (never rerun blindly), merge. It is a site+docs diff — the changeset-presence gate needs an
  empty changeset (`---` / `---` two-line file in `.changeset/`); the build should already
  include one.
- Then `git fetch && git merge origin/main` into `feat/site-rework`. The renderer
  (`apps/site/lib/page-sections.ts` + `components/page-sections.tsx`) is now your chassis.

## Step 2 — the rework, three waves, one PR per wave (or finer)

**Wave 1 — structure:** unified `/marketplace` hub (tabs Editions · Modules · Build · Plans;
`/pricing`, `/modules`, `/build` become permanent 301s in — preserve SEO equity: sitemap,
canonicals, internal links updated same change). Nav rebuild: logo left → CENTERED link row →
right utility cluster (search · cart · Get started · theme); THREE card-panel dropdowns
(Editions / Marketplace / Resources: Docs · Glossary · Changelog · Security) generalizing the
ADR-0190 panel. Footer: derive all columns from `lib/routes.ts` (add a footer flag), fix the
security.txt mislabel ("Security disclosure"), add /security, Marketplace, Glossary. F5 renames:
the module↔edition id collisions (`compliance`, `ai-kit` at minimum) renamed PROPERLY through
catalog ids, entitlement slugs, registry/manifests (ADR-0216 retirement ledger), members maps,
and Paddle SANDBOX product names — propose the replacement names in the PR body (operator merge
= sign-off); renamed packages need real changesets; type chips (Module/Edition/Plan) on every
price surface. This wave touches billing/credits/license paths → the greptile-gate will demand a
review; resolve every inline P0/P1 before merge.

**Wave 2 — presentation:** depth routes for all 15 modules on the renderer (+ one new `media`
section kind; placeholder brand art now — deterministic per-item generated tiles, real media is a
LATER phase, do not build it); edition pages gain the media slot + card grammar; Plans-tab depth
sections. Bespoke in-brand icon set (~21 marks) via the designer lane. FULL marketing-surface
copy rewrite through the house pipeline: sonnet drafts grounded in real code → adversarial
honesty/copy-law skeptics (opus on compliance-adjacent claims) → revise → gate. Design research
front-half: refero MCP patterns → gw-frontend-designer + impeccable. RIDERS ARE BINDING: (1) the
ADR-0078/0189 brand system is tweakable — land tweaks as explicit design-system diffs, contrast +
a11y gates still green; (2) FULL V1-live posture — grep the whole surface for "roadmap",
"coming soon", "planned", "will ship", "fast-follow": zero hits ship; Agentic-Dev reads as live
as Compliance; true-to-built stays the floor (never fabricate an artifact).

**Wave 3 — wiring:** analytics per F8 — Plausible custom events on marketing (`view_item`,
`add_to_cart`, `view_cart`, `begin_checkout`, nav/search engagement; cookieless, env-gated
no-op), PostHog `purchase` + revenue captured SERVER-SIDE in the Paddle webhook path (project
caisson-prod, id 493539), PostHog JS stays dashboard-only. SEO coherence pass: Product/Offer
JSON-LD on every card + depth page, breadcrumbs, llms.txt/llms-full regenerated for the full
route surface, metadata sweep (answer-first descriptions, no duplicate titles), curated glossary
cross-links (no auto-linking). General sweep: stale comments (module-catalog "// 14" → 15),
dead-copy grep, Lighthouse a11y/perf per template, contrast gate, `next build` bundle-leak check.

## House rules that will bite you if skipped

- Bun only, TS strict, no any, no console.log; Zod .strict() at boundaries;
  `crypto.timingSafeEqual` for secrets; integer money.
- Commit subjects: conventional, NO backticks / + / @ / em-dashes / second parens; body via
  multiple -m; prettier pre-commit rewrites files — re-add and retry once.
- App-only diffs still need an EMPTY changeset; renamed/changed `packages/*` need REAL changesets.
- Merge protocol: watch checks inline; `gh pr update-branch` creates a remote commit — always
  `git fetch && git merge origin/<branch>` before pushing again (a rejected push hides behind
  `| tail`). Squash-merge, delete branch.
- Subagent/workflow model routing: NEVER default an agent to the session model — sonnet for
  bounded builds/drafts, haiku recon, opus for reviews/judges; fable never for fan-out.
- Paddle is SANDBOX — product renames go through the sandbox API with creds from
  `~/.gridwork/caisson.env` (source-chained from `~/.gridwork/env`); if a rename needs a
  dashboard action you cannot perform, flag it as an operator gate in the PR body, do not stall.
- Pricing NUMBERS are locked (ADR-0227) — never change an amount.
- Linear owns WORK: optionally file CAISSON issues (project "Site & Buyer Dashboard") per wave;
  decisions stay in git. Never lock a fork in Linear.
- New forks you discover → `docs/state/decisions-and-forks.md` + AskUserQuestion; never
  auto-decide an operator fork. Everything already locked in ADR-0237 is NOT a fork.

Work autonomously end to end: research → build → adversarial review → gates → PR → watch →
merge, wave by wave. Report each wave's outcome as it merges.
