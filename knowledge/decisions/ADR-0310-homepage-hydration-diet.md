# ADR-0310 — Homepage hydration diet: standard scope (islands + safe chrome slices)

- **Status:** locked (operator pick, 2026-07-10 perf/mobile picker)
- **Context:** the first error-level lighthouse runs (ADR-0309 evidence, runs 29071930623 → 29072745113) left one residual red: `/` performance 0.57 desktop, TBT-bound. The research
  round (`outputs/research/perf-mobile-research-2026-07-10.md` §1) found the homepage body
  already ~95% server components — the 684ms self-hydration lives in two below-fold islands
  and the shared chrome that hydrates on every marketing page.

## Decision

Ship the **standard diet** — the low-risk levers plus the two safe chrome slices:

1. **A1 — RepoArtifact → pure CSS** (`components/repo-artifact.tsx`): the click-to-reveal
   code-card toggle becomes native radio + `:checked` sibling CSS; the `"use client"`
   directive, the 4 static code strings, and the MODULE_PAGES lookups leave the client bundle.
2. **A2 — StackBuilder defer-hydrate** (`app/(marketing)/page.tsx`): loaded via the in-repo
   `next/dynamic ssr:false` poster pattern (as the demo components already do); the poster is
   the empty-picker state and MUST match rendered height (no CLS).
3. **A4 — shared Reveal observer + deferred leaves**: `packages/ui` Reveal moves from 13
   per-instance IntersectionObservers to one module-level observer + WeakMap (zero visual
   change); the footer waitlist form and the mobile drawer defer their hydration to
   idle/first-interaction.
4. **Chrome slice (a)** — `NavAccount` server-defaults to "Sign in" and idle-mounts the
   better-auth session swap (skeleton covers the signed-in flash).
5. **Chrome slice (b)** — `OwnedItemsProvider` gates its `/api/cart/owned` fetch on a session
   cookie check; signed-out views stop firing a wasted round-trip.

**Parked with a named trigger** (NOT in scope): the fumadocs search lazy-mount and the
NavPanels popover defer-hydrate (chrome slices c/d, MED-HIGH risk on the global ⌘K wiring and
primary nav). Trigger: the standard diet + ADR-0313 land and `/` still misses the 0.9 floor
on the next evidence run.

## Consequences

Honest expectation ~250-500ms TBT off the homepage (slices amortize across every page).
Reveals stay visually byte-identical (ADR-0307 untouched); the three.js field is explicitly
out of scope (ADR-0306 already optimal). Verification: the lighthouse evidence rerun after
the next deploy.
