# @caisson-sh/kernel — agent usage note

Provides the governance kernel: typed config loader, the `CaissonError` hierarchy (ADR-0019), security primitives, and the standards gate (ADR-0016). Every other `@caisson-sh/*` package depends on kernel.

## Key surface

- Use `CaissonError` (and its typed subclasses) for all domain errors — never throw raw `Error` objects in product code.
- Security primitives re-exported here: `safeEqualFixed` wraps `crypto.timingSafeEqual` for fixed-length secrets; use it for every token/key comparison (ADR-0005).
- Config loading is validated with Zod at the boundary; unknown fields are rejected (`z.object().strict()`).
- `crypto.randomUUID()` is the only sanctioned ID generator — never `Math.random()` or sequential integers for IDs.

## Scope

Governance primitives only. No business logic, no Postgres, no HTTP. Everything that other packages need from the runtime floor lives here.
