# ADR-0379 — Full-state completion program locks

- **Status:** LOCKED (operator, 2026-07-25)
- **Extends:** ADR-0022, ADR-0184, ADR-0267, ADR-0330, ADR-0331, ADR-0333,
  ADR-0344, ADR-0345, ADR-0347, ADR-0368, ADR-0373
- **SPEC:** `outputs/specs/full-state-completion/SPEC.md`
- **PLAN:** `outputs/plans/full-state-completion/PLAN.md`

## Context

A repository-wide audit found that the normal build was green while three separate truth systems
were not: dependency-cruiser silently skipped TypeScript, price authority covered only a seeded
subset of sellable manifests, and deployed service manifests no longer shared one digest. Several
locked product plans also retained verified residuals, while three provider adapters remained
planned rather than built.

The operator approved one dependency-ordered completion program and explicitly locked the
remaining forks.

## Locks

1. **Truth first.** State documents, Linear dispositions, deployment manifests, and release
   evidence are reconciled before another completeness claim.
2. **Dependency graph must prove coverage.** CI fails unless dependency-cruiser reports TypeScript
   enabled and the emitted graph contains representative TypeScript files and a realistic minimum
   module count.
3. **Price authority is total over sellable commercial modules.** There is no `$49` sentinel
   exemption. Bundle-only or unpublished packages declare `sellable: false`; every sellable
   package has an ADR-backed authority row and pricebook entry.
4. **Limiter failures split by route.** Paddle webhook ingestion fails open on limiter
   infrastructure failure and alerts; issuer, admin, and evaluation routes fail closed with 503.
5. **Fleet parity means one immutable source revision.** Site, admin, license, docs, support-bot,
   and registry Worker reconcile to one SHA, with migration 0030 and all external operations
   remaining main-thread risk gates.
6. **Complete only verified locked residuals.** Existing per-row verification, tenant-proof,
   design-manifest, module-depth, and crosswalk specs govern their surfaces. Already-shipped work
   is preserved.
7. **Provider wave includes all three adapters.** Add Inngest v4 behind the jobs port, Azure Key
   Vault behind the KMS port, and Azure Blob immutable storage behind the artifact-store port.
   Each uses injected clients, strict configuration validation, conformance tests, and gated live
   tests. No ambient credential reads enter core adapter code.
8. **Azure crypto-shred is fail closed.** A delete request is not reported as irreversible
   destruction unless the provider response and configured purge-protection posture prove the
   required condition.
9. **Azure WORM is capability checked.** Create-only upload, read-back immutability, monotonic
   retention extension, and fail-closed behavior on unsupported accounts are mandatory.
10. **Commercial posture stays frozen.** Marketing is public; cart/dashboard/checkout remain
    Cloudflare-gated; displayed Compliance pricing remains $1,449; buyer-facing copy does not
    change; paid launch and demand activity wait for the locked proof and operator gates.
11. **Architecture freezes hold.** Python remains two services; the eight LLM adapters and six
    `agent-*` package families do not expand.
12. **One release after all code waves.** Existing and new changesets are consumed only in the
    dedicated version/release train after reconciliation and audits.

## Open decision recorded, not answered

`substrate.field-crypto-policy` still lacks operator-approved canonical control content. Add it to
the live fork board and keep the binding unresolved; this ADR does not authorize an implementation
or claim.

## Consequences

- The dependency graph gains a maintained compatibility patch/guard instead of relying on package
  manager hoisting.
- Price placeholders can no longer masquerade as locked sellable prices.
- Webhook availability and protected-route authorization fail modes become intentionally
  different and test-enforced.
- Three new provider SDKs and Azure egress surfaces enter the dependency/security ledgers.
- Deployment, migration, secrets, tagging, publishing, and public-launch actions remain separately
  receipted external gates even though the local implementation program is locked.
