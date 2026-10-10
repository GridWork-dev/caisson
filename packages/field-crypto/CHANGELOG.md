# @caisson-sh/field-crypto

## 1.1.4

### Patch Changes

- 304851a: Correct first-contact documentation: generated projects now tell you to run `bun run test` (bare `bun test` also picks up built output), the WORM retention copy states that GOVERNANCE mode can be bypassed by a principal with the bypass-governance permission while COMPLIANCE mode cannot, and package READMEs no longer refer to product editions or call the drizzle-orm `.forceRLS()` change an issue.
- Updated dependencies [4954dc1]
- Updated dependencies [fa815fc]
- Updated dependencies [e58ddc3]
  - @caisson-sh/kernel@0.10.2

## 1.1.3

### Patch Changes

- 8226c84: The live KMS test's header states the AWS permissions it needs instead of pointing at a provisioning script that is no longer in the repository.
- 73bdf3c: Each package's `manifest.ts` now imports `defineModule` from the sibling `registry-schema` package instead of a monorepo-only directory, so the file resolves wherever `@caisson-sh/registry-schema` is installed next to it.
- 784a846: Each package's metadata now links to its source directory in the public repository.
- 611f1de: Package comments, tests, READMEs and generated templates now describe the reader as an adopter integrating the package into their own app, not a buyer of a Caisson product. Compliance-artifact wording that faced an adopter's own customers now says so explicitly, and internal signing-key and licensing-domain comments no longer reference a retired commercial license issuer.
- 73bdf3c: Every package is now Apache-2.0 and publishes to the public npm registry. Each package ships the Apache LICENSE file, and the registry manifest carries the same license. Nothing needs a license key or a private registry to install.
- 0b02891: Every package now publishes under the `@caisson-sh` npm scope. Update imports and dependencies to the new names; module ids in registry manifests use the same scope.
- Updated dependencies [73bdf3c]
- Updated dependencies [784a846]
- Updated dependencies [611f1de]
- Updated dependencies [73bdf3c]
- Updated dependencies [0b02891]
  - @caisson-sh/kernel@0.10.1

## 1.1.2

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 1.1.1

### Patch Changes

- f669d4a: Add narrow browser decision entries that exclude configuration, event delivery, and fetch-capable
  code. Browser field encryption now imports the restricted kernel surface, while local-privacy offers
  policy admission checks without exposing its network wrapper.

  Note: this code already shipped in the packages published with v2026.08.06.1 — the version cut was
  taken from a base that predated the merge, so this changeset records the bump only.

- 87275f6: Replace ESLint and Prettier with oxlint and oxfmt.

  Linting and formatting now run on the oxc toolchain. The rule floor is unchanged: the same
  no-any, no-console, type-only-import and provider-SDK-boundary rules are enforced, at the same
  severities, and formatting keeps the settings the previous formatter used. Every package here is
  touched by the dependency removal or by the one-pass reformat, so each takes a patch bump; no
  runtime behaviour changes.

  For anyone consuming the shared configuration: the lint config package is renamed, and the lint
  and format commands changed.

- Updated dependencies [f669d4a]
- Updated dependencies [b0e66b6]
- Updated dependencies [2609293]
- Updated dependencies [87275f6]
  - @caisson/kernel@0.9.0

## 1.1.0

### Minor Changes

- 8875592: Both crypto packages gain a browser-safe `./browser` entry point, so the same primitives the server
  runs can now run inside a client bundle, a Cloudflare Worker, or any other WebCrypto-only runtime.

  field-crypto's browser entry carries per-tenant HKDF key derivation, AES-256-GCM seal and open, the
  row-bound additional-authenticated-data tuple, and the self-describing envelope codec, working over
  `Uint8Array` and WebCrypto instead of Buffer and the Node crypto module. It is the same wire format,
  not a parallel one: a value sealed in a browser opens under the server's `decryptField`, a value
  written by `encryptField` opens in a browser, and both directions are pinned byte-for-byte against
  the shipped fixtures. The new names sit alongside the existing ones rather than replacing them —
  `deriveTenantKeyAsync`, `aesGcmSealAsync`, `aesGcmOpenAsync`, `buildAadBytes`,
  `serializeEnvelopeBytes`, `parseEnvelopeBytes`, plus `nextKeyVersion` and `MAX_KEY_VERSION` for the
  rotation bound the key-version registry already enforced. One behavior note: parsing an envelope
  accepts both standard and URL-safe base64, preserving values the previous Node decoder could read;
  whitespace is still tolerated and malformed values fail closed. The public seal operation always
  generates its own fresh nonce, matching the Node cipher without exposing a caller override.

  signing-primitive's browser entry carries the verify half: the signable-payload construction,
  `verifyEvidenceSignature`, and the RFC-3161 test-double authority, so a relying party can check an
  evidence pack's provenance entirely in their own browser. Nothing about the signature scheme
  changed — the browser path runs the very same Ed25519 primitive the signer does, because that
  primitive never needed Node in the first place. The signing identity stays off the browser entry
  deliberately: a tenant seed does not belong in a bundle end users download. Two additions on both
  entries: `hexToBytes` for decoding a signature or key, and
  `timestampCountersignsSignatureAsync`, the WebCrypto twin of the existing timestamp check, which
  keeps its synchronous form and uses a fixed-work digest comparison without importing Node crypto.

  Both packages now declare a Node 20.12 minimum, and every export the main entry offered before is
  still there with the same name and shape. The site's field-crypto and signing-primitive interactive
  demos now run those shipped packages directly instead of hand-maintained copies of them, and the
  shared test harness gained a scan for Node-only globals to go with its existing module-graph walk.

