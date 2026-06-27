# ADR-0044 — App framework: Next.js standard for edition reference apps

Status: accepted · 2026-06-27 (closes the **"App framework per edition"** open fork on the
decisions board.)

The reference apps shipped with each edition — and all first-party web surfaces —
standardize on **Next.js** (App Router, currently 15), rather than being decided per edition.
Two surfaces already run it: `apps/studio` (the design decision surface) and the board-locked
single Next + MDX marketing/docs site.

## Why

One framework across studio, marketing, docs, and every edition app = one build/deploy story,
one design-token wiring (ADR-0042 `--cs-*` tokens), one auth/session integration pattern
(ADR-0015 EdDSA-JWT seam), one hosting target (Cloudflare Pages / Vercel-compatible).
Per-edition framework choice multiplied the maintenance surface for no buyer-visible benefit —
edition reference apps are compositions of `@caisson/*` packages, not framework showcases.

## Scope

Applies to **first-party reference apps + web surfaces** only. The `@caisson/*` packages stay
framework-agnostic (ADR-0003 composition; a package never imports a framework — enforced by
the import-boundary lint, ADR-0022). A buyer can compose the packages into
Remix / TanStack Start / Hono / their own shell if they choose; only the shipped reference
apps are fixed to Next.js.

## Rejected

- **TanStack Start** — capable, smaller ecosystem; no win over Next for these surfaces.
- **Hono + islands** — too thin for the richer dashboard / evidence UIs the Compliance + AI
  editions need.
- **Decide-per-edition** (the prior deferral) — maximizes a flexibility nobody needs and
  multiplies the maintenance surface.

## Binding

Edition reference apps scaffold on Next.js App Router; packages stay framework-free (ADR-0022
import-boundary lint); moving a single edition off Next.js requires a superseding ADR.
