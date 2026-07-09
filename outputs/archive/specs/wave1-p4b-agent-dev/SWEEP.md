# SWEEP — Wave 1 / P4b: Agentic-Dev edition (downstream impact)

Act 5. What else the P4b diff touches: new base surfaces, what they unblock, stale docs, queued follow-ups.

## New base surfaces (note for future audits)

- **`@caisson/agent-kernel` (base, paid)** — the engine-neutral kernel: artifact schema + `define*()`,
  ghost-ref validator, lifecycle FSM, governance guards + unified `HookResult`, hooks dispatcher, and
  the opt-in audited-lifecycle moat. Consumable **base→base** (cli/mcp-server) and **edition→base**
  (agent-dev). Reuses `kernel/{audit-chain,versioning}.ts` verbatim — no new crypto surface.
- **`@caisson/local-store` (base, paid)** — sqlite-vec (`vec0`) + FTS5 + RRF hybrid retrieval with the
  always-available FTS floor; the pluggable `Embedder` port; the cloud-egress secret-scrub guard; the
  dedup/TTL/GC retention default; the file-per-tenant isolation floor (`tenant-db.ts`, ADR-0073).
- **`@caisson/agent-dev` (edition, paid)** — the composition: governed kernel + hybrid memory + the
  thin multi-harness emitter + curated Caisson-native content. `editions:["agent-dev"]`, down-only deps.
- Both new base packages registered in `.dependency-cruiser.cjs:23` `BASE_PKGS` (+ `boundaries.js`);
  `agent-dev` already in `EDITIONS`. The `down-only-no-base-to-edition` rule now covers all three.

## Downstream now unblocked

| Consumer                        | Unblocked by                                               | Consumes                                                                               |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **P4a local-ai edition**        | `@caisson/local-store` (the shared P4 memory primitive)    | `LocalStore` hybrid retrieval + `Embedder` port + egress guard, down-only              |
| **`cli` / `mcp-server` (base)** | `@caisson/agent-kernel` (base→base)                        | the artifact schema + lifecycle FSM + hooks dispatcher for generated-project authoring |
| **P5 generator / registry**     | the agent-dev manifest + golden + down-only depcruise rows | `agent-dev` as a publishable edition once registry publish + member-pin backfill lands |

## Docs reconciled (this diff)

- `apps/agent-dev/README.md` — documents the ADR-0044 CLI-exception (a kernel demo is not a Next.js page). ✅
- New ADRs **ADR-0065** (`@caisson/agent-kernel` base) · **ADR-0066** (governed engine-neutral kernel +
  emitter) · **ADR-0067** (`@caisson/local-store` base) + board rows. ✅
- Per-package `AGENTS.md` contracts (agent-kernel, local-store, agent-dev). ✅

## Queued follow-ups (non-blocking)

1. **Wire the live cloud-embed transport** — exercise `createCloudEmbedder`'s real `fetchWithTimeout`
   POST against a recorded fixture (the one un-exercised path). When a live cloud embedder is wired in
   an edition, it becomes a real external egress sink and must land a row in the surfaces ledger then.
2. **Thin-test the real shell-hook spawn** — `defaultRunner` (`execFile` argv) is only exercised via the
   injected double; add a smoke test over a trivial real command (e.g. `true`/exit-1) to cover exit-code.
3. **agent-dev GA promotion** — the edition is roadmap-labeled (ADR-0082 §4). Promotion = bundle the
   local embedding model lane (or document the buyer-wired embedder) + the deferred Next.js inspector.
4. **Multi-tenant RLS on memory** — the `scope` seam is documented, not wired (no `tenancy-rls` dep);
   today isolation is the file-per-tenant physical floor (ADR-0073). Wire RLS when the local tier needs it.
5. **`priceCents`** — the 4900 placeholder anchor on all three manifests; finalize under the open
   "Pricing numbers" board fork (out of P4b scope).

## Co-landed but out of P4b scope

- **`@caisson/license-verify`** (`kind:primitive`, ADR-0010) landed in the same PR#11 integration branch
  but is NOT a P4b artifact — it carries its own ADR trail (offline Ed25519 verify; issuer is P6).
  Verified against ADR-0010, not this SPEC; flagged here only so a future audit doesn't mis-attribute it.

## No regressions

PR#11/#12 merged green on `main` (CI verified — not re-run here per the dist-glob / turbo-contention
gotcha). Three packages ship through the one `tooling/` standards gate; depcruise 0 violations (no
base→edition edge); all goldens byte-stable BLESS-unset. No service touched (DEPLOY stays operator-gated).