### Patch Changes

- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 1.0.1

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 1.0.0

### Major Changes

- 31bf5f1: Return provider-proven deletion receipts from every KMS adapter, thread finality through crypto-shred receipts, and add Azure Key Vault support.

### Minor Changes

- 13e814d: Add disposable request-scoped KMS contexts with append-only Postgres wrapped-key persistence,
  wire production BYOK to purge-protected Azure Key Vault keys, and let MCP run tools bind an async
  field-crypto context and its tenant executor in one atomic transaction without retaining plaintext
  keys between requests.

  BREAKING for direct API consumers, carried as a minor bump because these packages are pre-1.0:

  - `RunToolsDeps.keyProvider` (a `SyncFieldKeyProvider`) is REMOVED from `buildRunTools` and
    replaced by a required `fieldCryptoContext` runner. Callers passing a key provider no longer
    compile.
  - `WrappedKeyStore` gains a required `putWrappedIfAbsent` member, so any external implementation
    of that interface must add it.

  Also bounds request-context prefetch with a new `maxPrefetchVersions` option (default 64), so a
  tenant whose rotation depth exceeds what the request budget can serve fails with an error naming
  that depth instead of an anonymous deadline timeout; accepts AWS multi-Region `mrk-` key
  identifiers and reports replica-pending deletion without inventing a deletion date; requires an
  explicit Azure service principal rather than resolving an ambient credential chain; and erases key
  material returned by a provider call that completes after its deadline already elapsed.

- 0d87855: Breaking: `FieldCryptoContext.deriveKey(version)` is replaced by `withKey(version, use)`. The context now lends a key buffer for one operation and zeroizes it when that operation returns or throws, instead of returning a buffer the caller retains until request exit. Sequential operations no longer accumulate working copies; nested calls hold one copy per active invocation, and a KMS context's prefetched key versions remain resident for the request as before. Callbacks must be synchronous — a promise-returning callback is now a type error and is also refused at runtime, because the key is wiped before the continuation would run.

  Also breaking for implementers of `SyncFieldKeyProvider`: `deriveKey()` must return fresh, caller-owned material. The signature is unchanged, but the derived context now zeroizes what it returns in place, so a provider that returns a cached buffer has that cache wiped by the first operation. Previously only `keyFor()` carried this requirement. A provider that violates it is rejected with an all-zero-key error rather than silently encrypting under a known key; KMS providers returning an all-zero DEK are rejected at bind for the same reason.

  Direct callers and context implementers must migrate. `FieldKeyProvider.keyFor` is unchanged.

### Patch Changes

- 96aa01d: Make price authority total over every sellable commercial module and bundle, remove the old $49
  placeholder exemption, mark retired aliases as non-sellable, and pin the current $1,649 Compliance
  price in component demos and fulfillment coverage.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.3.5

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.3.4

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.3.3

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.3.2

### Patch Changes

- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.3.0

### Minor Changes

- 8c53ca3: field-crypto ships a real GCP Cloud KMS driver (`createGcpKmsClient`) beside
  the existing AWS driver: injected config, `ConfigError` fail-closed, per-tenant CryptoKey targeting
  with an `additionalAuthenticatedData` scope binding, and version-scoped crypto-shred via
  `destroyCryptoKeyVersion`. Registered in the shared `KmsClient` port-conformance suite; a self-skipping
  `live/kms-gcp.live.test.ts` proves the real adapter stack end to end against a throwaway per-run
  CryptoKey (GCP KeyRings/CryptoKeys can't be deleted, so the fixture KeyRing is pre-provisioned via
  `CAISSON_KMS_GCP_KEY_RING`; only the CryptoKey and its primary version are minted/destroyed per run).

  ai-config's provider lane enum gains three named OpenAI-compatible vendors — `groq`, `mistral`,
  `together` — following the same `apiKeyEnv`-required rule as `openai`/
  `openrouter`. ai-kit's `providerFor` wires all three over `createOpenAICompatible` with a hardcoded
  default `baseUrl` per vendor (Groq `https://api.groq.com/openai/v1`, Mistral
  `https://api.mistral.ai/v1`, Together `https://api.together.xyz/v1`, each overridable), and fails
  closed when the named `apiKeyEnv` resolves to no value (these are paid vendor APIs, unlike the
  `local`/`ollama` placeholder key).

