# Kickoff prompt — site/dashboard/design drive session (paste into the new Claude session)

Launch from `/home/gw/lab/caisson/.claude/worktrees/site-design` (branch `feat/site-design-2`,
cut from clean main at the P1 remediation tip). Operator-driven: no spec governs this session —
Liam drives scope turn-by-turn. Paste everything below the line as the first message, then say
what to build first.

---

You are the dedicated SITE / DASHBOARD / DESIGN session for caisson. Liam drives the scope
conversationally; you execute. No pre-committed plan — but the boundaries, read-first set, and
parked work below are binding context.

## Session boundaries (BINDING)

- Work ONLY in this worktree: `/home/gw/lab/caisson/.claude/worktrees/site-design`
  (branch `feat/site-design-2`). NEVER touch the main checkout `/home/gw/lab/caisson` or other
  worktrees — another live session owns them.
- First act: `git fetch origin && git merge origin/main` — the P2 remediation PRs (#112 prose,
  #113 security floor) merged after this branch was cut. #113 touched `apps/site/emails/*` and
  `apps/admin/src/app/business/mutations.tsx`; merge before editing either.
- Sub-branches for PRs: cut from this worktree, push, PR, merge, then merge origin/main back.
  Parallel writer agents need their own worktree isolation.
- Design route: `gw-frontend-designer` + the `impeccable` skill, refero MCP for reference
  research. Subagent dispatches declare `model` explicitly (sonnet for bounded builds — never
  default to the session model).

## Read first (decision surface — do not re-litigate)

1. `knowledge/decisions/ADR-0237-site-presentation-rework-locks.md` — the 8 locks + 2 riders.
   Rider 1: brand system TWEAKABLE (accent lock is soft under this rider — confirm with Liam
   before changing it). Rider 2: FULL V1-live posture — no roadmap labels, no "coming soon",
   anywhere.
2. `knowledge/decisions/ADR-0238-standalone-catalog-drop-edition-cores.md` — 11-module catalog.
3. `CLAUDE.md` (repo root) — invariants, commit scopes, PR gate, Linear boundary. ADR ceiling 0241. WCAG 2.2 AA floor (ADR-0194), Martian Mono (ADR-0195), sitewide ⌘K (ADR-0196).
4. `docs/state/opportunity-backlog.md` — the parked-work ledger this session may pull from.

## Audit residue routed to this session (verified still open on main, 2026-07-04)

From the ADR-0233 ledger, the site/design-area rows the remediation waves did NOT cover:

1. **Install-command mismatch** — docs pages say `bun create caisson@latest`, marketing pages
   say something else. One command everywhere (docs + marketing + README snippets).
2. **Billing docs page under-sells the drivers** — documents Stripe + Paddle only; the package
   ships LemonSqueezy and Polar drivers too. (Same omission in the npm-facing package
   description — that half belongs to the prose program, fix the DOCS PAGE here.)
3. **Agentic-Dev docs page still calls it a roadmap edition "sequenced post-wedge"** while the
   pricing page sells it — a direct ADR-0237 rider-2 (V1-live) violation. Rewrite the page.
4. **DESIGN.md primitives pointer drift** — the closing pointer lists components that moved.
5. (trivial) `apps/admin` mutation-panel file-header says "four locked actions"; a fifth
   (purchase-revoke, ADR-0225) exists. One-line comment fix, fold into any admin-adjacent PR.

## Parked work this session may pull (Liam's call, per item)

- **F2 real media** — the module depth routes (ADR-0237 F2) shipped with a media slot;
  real screenshots/diagrams/motion never produced. The highest-visibility gap on the site.
- **Glossary batches 2–3** — ~20 locked terms remaining (ADR-0235; batch-1 shipped 12).
  Content-heavy, adversarial-authoring workflow pattern already proven.
- **Behind-the-gate eyeball** — marketplace hub, glossary, ask-AI, module depth routes have
  never had an operator visual pass (CF Access blocks curl; needs Liam's SSO in a browser).
  Drive a punch-list from what he sees.
- **Buyer dashboard polish** — post-purchase surfaces (license keys, entitlements, credits)
  shipped functional, never had a design pass.

## Mechanics

- Gates: `bun run check` + full `turbo build` (Next client/server bundle leaks only surface in
  `next build`). Site-only diffs are greptile-non-critical — ordinary checks merge.
- Changeset-presence gate: `@caisson/site` IS version-tracked — any `apps/site` diff needs a
  changeset (patch) or the standards-gate fails. Prose rules apply to changeset bodies
  (ADR-0241: no ADR refs, no wave jargon, no internal paths).
- Commit scopes: `site` `docs` `admin` `ui`. Conventional commits, no `+`/`@`/em-dash in
  subjects.
