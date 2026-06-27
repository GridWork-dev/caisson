# ADR-0002 — Engineering invariants (apply to all product code)

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Inherits the gridwork-core floor; this ADR pins the library-specific invariants every package
and shipped app must hold:

- **TypeScript strict**, Bun runtime. **Zod `.strict()` at every boundary.** No `any`, no
  `console.log` in product code. `crypto.randomUUID()` for IDs.
- **Credits/money are integer units** — never floats, anywhere (ADR-0007).
- **Append-only versions** — locked/certified artifacts are immutable; amendments supersede,
  never mutate (ADR-0006).
- **`fetchWithTimeout` on every outbound `fetch`** (the native AbortSignal timeout is forbidden
  on Bun); **`crypto.timingSafeEqual` for every token/license/secret comparison.**
- **Fail-closed by default** — RLS (ADR-0005), credit gates (402), license checks.
- **The standards layer is the gate:** `tooling/` (eslint-config + tsconfig + testing) is the
  single source; CI fails on any package that doesn't extend it. A package ships only through
  this gate — and a **golden-file regression harness** runs before any compliance logic.

Rejected: per-package ad-hoc config (drifts; the whole point of a standardized ground-up library
is one enforced standard). Floats for credits/money (rounding + audit nightmares).

Binding: this ADR is referenced by every package's README; violations block merge.
