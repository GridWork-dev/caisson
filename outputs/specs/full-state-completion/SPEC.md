# SPEC — Full-state reconciliation and completion

- **Date:** 2026-07-25
- **Status:** SHIPPED — locked by operator instruction 2026-07-25, program closed 2026-08-09/10: the fork walk disposed all fifteen board rows (ADR-0403–0406) and the execution wave landed (CAISSON-150 **Done**). Status line corrected 2026-08-26.
- **Tags:** `security` `external-system` `data-migration` `infra` `frontend` `ui`
- **Decision:** ADR-0379

## Goal

Bring Caisson's repository truth, launch-critical enforcement, deployed fleet, already-locked
product surfaces, and three requested provider adapters into one verifiable state without opening
paid commerce or changing buyer-facing site copy.

Success means:

1. The live work tracker, fork board, ADR index, build state, production-readiness record, launch
   runbook, and Linear dispositions agree with the repository and deployment evidence.
2. Dependency-cruiser proves that TypeScript is enabled and analyzes the TypeScript graph instead
   of returning a JavaScript-only false green.
3. Every sellable commercial SKU has one ADR-backed price authority row, every non-sellable
   package is explicit, and manifests, pricebook, site catalog, docs, support, and fulfillment agree.
4. Rate-limiter infrastructure failures preserve Paddle webhook availability but fail closed on
   issuer, admin, and evaluation routes.
5. The site, admin, license, docs, support-bot, and registry Worker can be reconciled to one
   immutable source revision after the external-system and migration gates are approved.
6. The verified residuals from the per-row proof, tenant proof, design-manifest, module-depth, and
   crosswalk plans are shipped with their existing security, UI, and claim-posture invariants.
7. The jobs, field-crypto, and audit-worm ports gain conformant Inngest v4, Azure Key Vault, and
   Azure Blob WORM adapters with injected clients, no ambient credentials, and gated live tests.
8. Repository, security, UI, deployment-parity, and release evidence is current before any
   completion or launch claim.

## Locked behavior

- Python remains limited to the two existing services.
- Marketing remains public; cart, dashboard, and checkout remain Cloudflare-gated.
- Buyer-facing site copy is unchanged in this program.
- The locked catalog is carried without reinterpretation: Compliance $1,649, Everything $2,259,
  and `oscal-spine` $249.
- Outreach, interviews, and the demand clock wait for the four technical proof receipts.
- All three adapters ship, each through an isolated implementation/review lane.
- A single version/release train follows all local code waves.
- Paid launch requires four technical receipts and two or three independent auditor acceptance
  reviews in addition to the operator launch gates.
- `substrate.field-crypto-policy` remains an open content decision; this program records it but
  does not invent canonical control content.

## Non-goals

- No Paddle production submission, Mercury application, secret rotation, vault write, public-repo
  flip, npm publish, immutable tag, production migration, service restart, Cloudflare gate removal,
  or paid-commerce launch without the corresponding main-thread authority gate.
- No new LLM-adapter family, `agent-*` family expansion, Python service, pricing fork, marketing
  claim, or site-copy wave.
- No replacement of existing provider ports or conformance suites.
- No destructive rewrite of append-only registry, ADR, evidence, or release history.

## Public interface additions

- Jobs: `createInngestJobQueue`, `InngestClient`, `InngestJobQueueConfig`.
- Field crypto: `createAzureKeyVaultKmsClient` plus injected Azure client/config types.
- Audit WORM: `AzureBlobArtifactStore` plus injected Azure Blob client/config types.
- Existing `JobQueue`/`JobConsumer`, `KmsClient`, and `ArtifactStore` contracts remain compatible.

## Acceptance

- `bun run check`, `bun run format:check`, and `bun run sot` exit zero.
- The dependency graph guard proves TypeScript support and checks representative `.ts` and `.tsx`
  sentinels plus a minimum module count.
- Catalog, pricebook, fulfillment, docs, and support parity tests cover every sellable SKU.
- Route tests cover limiter success, denial, and infrastructure failure for every policy class.
- Existing locked-plan acceptance tests pass for each completed product residual.
- Each adapter passes its shared conformance suite, targeted failure-mode tests, build, lint, and
  gated live test contract.
- A production parity receipt and release receipt are required for the externally gated completion
  claims; local green checks do not substitute for either.
