# @caisson/signing-primitive

## 0.4.3

### Patch Changes

- 73bdf3c: Package descriptions, READMEs and agent notes now describe what each package does, with no prices, paid tiers or license-key requirements. The standards gate fails when a published package's description or README mentions a commercial tier or a dollar price.
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

## 0.4.2

### Patch Changes

- Updated dependencies [87b07c6]
- Updated dependencies [7d39669]
- Updated dependencies [498b279]
  - @caisson/kernel@0.10.0

## 0.4.1

### Patch Changes

- 2405d9e: Remove unused dependencies and unreferenced internal helpers, relocate integration coverage to the package seams it verifies, and consolidate repeated build and test plumbing. The CLI no longer exports the obsolete minimal `defaultEngine`; use `templatesEngine` or inject a `GeneratorEngine`.
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

## 0.4.0

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

- 98bf1f3: Routine non-major dependency refresh: the OpenTelemetry SDK/instrumentation line moves to its
  current minor, Playwright takes a patch, and the Storybook, Vite, wrangler, noble-curves, and
  better-auth pins stay at their prior versions because the newer releases have not yet cleared the
  seven-day release-age floor. No API or behavior changes in any package.
- Updated dependencies [7d74f8f]
  - @caisson/kernel@0.8.0

## 0.3.9

### Patch Changes

- f2cb853: `@caisson/kernel`'s main entry point is now browser-safe. Everything that needs a Node built-in — constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard — moved to a new `@caisson/kernel/node` entry point. The main entry keeps the error model, the strict-schema helpers, canonical serialization and the audit-chain types, the money and version types, the timeout-bounded fetch, and the event sink.

  Server-side code that used one of the moved functions changes a single import path: `@caisson/kernel/node` re-exports the main entry in full, so nothing else in that import list has to move. Nothing changed about what any of these functions do.

  This is what lets packages built on the kernel — the trust-page generator and the artifact renderer among them — be imported directly into a browser bundle. Previously any import of the kernel dragged Node's crypto and DNS modules along with it, and a front end had to keep its own hand-written copy of that logic in step by hand. `@caisson/frameworks-pack` gains a matching `@caisson/frameworks-pack/registry` entry point exposing the control model on its own, for the same reason; its main entry is unchanged.

- Updated dependencies [e917c52]
- Updated dependencies [f2cb853]
  - @caisson/kernel@0.7.0

## 0.3.8

### Patch Changes

- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0

## 0.3.7

### Patch Changes

- 3b9237b: Rebuilt against current dependency resolutions; no source changes.

## 0.3.6

### Patch Changes

- 31d59fd: Rebuilt against current dependency resolutions; no source changes.

## 0.3.5

### Patch Changes

- c36b9e2: Builds now compile with the native TypeScript 7 compiler. The emitted type declarations are unchanged in API; some inferred type members appear in a different order in .d.ts files. Aggregate compile time drops roughly sevenfold.
- Updated dependencies [c36b9e2]
  - @caisson/kernel@0.5.3

## 0.3.4

### Patch Changes

- 302b521: Rebuilt against this release's refreshed dependency resolution so the published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.3.3

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2

## 0.3.2

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1

## 0.3.1

### Patch Changes

- 4c6d3f7: Rebuilt against this release's updated platform dependencies so each published artifact
  matches its recorded checksum exactly. No functional changes.

## 0.3.0

### Minor Changes

- 1de88d7: Adds an `Ed25519PhSigner` — the deployment-level Ed25519ph anchoring signer for external anchoring
  (Fork R-α). Rekor v2 `hashedrekord` rejects a pure Ed25519 signature (it re-hashes a message it is only
  given the digest of), so anchoring binds a deployment key via the RFC-8032 §5.1 prehash variant over
  `@noble/curves`. It implements the shared `Signer` port with `algorithm: "ed25519ph"`, holds its 32-byte
  seed in a private field (never logged/serialized), and loads from `CAISSON_REKOR_ANCHORING_KEY` via
  `fromEnv` (fail-closed on a missing/wrong-length seed). Distinct from `@caisson/audit-worm`'s per-anchor
  `Ed25519AnchorSigner`. The `SignatureAlgorithm` type widens to `"ed25519" | "ed25519ph"`; the existing
  pure-Ed25519 evidence-pack signing path is unchanged. Adds `@noble/curves`.

## 0.2.2

### Patch Changes

- c186409: Wire the mirrored evidence-pack goldens to the compliance-core v2 format bump (the new
  `crosswalkRollup` section): re-blesses each package's static copy of the evidence-pack manifest
  golden and, for `@caisson/signing-primitive`, regenerates the golden detached Ed25519 signature over
  the new canonical bytes (same fixed test key; public key unchanged). No behavior change, fixture
  parity only.
- Updated dependencies [e5e4311]
- Updated dependencies [e183860]
  - @caisson/kernel@0.5.0

## 0.2.1

### Patch Changes

- Updated dependencies [2b65cf3]
- Updated dependencies [8253e76]
  - @caisson/kernel@0.4.3

## 0.2.0

### Minor Changes

- f01b6ed: Splits the Compliance edition into three separately purchasable modules — the framework
  catalogs (`@caisson/frameworks-pack`), the per-tenant evidence signer
  (`@caisson/signing-primitive`), and the evidence engine (`@caisson/compliance-core`) — while
  the Compliance edition keeps composing all three. The public API is unchanged: every symbol
  that was importable from `@caisson/compliance` still is.

### Patch Changes

- Updated dependencies [b791198]
- Updated dependencies [0af4dbf]
  - @caisson/kernel@0.4.2
