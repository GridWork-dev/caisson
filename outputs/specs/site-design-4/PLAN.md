# PLAN — site-design-4

Execution plan for `SPEC.md`. Scope is `apps/site` only (no `packages/*` → no changeset). Atomic
commits, conventional (`feat(site): …`). Reuse-first: the calculator math and `/compliance` page
already exist — do not rebuild them.

Per-task verify (run from the worktree root unless noted):

- `bun run check`
- `bunx turbo run build --filter=@caisson/site` (client/server bundle leaks only surface in `next build`)
- `bun test` in `apps/site` (incl. `components/page-sections.test.tsx`)

## Tasks

### T1 — Six-bundle section anchor (unblocks the production door)

- Add a stable `id` (e.g. `id="bundles"`) to the existing "Bundles" `Section` on
  `apps/site/app/(marketing)/page.tsx`. No grid change.
- Verify: `bunx turbo run build --filter=@caisson/site`.

### T2 — Dual-door hero

- New site-local `DualDoorHero` in `apps/site/components` composed from kit primitives (Card, Button,
  StatusChip, Terminal/CodeBlock). Compliance = lead/accent door → `/compliance`; production =
  secondary door → `/#bundles`. Umbrella headline names the production-rigor layer (ADR-0040).
- Replace the compliance-only `Hero` on `/` with `DualDoorHero`; keep an honest supporting artifact
  (existing cross-tenant `Terminal` and/or install `CodeBlock`).
- Copy: honest + mechanism-named now (ADR-0080); mark the door sub-lines as Cookiy-287453-refinable
  with a `// ponytail:` note so the later copy pass is obvious.
- Verify: build + check; eyeball both doors route correctly.

### T3 — File-tree + code bento

- New site-local `FileTree` component (recursive list, real paths: `apps/`, `packages/`, `tooling/`,
  `services/`, `registry/`) + a bento layout section on `/`. Bento cells reuse `CodeBlock`/`Terminal`
  with **real** snippets (RLS `FORCE`, `sha256(prev ‖ payload)`, install line — the strings already
  used on `/` and `/compliance`). No fabricated file or code.
- Verify: build + check.

### T4 — Architecture-isolation + data-lifecycle diagram pair

- Two site-local diagram components, hand-authored inline SVG/CSS (no new dependency), theme-aware:
  (1) per-tenant RLS isolation boundary (no-context query → nothing); (2) evidence lifecycle
  write → audit-chain hash → WORM anchor → verify/export. Depict shipped behavior only.
- Add both to a homepage section (wrap in `Reveal` for optional motion).
- Verify: build + check; check light/dark rendering.

### T5 — Bundle-builder calculator on `/`

- Embed `StackBuilder` (compact home wrapper if the full rail is too heavy for the homepage) in a
  new `/` section with a short lede + link to `/marketplace/build`. No pricing math re-authored.
- Verify: build + check; confirm the live total + upgrade nudge work on `/`.

### T6 — `/compliance` repoint + nav coherence

- Confirm the regulated door → `/compliance` and that `/compliance` reads as the acquisition landing
  (metadata/JSON-LD already present). Confirm no dead links; six-bundle vocabulary consistent across
  hero, grid, nav. No compliance-only framing left on `/`.
- Verify: build + check; click every nav + door destination.

### T7 — Gates + goal-backward verify

- Full `bun run check`; `bunx turbo run build --filter=@caisson/site`; `bun test` in `apps/site`.
- Re-ask SPEC acceptance criteria 1–4 against the diff (VERIFY act). SWEEP for homepage scroll weight
  and stale copy. Optional at SHIP: a numbered ADR (ceiling 0269 → 0270) recording the dual-door
  execution + the new honest-artifact components — the direction is already locked (D1/D4), so this is
  a record, not a new fork; skip if the operator does not want a numbered lock.

## Notes

- No `packages/*` changes anywhere → the changeset gate is not triggered (apps/* exempt).
- PGlite-backed suites are not in `apps/site`; run site tests normally.
- Prettier pre-commit may reflow `.md`; if a commit fails or files change, re-add and retry.
