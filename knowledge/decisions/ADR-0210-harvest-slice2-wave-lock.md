# ADR-0210 — Harvest slice-2 wave lock: reconcile terminal states, asymmetry harden-in-place, full-scope build

**Status:** accepted · 2026-07-02 (lift-harvest session, operator picker).
**Relates:** ADR-0133/0134/0135 (the harvest program locks), ADR-0186 (agent-runner, filed same session),
ADR-0211–0216 (the per-package decisions of this wave), ADR-0062/0063 (the existing ai-evals/guardrails
modules), ADR-0015 (better-auth as-is), ADR-0160/0162 (the ai-config surface this wave hardens).

## Context

Act 0 of the lift-harvest kickoff ran a 20-agent per-target reconcile of the full ADR-0133/0134/0135
program (workflow `wf_22d4f058-b01`) against code-on-disk at `main`@go-live. Result: 12 targets fully
covered (agent-kernel, agent-dev, observability, prompt-registry, local-ai→local-store, field-crypto,
audit-harness, alerting, retention-runner, support-impersonation, audit-worm WORM B2, the 8 decoupling
seams closed-by-rebuild), 10 packages with named hardening gaps, and one net-new sellable (agent-runner)
not started. Three program-level forks remained open; the operator locked all three.

## Decision

1. **ai-evals/guardrails asymmetry (flagged by ADR-0133) → HARDEN IN PLACE.** The new capabilities
   (Wilson-CI gate, reflexivity queue, Fleiss-kappa, exit-classifier; egress secret-gate, FTC-4Ps) land
   inside the existing `packages/ai-evals` + `packages/guardrails`. Edition membership unchanged — AI
   Production Kit keeps both; Agentic-Dev may gain them later via a members-fold in the ADR-0178 pattern.
   No duplicate same-named Agentic-Dev packages are created.
2. **Scope → FULL remaining program this wave.** Every hardening-needed row builds: ai-config (3 fixes),
   ai-kit (fetch deadline + metered embeddings, ADR-0213), ai-evals depth (ADR-0214), guardrails
   (ADR-0215), mcp-server (ADR-0216), jobs consumer-side (ADR-0211), kernel branded-money + rounding
   provenance (ADR-0212), billing Stripe envelope schema, tenancy-rls pre-flight guard +
   migration-equivalence harness, ai-meter MinHash/LSH dedup-before-meter — plus agent-runner (ADR-0186).
   The billing/ai-config/tenancy-rls items are hardening within existing ADR scopes (0116/0200, 0160/0162, 0005) and carry no new decision beyond this lock.
3. **auth lift-sweep #9 (hash-at-rest session tokens) → DEFERRED with reason.** better-auth 1.6.23 stores
   the raw session token against a unique-indexed column with no config seam; closing the gap means
   forking/monkey-patching the provider's adapter, fighting the ADR-0015 lock to use better-auth as-is.
   Two of three sub-claims (O(1) indexed lookup, no table scan) are already satisfied. Revisit only if
   better-auth grows a token-hashing seam or a compliance framework demands hash-at-rest sessions.
4. **Wave-6 residual lift-sweep candidates (~22 sub-top-15 / doc-note-only items) → PARKED** per the
   program's own ordering ("revisit after waves 1-5 land"); no per-package SPEC pending. Recorded here so
   the bucket is dispositioned, not silently dropped.
5. **The 8 decoupling seams → closed-by-rebuild.** Caisson was rebuilt clean, never ported; the seams are
   evidenced in shipped packages (provider interface = ADR-0059 gateway; exec-allowlist = tool-exec;
   MeteringStore = ai-meter's injected store; lifecycle enums + hooks = agent-kernel; NotificationSink =
   alerting transports). `gw` CLI shapes, `hooks.py`, and `~/.gridwork/env` fall under the ADR-0133 skip
   boundary (operator tooling).

## Rejected

- **Seed new Agentic-Dev packages for the asymmetry** — creates two same-domain packages per name and
  breaks ADR-0003 (editions compose base primitives, never fork them).
- **Defer the M/L depth tail (jobs worker-side, rounding provenance, MinHash)** — recommended as the lazy
  default; the operator explicitly chose the full program.
- **Build auth #9 anyway** — provider-fighting change against a locked vendor choice for a marginal
  security delta on an already-indexed, already-O(1) lookup path.
