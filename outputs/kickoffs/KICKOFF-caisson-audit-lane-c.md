# KICKOFF — Audit remediation Lane C: site demo split (multi-zone apps/demos)

- **Worktree:** `/home/gw/lab/caisson-wt-lane-c` · **Branch:** `feature/demos-split` (cut from main)
- **One PR, hard.** Push the branch and OPEN the PR; never merge — the reconcile session merges and controls deploy order (ADR-0328 / ADR-0400 §4).
- **Decision locked:** ADR-0400 in `knowledge/decisions/` — read it first; the shape below implements it. Do not edit ADRs or the state boards (frozen during the wave).
- **This PR carries the `ui` tag → run the in-session SHIP audit lane (gw-code-reviewer opus + adversarial verification of findings) against your branch diff BEFORE opening the PR.** Fix confirmed findings in-lane.
- **HARD BOUNDARY — external systems:** do NOT create the Railway service, do NOT deploy anything, do NOT touch DNS/Cloudflare. You build the code + workflow entries; the reconcile session pages the operator for service creation and controls the flip. If a step seems to need a live service, stub/gate it and note it.

## The shape (ADR-0400)

1. **New `apps/demos` Next.js app** owning the poke surface: `apps/site/components/poke/*` (the ~53 files), their sample-data modules, and the `@caisson/*` dependencies that exist solely to power them (~27 — derive the exact set from what the moved components import; anything site still uses elsewhere stays a site dep too).
2. **Same origin via multi-zone:** `apps/site`'s `next.config` gains a rewrite of `/demos/:path*` to the demos service URL (env var, e.g. `DEMOS_ORIGIN_URL`, with a FAIL-SAFE default: when the env var is unset, the rewrite is omitted and site must build+serve exactly as today — this is what makes the PR mergeable before the service exists).
3. **Embed routes:** `apps/demos` serves minimal `/demos/embed/<module>` pages — one poke per page, no site chrome, theme-consistent (import the same design tokens the pokes already use). Module/marketing pages that currently render pokes inline via `components/media-carousel.tsx` switch to a same-origin `<iframe src="/demos/embed/<module>">` wrapper component (lazy, sized to the current slot, graceful fallback text when the iframe can't load — the fail-safe state pre-flip).
4. **App scaffolding mirrors `apps/site`'s conventions:** Next standalone output, same Dockerfile/railway config pattern as site (copy site's and trim), a `/healthz` route (the fleet's health-probe convention), port from env, `@caisson/eslint-config` + `tooling/tsconfig` + turbo tasks like the other apps.
5. **Fleet prep (code only):** add a `caisson-demos` entry alongside the existing services in `.github/workflows/deploy-railway.yml` and `tooling/scripts/railway-deploy.ts`'s service list, following the existing per-service pattern exactly. These entries are inert until the service exists — that's fine.

## Known traps (all previously hit in this repo — do not rediscover them)

- **Bundlers substitute node builtins silently:** a `node:` import in a browser graph never fails the build — it pulls a ~428KB polyfill. The pokes import package `./browser` entries (ADR-0396); keep it that way in apps/demos and add a static source-graph walk test for the demos app's client graph (the `@caisson/testing/module-graph` walker is the house tool; see any `browser-safety.test.ts` for the pattern, including the positive control so a blind walker fails loudly).
- **Next standalone strips `src/`:** runtime file reads that worked in dev die in the standalone image. Any runtime file access in apps/demos must resolve from the app dir with explicit includes (see how apps/site handles its public/data files).
- **Railway builder dies silently on typecheck:** the deploy builder can kill the build without a usable error — local `bun run build` in apps/demos plus `next build` must be green before you push, every time.
- **Site chunk budget has zero headroom:** moving 27 deps OUT should shrink site's chunks — verify site's `next build` passes its existing budget/gates and note the before/after main-bundle numbers in the PR body (this is the payoff metric).
- **CF beacon/CSP/bot rules:** same-origin multi-zone means NO changes to CSP, frame-src, bot rules, or analytics injection. If you find yourself editing any of those, stop — the shape is wrong.
- **`next build` alone proves nothing about browser-safety** (see trap 1) — the walk test is the proof.

## What moves vs what stays (site side)

- MOVE: `components/poke/*` (components + their css/tests), poke-only sample-data modules, the poke lazy-load registry inside `components/media-carousel.tsx` (carousel stays; its poke slides become iframe slides).
- STAY: everything else — marketing pages, docs, dashboard, checkout, `lib/*`. Site keeps deps still used outside pokes (derive by grep after the move; `bun run knip` on the worktree confirms).
- `apps/site/package.json` drops the poke-only `@caisson/*` deps (target: 50 → low twenties). `bun install` to reconcile the lockfile.
- Site tests that exercised poke components move with the components; site-level tests referencing pokes by route/DOM must be updated to assert the iframe wrapper instead.

## Gates before opening the PR

```bash
cd /home/gw/lab/caisson-wt-lane-c
bun install
bun run check                          # whole-repo turbo green, incl. the new app
(cd apps/demos && bunx next build)     # standalone build green
(cd apps/site && bunx next build)      # site green WITHOUT DEMOS_ORIGIN_URL set (fail-safe state)
bun run sot                            # advisory; boards/ADRs frozen
bunx changeset status --since=origin/main
```

**Changesets:** `@caisson/site` patch/minor for the split + one for any `packages/*` you touch (plain prose, no ADR cites). apps/demos is new+private — give it a naming changeset if the gate demands one for the new workspace.

**Commit style:** conventional commits, plain-ASCII subjects; suggested sequence: scaffold app → move pokes → embed routes + iframe wrapper → site rewrite (env-gated) → fleet prep → dep prune. PR title `feat(site): demo surface split — multi-zone apps/demos (ADR-0400)`. PR body MUST include: dep-count before/after, site bundle before/after, the fail-safe statement (site is byte-safe with DEMOS_ORIGIN_URL unset), the SHIP-audit verdict summary, and a "Skipped" list.

## Handback to reconcile

End state: branch pushed, PR open, CI green, SHIP audit clean. The reconcile session then: pages the operator to create the `caisson-demos` Railway service → deploys demos → verifies `/healthz` + embed routes live → sets `DEMOS_ORIGIN_URL` on site → merges + deploys site. You do none of that.