## 0.2.4

### Patch Changes

- b791198: Documentation and metadata cleanup plus dependency-declaration hygiene: package descriptions, READMEs, changelogs, and source comments no longer carry internal build references, and shared external dependency ranges now resolve through the workspace dependency catalog (published dependency ranges unchanged; the TypeScript devDependency floor moves to ^5.7.3).
- 0af4dbf: Rewrote README, AGENTS, CHANGELOG, package.json descriptions, and inline source comments to
  read as clean, buyer-facing documentation. Removed sibling-repository provenance framing,
  internal build-phase shorthand, and bare specification-id citations that had leaked into
  shipped copy. No runtime behavior changed in any package — documentation and comments only.
- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2

## 0.2.3

### Patch Changes

- cf66d65: Hardened row-level security on the key-version and wrapped-key tables: the tenant-isolation
  check now discards an empty-string tenant identifier before comparing it against a row's
  tenant column, instead of comparing against it directly. This closes a narrow gap where
  certain connection-pooling configurations can leave a database session with an empty string
  instead of a properly cleared value, which previously could coincide with a real row's tenant
  column and let it be read. Shipped as a follow-up migration alongside the original table
  migration, so existing installs pick up the hardening on their next migrate run without any
  data loss or re-encryption.
- cf66d65: Documented and test-hardened the key-rotation contract for encrypted fields: rotating a
  tenant's key version never requires re-encrypting existing data. Every stored value already
  carries the key version it was written under, so old rows keep decrypting under their original
  key while new writes pick up the current one automatically. Added an explicit test proving the
  rotated key is actually different key material (not just a different version label) and a
  doc comment spelling out the no-remigration guarantee for anyone implementing a custom key
  provider.
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0

## 0.2.1

### Patch Changes

- 081a1d8: Live seams: cloud-KMS envelope proof + ONNX EgressGuard unification (ADR-0221, extends ADR-0201).

  field-crypto: a gated `live/kms.live.test.ts` (`test:live`) drives the real adapter stack —
  `createAwsKmsClient` → `KmsKeyProvider` → `TenantFieldCrypto.encryptField/decryptField` →
  `cryptoShred` — against freshly minted, throwaway AWS CMKs: envelope round-trip through a real
  wrapped DEK, per-tenant CMK isolation, and a real crypto-shred verified by an independent
  `DescribeKey` (the first live exercise of the ADR-0197 blast-radius fix). Self-skips without
  `CAISSON_KMS_LIVE` + AWS creds; no `src/` change (print-only `infra/kms/provision.ts` emits the
  tag-scoped prover statements to add to the shared WORM prover, KMS-1=A1 / KMS-2=B2).

  local-ai: the ONNX backend's inline `#guardedFetch` host/scheme check is unified onto the shared
  `EgressGuard` (`model-fetch` sink kind, F2=B) so the model-fetch and rented lanes prove egress at the
  same shared-policy layer; the SHA-256 hash-pin (TM-MODEL) stays inline. The `onnx.live.test.ts`
  egress-block leg now asserts the shared-guard fail-closed, plus a new guard leg mirroring the rented
  lane's `liveGuard()`.

- f9d58c4: Test and proof hygiene, no runtime behavior change for buyers: the live KMS proof
  now schedules deletion for both throwaway CMKs defensively in `afterAll`, not just the one
  the last leg reached.

- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0

## 0.2.0

### Minor Changes

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

- 72ffd85: Whole-repo audit remediation (rounds 1+2, ledger 2026-07-01): LemonSqueezy credit-grant idempotency keys off the stable resource composite (never webhook_id); BYOK zero-cost gated to a per-action allowlist, default metered (ADR-0198); AWS KMS driver honors per-tenant CMKs and refuses keyId-less crypto-shred (ADR-0197); BYOK baseUrl SSRF guard (https-only, private/metadata ranges rejected); request-span low-cardinality span names + scrubbed http.route; field-crypto-policy evidence collector emits sorted arrays (deterministic canonical body); entitlements free-view docstring corrected to ADR-0136.
- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
