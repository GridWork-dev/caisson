# @caisson/audit-worm

## 2.0.0

### Minor Changes

- 1867fa3: External anchoring v1 (TSA `trusted-timestamped` leg): the `TrustedTimestampLog` port with a
  deterministic `StubTrustedTimestampLog` and a live RFC-3161 `TsaAnchorLog` (real DER via pkijs), a
  durable `anchor_outbox` state machine (persist-before-egress; response loss resolves to
  `needs_reconcile`, never a blind resubmit), and the per-tenant checkpoint handler + `@caisson/jobs`
  task (`ANCHOR_CHECKPOINT_TASK`). Adds pinned `pkijs`/`asn1js` and a `@caisson/jobs` down-edge.
  `packages/jobs` gains zero anchoring knowledge (CR-16). The audit-worm minor bump needs the
  Compliance bundle members-fold republish (`packages/compliance/manifest.ts` pins
  `@caisson/audit-worm`).
- e5e4311: Per-row proof reads on the WORM-anchored audit chain.
  `AuditChainStore.getRowProof(accountId, seq)` returns a single row plus the per-length WORM anchor
  minted when it was the tip (`anchor(seq+1)`), so `anchor(seq+1).tipHash === row.hash` is a genuine
  per-row commitment check. One targeted row read and one WORM GET per inspected row (fork f), tenant
  scoped through `withTenant`. `seq` is bounded server-side to `0 <= seq < length` (rejects the
  truncation-probe boundary), and a missing anchor fails closed to `unverifiable`, never a fabricated
  pass.

  Signed anchors: a new dedicated `Ed25519AnchorSigner` (loaded from `CAISSON_ANCHOR_SIGNING_KEY`,
  domain-separated from the license issuer key) signs each anchor's canonical core bytes at mint when a
  signer is injected into `AuditChainStore`. `sig`+`keyId` are stored additively alongside the core, so
  legacy unsigned anchors stay byte-identical and structurally valid — not a chain-format break.
  `verifyAnchorSignature(anchor, publicKey)` checks a signed anchor against a pinned public key so
  tamper-evidence is independent of the row-serving API.

  Per-row verification UI (`./ui`): a new `ProofPanel` + `useRowVerify` hook re-run the pure kernel
  checks CLIENT-side against the fetched proof bundle (never the receipt's `checks`, M3) and fail to
  `unverifiable` when WebCrypto is unavailable (L4); a shared `RowStateChip` maps the six states onto the
  frozen `@caisson/ui` StatusChip tones. `ChainViewer` gains optional per-row six-state chips, an
  expand-to-ProofPanel that fetches the row's proof on open (fork f), and an anchor-provenance header —
  all backward compatible (absent props render the prior chain-level-only view). Adds an optional
  `@caisson/ui-pro` peer dependency for the redacted-payload viewer.

  Signed-anchor copy pass: `ProofPanel` now renders a seal caption under
  the chip using the SPEC's exact copy-law strings — "Verified against write-once anchor
  (signature-checked)" for `verified`, "Anchor confirmed — original not disclosed" for the redacted
  state, and no seal line for any other state. Never "impossible to tamper" or an unqualified
  "independently verified" claim.

### Patch Changes

- ca44db5: Add a read accessor to the audit chain store that returns a tenant's current anchor bytes and length, so scheduled external timestamping can read the latest anchor without reaching into the store's internals.
- Updated dependencies [e5e4311]
- Updated dependencies [e5e4311]
- Updated dependencies [59e1365]
- Updated dependencies [59e1365]
- Updated dependencies [809592d]
- Updated dependencies [809592d]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0
  - @caisson/ui-pro@0.3.0
  - @caisson/ui@0.6.1
  - @caisson/jobs@0.5.1
  - @caisson/tenancy-rls@0.5.2

## 1.0.0

### Minor Changes

- 1bc677a: Add an optional embeddable audit-chain viewer at the `@caisson/audit-worm/ui` subpath. It renders
  your tenant's hash-chain entries alongside the verification verdict, flagging the exact entry where
  a chain breaks. The surface is presentational and server-render safe — it draws only the data you
  hand it, opens no database, and composes the `@caisson/ui` component kit. Importing the package root
  stays React-free; React and the kit are optional peers pulled in only when you use `/ui`.

### Patch Changes

- Updated dependencies [08fd857]
- Updated dependencies [0137008]
- Updated dependencies [2b65cf3]
- Updated dependencies [5a8b317]
- Updated dependencies [8253e76]
- Updated dependencies [f903014]
- Updated dependencies [eff7248]
- Updated dependencies [47e04fd]
- Updated dependencies [51e3ed0]
- Updated dependencies [b5a3690]
- Updated dependencies [b5a3690]
- Updated dependencies [51e3ed0]
- Updated dependencies [c905c61]
- Updated dependencies [2c93128]
- Updated dependencies [b7e58a8]
- Updated dependencies [b43959c]
  - @caisson/ui@0.6.0
  - @caisson/kernel@0.4.3
  - @caisson/tenancy-rls@0.5.1

## 0.3.0

### Minor Changes

- 8c53ca3: Added two more WORM `ArtifactStore` backends alongside S3: `GcsArtifactStore` (Google Cloud
  Storage, using per-object Object Retention Lock) and `R2ArtifactStore` (Cloudflare R2, using its
  S3-compatible data plane plus a bucket-lock retention rule instead of S3 Object Lock, which R2
  does not support). Both fail closed at construction and on every write when the target bucket
  cannot actually guarantee the requested retention, never silently under-retaining. Neither
  dependency list grew: GCS talks REST directly over the existing `fetchWithTimeout` helper with a
  small hand-rolled service-account OAuth exchange, and R2 reuses the already-shipped
  `@aws-sdk/client-s3` wiring for its data plane.

### Patch Changes

- Updated dependencies [8c53ca3]
- Updated dependencies
  - @caisson/tenancy-rls@0.5.0

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- aec9f1c: The audit-worm primitive's registry manifest carried a stale placeholder price. Its listed price
  now matches the committed $149 shown at checkout, so buyers browsing the module registry and
  buyers checking out see the same number.
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy, and corrected a couple of stale cross-package dependency and usage claims to
  match the shipped code. No runtime behavior changed in any package — documentation and
  comments only.
- Updated dependencies [b791198]
- Updated dependencies [0c883ae]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
  - @caisson/tenancy-rls@0.4.0

## 0.2.3

### Patch Changes

- cf66d65: Hardened row-level security on the audit-chain and locked-version tables: the tenant-isolation
  check now discards an empty-string tenant identifier before comparing it against a row's
  tenant column, instead of comparing against it directly. This closes a narrow gap where
  certain connection-pooling configurations can leave a database session with an empty string
  instead of a properly cleared value, which previously could coincide with a real row's tenant
  column and let it be read. Shipped as a follow-up migration alongside the original table
  migrations, so existing installs pick up the hardening on their next migrate run.
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/tenancy-rls@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [549dd4e]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 57170c5: Editions go live (ADR-0187 + ADR-0201/0202): live transports proven + retention escalation + support impersonation.

  - `@caisson/audit-worm`: `extendRetention` on the `ArtifactStore` port (strictly-monotonic, never
    shortens — ADR-0202), `escalateToCompliance` on the S3 backend behind the ADR-0051 three-belt gate,
    and the chain-evidenced `escalateRetention` helper (`retention.escalated` on the tenant chain;
    a chain-append failure fails the whole operation loudly). Live S3 Object-Lock proof in `live/`
    (`test:live`, self-skipping — ADR-0201).
  - `@caisson/ai-kit`: `openrouter`/`local`/`ollama` provider lanes moved to
    `@ai-sdk/openai-compatible`, fixing the AI SDK v5 Responses-API default that would have POSTed
    live calls to `{baseURL}/responses` instead of `/chat/completions`; a baseUrl-less `local`/`ollama`
    lane now fails closed instead of silently calling api.openai.com. Live gateway proof in `live/`.
  - `@caisson/local-ai`: `createOpenRouterRentedTransport` — the hosted (non-BYOK, fully-metered)
    rented lane over OpenRouter's OpenAI-compatible wire, egress-guarded and strict-revalidated.
    Live rented + availability-gated ONNX proofs in `live/`.
  - `@caisson/compliance`: the support-impersonation kernel with a dual audit trail (ADR-0187) —
    time-bounded, reason-required sessions; operator + acting-as-tenant records linked by `sessionId`
    on the target tenant's WORM-anchored chain; `impersonation_session` migration (RLS + column-scoped
    GRANT); the impersonation evidence collector cited by both the SOC2 and HIPAA plans.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/tenancy-rls@0.2.0
