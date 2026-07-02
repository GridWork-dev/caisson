# @caisson/ui — the component recipe

Operationalizes **ADR-0099**. Every primitive in `src/components/` is built the same way; the
**reference is `button.tsx` + `button.css`** — copy its shape. The kit is **framework-agnostic raw
`.tsx`**: it never imports `next/*` or any framework.

## The five rules

1. **Radix behavior only.** Interactive primitives (disclosure / dialog / toggle / tooltip) use the
   unified **`radix-ui`** package for behavior + a11y; we own 100% of the styling. Import the
   namespace and use its `.Root` (umbrella footgun: `import { Slot } from "radix-ui"` →
   **`<Slot.Root>`**, never `<Slot>` — the bare namespace throws "Element type is invalid"). Purely
   presentational primitives (Section, Card, Terminal, …) need **no** Radix.
2. **Co-located plain CSS.** One `foo.css` next to `foo.tsx`, imported at the top
   (`import "./foo.css"`). Every value is a `var(--cs-*)` token — **no** raw hex, no `oklch(...)`
   literal, no Tailwind / cva / CSS-modules / vanilla-extract / class-string lib. (The anti-slop gate,
   ADR-0101, enforces this.)
3. **Variants as `data-*`.** Express variants with `data-variant` / `data-size` / `data-status` /
   `data-surface` and style them with attribute selectors (`.cs-foo[data-variant="x"] { … }`). No
   variant logic in JS; theming is pure cascade. For multi-token components use a **local-indirection
   var**: `[data-status="x"] { --foo-color: var(--cs-danger); }` then one base rule consumes
   `var(--foo-color)`, so light/dark "just works" and the component never branches on theme.
4. **`forwardRef` + BEM names.** `forwardRef`, `"use client"` only where a hook/handler needs it, BEM
   block `cs-foo` / element `cs-foo__bar`. Polymorphism/navigation via Radix `Slot` + an `asChild`
   prop — the consumer injects `next/link`:
   `<Button asChild><Link href="/x">…</Link></Button>`.
5. **Tokens only, no inline style.** No `style={{…}}` in the kit (the old `apps/site` inline-style
   primitives are exactly what this replaces). If a value isn't a token, add the token first.

## Brand floor the kit must honor (cite, don't relitigate)

- Accent ≤10%, only on the 5 named slots (DESIGN.md §8). Icons = **Lucide** + bespoke domain glyphs,
  one `<Icon name=… />` surface (ADR-0099 F8). Code blocks always-dark. Numerals tabular Martian Mono.
- Motion: tokenized `--cs-duration-*` / `--cs-ease-*`, transform/opacity-first, `prefers-reduced-motion`
  honored, content **never** stuck at `opacity:0`, no loop/gimmick (ADR-0078 §6).
- Elevation: tonal surface + hairline is the default; `--cs-shadow-*` / `--cs-glow-accent` is the
  deliberate step (ADR-0078 §7).

## Packaging

- Exports: `@caisson/ui/components` (barrel) + `@caisson/ui/components/*` (deep) + `@caisson/ui/tokens`
  - `@caisson/ui/styles/tokens.css`. Raw `.tsx`, no bundler/dist.
- Consumers set `transpilePackages: ["@caisson/ui"]` in `next.config` and import the tokens CSS once at
  the root layout. `react` / `react-dom` / `lucide-react` are **peer** deps.
- `apps/admin` (its `/design` gallery — absorbed `apps/studio`, ADR-0140) consumes the **same** components (gallery == product → no drift). New reusable UI lands
  here, never inlined on a screen. Build order: tokens → primitives → domain.
