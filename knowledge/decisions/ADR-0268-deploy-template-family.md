# ADR-0268 — Deploy-template family in generated repos: Railway + Fly + Vercel off one Dockerfile base

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 4, dx-demos-compat session).
One ADR per port-family (here: a generator template family, not a runtime port). Extends
ADR-0091/0093 (template engine + free-local CLI untouched in behavior when unselected).
Append-only. **Tags:** none (template files only; nothing executes at generate time).

## Decision

1. **`deployTarget` becomes an optional Selection field** (additive through the Zod
   `.strict()` schema) mapping to deploy template directories composed by the existing
   `templateDirs()`/token-replace/deep-merge engine. Targets: **railway** (railway.toml),
   **fly** (fly.toml), **vercel** (Dockerfile.vercel — container support GA'd 2026-06-30;
   note its default-port-80/`PORT` semantics). All three share one single-stage Dockerfile
   base on `oven/bun:1.3.14-slim`, adapted from the proven `services/docs` pattern (the
   non-monorepo analog), parameterized per target.
2. **Flag path:** `--deploy <railway|fly|vercel>`. **Interactive path (ADR-0262):** an
   optional wizard step defaulting to none.
3. **Unselected = byte-identical to today** — no deploy files emitted, golden-file locked
   alongside the existing generator fixtures.

Rejected: **generic Dockerfile only** (weakest against the competitors-demo-drop-in pull
that motivated the rank); **Railway+Fly-only** (Vercel's variant is the same Dockerfile
under another filename — marginal cost is one config file, taken now with the 6-day-old
surface labeled as-is).

## Consequences

- The generator's golden fixtures gain one composition per target; CI cost is trivial.
- Vercel's container runtime is a week old — if field mileage surfaces breakage, the
  template is a file drop to amend (no code path depends on it).
- Deploy templates are inert artifacts in the buyer's repo; no live-proof row needed
  beyond generator golden tests (ADR-0265 does not gate on them).
