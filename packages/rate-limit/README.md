# @caisson-sh/rate-limit

Shared abuse-throttle primitives.

- **Layer:** base

Two limiters, one package: an in-memory per-IP token-bucket for unauthenticated surfaces (keyed on
the client IP), and a Postgres-backed per-account token-bucket store for authenticated ones (RLS
scoped). Any composition wires in whichever one fits the surface it's protecting.

See `AGENTS.md` for the public API and invariants.

Licensed Apache-2.0 (open Base substrate).
