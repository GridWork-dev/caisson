# PLAN — S5: exposure + publish (CAISSON-111 slice 6 of 6, LAST)

- **Executes:** ADR-0360 (DAG tail) · SPEC `SPEC-caisson-111-loop-slices.md` §7 ·
  ADR-0361 (the encRef blocking gate) · ADR-0362 (the dedicated entitlement slug).
- **Depends:** S4 merged. Serial. Bundle/pricing publish rides the END of this slice per
  ADR-0351 rider 3 (the launch firewall holds until the release gate is green).
- **Branch:** `admin/caisson-111-s5-exposure-publish` (one PR).
- **Tags:** `security` — entitlement gating + field-crypto + pricing/catalog are money and
  license seams; the fable audit fires at SHIP and MUST verify task 1 explicitly
  (ADR-0361: a PLAN that reaches the publish tasks without the wrap is not gate-clean).

## Tasks

1. **encRef wrap of `parked_state` (BLOCKING, FIRST — ADR-0361).** Parked bodies are
   encrypted at rest via `@caisson/field-crypto`: `park` writes the encrypted body,
   `claimResume` decrypts it back into the loop; a raw SQL read of `agent_run_state`
   yields no plaintext conversation or tool args (test proves it). Terminal-retention
   null-out (deny/finish/successful-resume, shipped in S3) is preserved. Any
   key-provisioning surface follows field-crypto's existing tenancy conventions — no new
   key material shape.
2. **CLI:** `caisson run start|status` on the `caisson` bin (the doctor.ts thin-client
   pattern). `start` opens a governed run through the S2/S3 loop seam; `status` reads the
   run-state + trajectory projection (never `parked_state`).
3. **MCP:** `run_start`/`run_status` via the registerTool seam (coach.ts /
   manifest-tools.ts template; a new optional `McpServerOptions` group), gated on the
   module's OWN dedicated entitlement slug (ADR-0362) — never the Agentic-Dev bundle
   slug. Denied entitlement fails closed with the standard 402-shaped tool error.
4. **Bundle membership + pricing publish (END of slice, ADR-0351 rider 3).** The runtime
   modules leave the reserved-id convention and become real catalog entries: ledger
   append inputs + index build + pricebook rows + Agentic-Dev membership (composition per
   ADR-0362). Price points resolve per ADR-0260's new-SKU first-price rule; if a number
   is not derivable from a locked formula, it surfaces as an operator picker at
   EXECUTE — never auto-decided. In-repo artifacts land in-branch; the live index
   re-publish + Worker redeploy stay operator-gated (DEPLOY is separate from SHIP).
5. **Parent demo end-to-end (SPEC exit gate):** one deterministic proof driving
   start → park → approve → resume → finish across the CLI and MCP surfaces against the
   real PG stores (zero network, mock model).
6. Changesets (buyer-readable, no tracker ids); verify: dependents chain +
   the standards-gate PACKAGE test suite (boundary fixtures) + publish-config guard +
   `bun run sot`; the fable security audit at SHIP.

## Routing

Builder: `gw-typescript-pro` (sonnet) worktree off post-S4 main. SHIP: opus review +
`gw-security-auditor` (fable — field-crypto wrap, entitlement gate, pricing publish are
exactly the money/license/crypto seams fable is reserved for). No `ai` tag — no model
logic changes; the eval harness gate was S4's.
