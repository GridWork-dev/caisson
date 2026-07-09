# KICKOFF — Caisson Wave 0: shared substrate (field-crypto · registry runtime · cli/generator · kernel primitives)

You are starting the **Wave-0 shared-substrate** build for Caisson, in the worktree
`/home/gw/lab/caisson-wave0` on branch `wave0/shared-substrate`. This file is your complete brief.
Read it top to bottom, then read the repo it points at; you need nothing else to start.

**Read first (in this repo, in order):** `CLAUDE.md` · `docs/state/decisions-and-forks.md` ·
`plan.md` · `specs/00-product-spec.md §5` · the ADRs cited under _Locked context_ below ·
the existing patterns you will extend: `packages/kernel/src/{crypto,errors,index}.ts`,
`packages/credits/src/{credits,schema,credits.integration.test.ts}`,
`packages/tenancy-rls/src/rls.ts`, `registry/schema/{module-manifest,registry-index}.ts`,
`tooling/standards-gate/src/checks.ts`, `tooling/testing/src/{golden,pg}.ts`.

This is an **ULTRACODE** session: spec-first 7-act, orchestrated with the Workflow tool,
research-backed, adversarially verified on every non-trivial claim. The operator sets effort and
launches you. You own SPEC→PLAN, then run the cycle to a green PR. **Never auto-decide a fork** —
the _Forks to resolve FIRST_ section lists every open sub-decision you must put to the operator via
`AskUserQuestion` **before writing code**.

## Mission

Build the **shared substrate that gates the four parallel editions (Wave 1)**. Three of the four
deliverables are hard dependencies for the Compliance hero edition and the Option-C generator
thesis: a production-grade **`@caisson/field-crypto`** package (per-tenant key derivation +
authenticated field encryption + a pluggable KMS port, per ADR-0043), the **registry runtime**
(turning the schema-only `registry/` into a CI-built index with a read/serve path and the generator
allowlist gate, per ADR-0021), the **`create-caisson` CLI + generator skeleton** with the
idempotent codegen-credit debit seam (ADR-0004/0024), and the **shared kernel primitives** (a
SHA-256 append-only audit-chain helper + an append-only versioning helper, per ADR-0006) that the
Compliance edition reuses. Ship them green through the existing `tooling/` standards gate so Wave 1
can start the editions in isolated worktrees without re-deriving any of this. Nothing here is
edition feature code — it is the floor every edition stands on.

## Locked context

You are **bound** by these decisions. Do not relitigate them; implement to them.

- **ADR-0002** (`knowledge/decisions/ADR-0002-engineering-invariants.md`) — TS strict, Bun runtime/PM,
  Zod `.strict()` at every boundary, no `any`/`console.log` in product code, `crypto.randomUUID()`
  for IDs, integer money/credits, append-only versions, `fetchWithTimeout`, `crypto.timingSafeEqual`,
  fail-closed, one `tooling/` standards gate, golden-file before any compliance logic.
- **ADR-0043** (`ADR-0043-field-crypto-per-tenant-keys.md`) — **the spec for deliverable 1.** Base-tier
  per-tenant key derivation `tenant_key = HKDF-SHA256(ikm=MASTER_FIELD_KEY, salt=FIELD_CRYPTO_SALT,
info="caisson-field-crypto:v"||key_version||":"||tenant_id)`; the typed `FieldKeyProvider` port
  (`keyFor(tenantId, keyVersion)` / `currentVersion(tenantId)`) with a `DerivedKeyProvider` default +
  a documented `KmsKeyProvider` (AWS envelope, GCP/Azure/Vault seam); native `crypto.hkdfSync`, no
  added dependency; **the encryption boundary MUST equal the RLS tenant boundary (ADR-0005)**;
  rotation via `key_version` bump + lazy re-encrypt; the cross-tenant-isolation integration test +
  golden-file are mandatory before any evidence logic.
- **ADR-0006** (`ADR-0006-worm-audit-chain-field-crypto.md`) — field-crypto is a Drizzle column
  custom-type (encrypt-on-write/decrypt-on-read) over a key-version rotation registry; the **SHA-256
  append-only audit chain** and **append-only versioning** (supersede-never-mutate, `supersedes_id`
  chain, derived "current" predicate) are the kernel primitives (deliverable 4). "Flag, never guess."
- **ADR-0005** (`ADR-0005-fail-closed-rls-tenancy.md`) — fail-closed multi-tenant RLS; `withTenant`
  (in `packages/tenancy-rls`) is the sole entry to tenant data; the encryption boundary equals this.
- **ADR-0007 + ADR-0024** (`ADR-0007-credit-metering-model.md`, `ADR-0024-credit-idempotency-index.md`)
  — integer wallet, append-only `credit_event` ledger, **debit-before-spend**, 402 on short balance;
  internal/client debits carry a caller `idempotency_key` (UUID), scoped `(account_id, idempotency_key)`,
  23505→idempotent success. `packages/credits` already implements `debit()` — you call it, you do not
  re-build it.
- **ADR-0004** (`ADR-0004-generator-registry-codegen-credits.md`) — `create-caisson` generates a repo
  from the buyer's selection; **every generation meters a credit debit**; the registry is the single
  source the CLI + buyer agent + docs read; a module enters the registry only through the gate.
- **ADR-0021** (`ADR-0021-registry-publish-pipeline.md`) — **the spec for deliverable 2.** Host =
  **GitHub Packages**; `registry/` is the catalog/index, not source; `registry/index.json` is **BUILT
  by a single CI-only job from a git-tracked per-module version ledger** (never hand-appended; sole
  writer via CODEOWNERS + branch protection); the index **IS the generator allowlist** —
  `create-caisson` + the buyer MCP validate module **id + version** against it (parse-or-throw via
  `loadRegistryIndex` / `assertKnownModule` / `assertKnownVersion`, already stubbed in
  `registry/schema/registry-index.ts`) before any path construction or subprocess; bootstrap = empty
  index, first gated publish writes the first entry; backfill is topological.
- **ADR-0020** (`ADR-0020-module-manifest-authoring.md`) — every registry module carries a typed
  `manifest.ts` (`defineModule(...)`) + an SPDX `license` in package.json; the index is built from
  manifests; field-crypto and cli must each ship a conformant manifest.
- **ADR-0022** (`ADR-0022-import-boundary-lint-gates.md`) — three-layer boundary enforcement (ESLint
  `no-restricted-imports` + `@caisson/standards-gate` + dependency-cruiser): AGPL boundary,
  provider-SDK boundary, down-only, manifest↔package.json agreement. New packages must pass all four.
- **ADR-0013** (`ADR-0013-testing-golden-file-harness.md`) — `bun test`; unit `*.test.ts`,
  integration `*.integration.test.ts` on **PGlite** with `SET ROLE app`; golden fixtures at
  `__golden__/<name>.<ext>`, `matchGolden(name, actual)` from `@caisson/testing`, `BLESS=1 bun test`
  is the only sanctioned update path, CI runs with `BLESS` unset.
- **ADR-0019** (`ADR-0019-error-model.md`) — throw `CaissonError` subclasses from `@caisson/kernel`
  only; `InsufficientCreditsError` = the exact 402 shape; tenancy denial = 404; 23505 →
  `ConflictError`; unknown throw → generic 500.
- **ADR-0014** (`ADR-0014-database-orm-migrations.md`) — Drizzle, one schema / three drivers (Neon ·
  node-postgres · PGlite); RLS policies live inside numbered idempotent migrations; `DATABASE_URL`
  never hardcoded.
- **ADR-0044** (`ADR-0044-app-framework-nextjs.md`) — packages never import a framework; reference
  apps standardize on Next.js. (Wave 0 ships no app; relevant only as a non-import constraint.)
- **Board rows** (`docs/state/decisions-and-forks.md`): _Build sequencing_ (Wave 0 → Wave 1 →
  Wave 2 GTM), _Field-crypto keys_ (ADR-0043), _Private registry host_ (GitHub Packages),
  _Credit idempotency_ (ADR-0024), the _P2 pre-work_ flag amending ADR-0006 → ADR-0043. The only
  genuinely _open_ board fork is **Pricing numbers** — not in this session's scope.

The product framing (hero = compliance wedge under a production-rigor umbrella; name + `@caisson/*` +
`caisson.sh` LOCKED) lives in ADR-0040/0041/0042 — context, not something this session touches.

## Scope

Concrete packages/files to build (target paths). Existing files named below are stubs to flesh out.

1. **`packages/field-crypto`** (deliverable 1 — the largest):
   - `src/derive.ts` — `deriveTenantKey(masterKey, salt, keyVersion, tenantId)` via native
     `crypto.hkdfSync("sha256", ...)`, info-string exactly per ADR-0043. Master key read once, never
     logged.
   - `src/provider.ts` — the `FieldKeyProvider` port (typed interface) + `DerivedKeyProvider` (default,
     wraps `derive.ts`). Construct from env (`MASTER_FIELD_KEY`, `FIELD_CRYPTO_SALT`) validated with
     Zod `.strict()`.
   - `src/kms.ts` — `KmsKeyProvider` **documented adapter**: AWS KMS envelope (per-tenant DEK wrapped
     by a KEK), written so GCP KMS / Azure Key Vault / HashiCorp Vault are drop-in alternates selected
     by config. This may ship as a typed, documented, test-doubled adapter (no live AWS call in CI) —
     the seam and the envelope-tagging must be real; the network call is behind the port.
   - `src/cipher.ts` — the AEAD encrypt/decrypt + the **versioned ciphertext envelope** (serialize +
     parse). Decided by Fork 1 + Fork 2.
   - `src/registry.ts` — the **key-version rotation registry** (current version per tenant; older
     versions stay decryptable). Lazy re-encrypt on next write semantics documented.
   - `src/column.ts` — the **Drizzle `customType`** encrypted column (`toDriver` encrypts+serializes,
     `fromDriver` parses+decrypts), bound to a tenant-key resolver.
   - `src/index.ts` — barrel. `manifest.ts` (`defineModule`, `kind: "primitive"`, paid,
     `LicenseRef-Caisson-Commercial`), `AGENTS.md`, `README.md`, `eslint.config.js`, `tsconfig.json`,
     `package.json` (extends `@caisson/{tsconfig,eslint-config,testing}` + depends on `@caisson/kernel`).
   - Tests: `src/cipher.test.ts` (round-trip, tamper→auth-fail, AAD-mismatch→fail), `src/derive.test.ts`
     (KAT vectors), **`src/isolation.integration.test.ts`** (two tenants → distinct derived keys;
     tenant B cannot decrypt tenant A's envelope; rotation: a v1 ciphertext still decrypts after the
     tenant rotates to v2), and a **golden fixture** for the envelope structure (`__golden__/envelope.json`).
2. **registry runtime** (deliverable 2) under `registry/` + `tooling/`:
   - `scripts/build-index.ts` (CI-only index builder): read the **git-tracked version ledger**
     (`registry/ledger.jsonl` — append `{id, version, manifest, attestation, publishedAt}` per gated
     publish) → regenerate `registry/index.json` (validated by `RegistryIndex`). Deterministic;
     golden-fixtured.
   - the **read/serve path**: confirm/extend `loadRegistryIndex` / `moduleAllowlist` /
     `assertKnownModule` / `assertKnownVersion` (already in `registry/schema/registry-index.ts`) as the
     single read API; add `loadRegistryIndexFromFile(path)` (parse-or-throw, no cast).
   - the **CI wiring**: a `registry-index` job that runs the builder and fails if `registry/index.json`
     is not byte-identical to the rebuild (proves the file is CI-built, not hand-edited); `CODEOWNERS`
     already gates the file.
   - **the `@stack`→`@caisson` regex bug (blocking):** `registry/schema/module-manifest.ts:47` and
     `registry/schema/registry-index.ts:9` still use `/^@stack\/[a-z0-9-]+$/`, which **rejects every
     real `@caisson/...` module id** — this breaks the manifest + allowlist the moment a real module
     manifest lands (i.e. this session). Fix both regexes to `/^@caisson\/[a-z0-9-]+$/`; fix the stale
     comment at `tooling/standards-gate/src/checks.ts:185`. Add a test asserting a `@caisson/...` id
     parses and a `@stack/...` id is rejected.
3. **`packages/cli` + generator skeleton** (deliverable 3):
   - `src/generate.ts` — the generator: takes a validated selection (edition + module ids + versions),
     validates **every** id+version against the registry allowlist **before any path/subprocess**
     (`assertKnownModule`/`assertKnownVersion`), then materializes a repo. Engine decided by Fork 5.
   - `src/meter.ts` — the **codegen-credit debit seam**: `meterGeneration(tx, {accountId,
idempotencyKey})` calls `credits.debit({... eventType: "codegen_debit", idempotencyKey})`
     **before** any file is written (debit-before-spend); a `generation` record interface. Integration
     point decided by Fork 6.
   - `src/cli.ts` — the `create-caisson` entry (arg parse + Zod `.strict()` validation; selection from
     flags/prompts). Skeleton: the generation + MCP-drive is fully wired at P5, but the **allowlist
     gate + the debit seam + the idempotency contract are fixed and tested now**.
   - `manifest.ts` (`kind: "base"` or `app-template` — your call, justify), `AGENTS.md`, `README.md`,
     standard config, tests (`src/generate.test.ts` golden-fixtures the generated file SET for a fixed
     selection per ADR-0021 §golden; `src/meter.integration.test.ts` proves debit-before-spend +
     idempotent retry + 402-aborts-with-nothing-written).
4. **shared kernel primitives** (deliverable 4) in `packages/kernel`:
   - `src/audit-chain.ts` — SHA-256 append-only chain: `chainEntry(prevHash, payload)` →
     `{ hash, prevHash, payload }`, genesis for the first; `verifyChain(entries)` → boolean +
     first-broken-index. **Canonicalization is load-bearing**: hash over a deterministic serialization
     (stable key ordering) so the chain is reproducible — document and test it.
   - `src/versioning.ts` — append-only versioning: a `supersedes_id` chain + a derived `current`
     predicate (a version is current iff nothing supersedes it); pure functions, no mutation.
   - export both from `src/index.ts`; unit tests + **golden fixtures** (`__golden__/audit-chain.json`,
     `__golden__/version-chain.json`). These are reused verbatim by the Compliance edition (ADR-0006).

## Forks to resolve FIRST (AskUserQuestion)

Put **each** of these to the operator via `AskUserQuestion` before writing the code it gates. Options
are pre-researched; the first option in each is the evidence-backed recommendation. Do not collapse
them into one mega-question — group at most a few related ones per `AskUserQuestion` call.

**Fork 1 — Field-crypto AEAD cipher.** Which authenticated cipher backs the encrypted column?

- **A) AES-256-GCM via native `node:crypto` (Recommended).** Zero dependency — matches ADR-0043's
  explicit "no added dependency" value (the HKDF step already uses native `crypto`); hardware-
  accelerated (AES-NI); **FIPS 140-approved**, a real selling point for the SOC2/HIPAA Compliance
  _hero_ buyer. The 96-bit-random-nonce ceiling is **2^32 messages per key** (NIST 2^-32 bound) — and
  because keys are **per-tenant-derived** (ADR-0043), that ceiling is _per tenant_ (~4.3B encrypted
  fields), ample headroom. Mitigate GCM's catastrophic nonce-reuse with a fresh CSPRNG 96-bit IV per
  write **and bind `tenant_id || key_version || column-context` as AAD** (Tink's defense against moving
  a ciphertext between rows/tenants/columns). Evidence: libsodium AEAD table (AES256-GCM = 2^32 random-
  nonce msgs); CFRG `draft-irtf-cfrg-aead-limits`; Google Tink AEAD guidance ("AES256_GCM recommended
  for most uses"; AAD = user-id stops cross-user ciphertext moves); `node:crypto` `createCipheriv("aes-256-gcm")`.
- **B) XChaCha20-Poly1305 via libsodium (`sodium-native`/`libsodium-wrappers`).** 192-bit nonce →
  random nonces with _no practical limit_, misuse-resistant; libsodium's recommended choice absent
  hardware AES. Cost: a native/WASM **dependency** (against the zero-dep ethos) and **not FIPS-
  validated** (a deduction for compliance buyers). Evidence: libsodium XChaCha20 construction doc;
  `draft-irtf-cfrg-xchacha-03` (2^80 msgs at 2^-32).
- **C) AEGIS-256 (libsodium ≥1.0.19).** Safest with hardware AES per libsodium's TL;DR, but newer /
  less ubiquitous and no `node:crypto` path. Reject for v1 (immaturity + dependency).
- Regardless of choice, **write the cipher behind an `AeadCipher` seam** so B is a drop-in if a buyer
  needs unlimited-volume-per-key — same swappability ethos as the `FieldKeyProvider` port.

**Fork 2 — Ciphertext envelope / serialization format.** How is the encrypted value serialized on disk?

- **A) Self-describing binary envelope, base64 into a `text` column (Recommended).** Header =
  `[format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce(12B) | ciphertext | tag(16B)]`,
  base64-encoded into a `text` column (or raw into `bytea`). Self-describing → the decrypt path reads
  format-version + alg + key_version _from the value itself_, enabling rotation **and** cipher
  migration with no out-of-band column metadata. Mirrors the AWS Encryption SDK message format (version
  byte first → algorithm id → IV → body → tag) and Tink's `prefix(version||key-hint) || IV ||
ciphertext || tag`. Evidence: AWS ESDK message-format reference; Tink wire-format doc.
- **B) JSON envelope** (`{v,alg,kv,nonce,ct,tag}`, base64 fields) in `text`/`jsonb`. Debuggable +
  trivially versioned, but ~2-3× storage + parse cost per field and invites drift. Keep JSON only as
  the **golden-fixture** representation, not the on-disk format.
- **C) Two columns** (`bytea` ciphertext + `int` key_version sidecar). No parsing, but splits one
  logical value across two columns and fights the one-column Drizzle `customType`. Reject.

**Fork 3 — HKDF salt management.** How is the HKDF salt handled?

- **A) Single per-deployment `FIELD_CRYPTO_SALT` (32B, non-secret, fixed), tenant separation entirely
  in HKDF `info` (Recommended).** Exactly ADR-0043. RFC 5869 §3.1-3.2 + Trail of Bits + Soatok: when
  the IKM is already a uniformly-random key (our 32B `MASTER_FIELD_KEY`), the extract-salt is for
  _domain separation_, not randomness extraction, and per-context separation belongs in `info`
  (which already carries `key_version` + `tenant_id`) — "the security definition says _a_ salt, not
  multiple salts" (Soatok). A fixed deployment salt buys cross-deployment domain separation at zero
  storage cost. Evidence: RFC 5869 §3.1/§3.2; Soatok "Understanding HKDF"; Trail of Bits "Best
  practices for key derivation" (attacker-controlled/per-entity salts are an anti-pattern; put context
  in `info`).
- **B) Per-tenant stored salt (random per tenant).** Re-introduces exactly the key-storage + backup +
  rotation surface ADR-0043 _rejected_ for keys, with no security gain (info already binds tenant_id;
  IKM already random) and an attacker-influence risk if sourced from tenant input. Reject.
- **C) No salt (NULL).** RFC-acceptable for a random IKM, but forgoes free cross-deployment domain
  separation; the fixed non-secret salt is strictly better at zero cost. Reject.
- This fork **confirms ADR-0043** — if the operator picks A, record a one-line confirmation note on the
  board rather than a new ADR (a new ADR only if they deviate).

**Fork 4 — Registry-runtime read-path shape.** How do `create-caisson` + the buyer MCP obtain the index?

- **A) Static CI-built `registry/index.json`, git-tracked, read locally / via the published
  `@caisson/registry` package or GitHub-raw/Pages (Recommended).** Zero infra; matches ADR-0021
  ("index is BUILT by a CI-only job from a git-tracked ledger"); `loadRegistryIndex()` parses the
  static file (parse-or-throw); module tarballs install from **GitHub Packages** via `.npmrc` scope
  mapping (`@caisson:registry=https://npm.pkg.github.com`); edge-cacheable if served from the
  Cloudflare Pages site. The **allowlist** is about _known_ modules; _entitlement_ is a separate gate
  the MCP enforces at request time (ADR-0008) — so the read path needs no server. Evidence: ADR-0021;
  GitHub Docs "Working with the npm registry"; Cloudflare Pages "Install private packages" (`.npmrc` +
  `NPM_TOKEN`).
- **B) A small read service / Cloudflare Worker serving the index + entitlement filtering.** Real and
  proven (npflared, `@vltpkg/vsr` on Workers+R2+D1), but it is **P6 commerce** infra — over-built for a
  Wave-0 read path. Evidence: npflared / `@vltpkg/vsr`. Defer.
- **C) Hit the GitHub Packages registry API live per generation.** Couples generation to GH API rate
  limits (5k/hr) + per-call auth; the index abstraction exists to avoid this. Reject.

**Fork 5 — Generator engine.** How does `create-caisson` materialize a repo?

- **A) Deterministic in-repo template copy + typed transform (degit-pattern, no network)
  (Recommended).** Composition = "select packages → assemble a workspace that installs them from the
  registry + write config/wiring" = file assembly + dependency-list construction, not deep TS
  refactoring. Deterministic and golden-fixture-able (the generated file _set_ is the fixture, ADR-0021
  §golden); no heavy compiler dependency. degit is the proven minimal scaffolder (Rich-Harris/degit,
  ~900k weekly dl, snapshots a repo without git history); since our template is in-repo, a plain
  recursive copy + a typed token/JSON-merge pass beats even degit's fetch. Evidence: degit (npm, MIT);
  mastra `clone-template` (copy + substitution).
- **B) ts-morph AST codemod.** Overkill for v1 — ts-morph (19.8M weekly dl, MIT) shines at _rewriting
  existing_ TS (imports, call graphs); generation here mostly writes whole files + merges JSON. Keep it
  as an optional later wiring pass **behind the same generator seam**. Evidence: ts-morph docs
  ("transforms… not a typical scenario").
- **C) A templating language (EJS/Handlebars/Plop).** Adds a templating runtime + its own injection
  surface; a curated in-repo template + a tiny mustache-style token replace covers v1. Reject as the
  engine.

**Fork 6 — Codegen credit-debit integration point.** Where is the credit debited, and where does the
idempotency key come from?

- **A) Debit-before-spend at the generation entry, keyed by a caller-supplied per-generation
  `idempotency_key` (UUID) (Recommended).** Both `create-caisson` (CLI) and the buyer MCP mint/accept
  one `idempotency_key` per generation and call `credits.debit({accountId, amount, eventType:
"codegen_debit", idempotencyKey})` **before** any file is written; 402 aborts with nothing written; a
  retried generation with the same key is absorbed (one debit). This is exactly ADR-0024's internal
  debit path (`(account_id, idempotency_key)` partial-unique, 23505→idempotent) + ADR-0007 debit-
  before-spend, on the **already-implemented** `packages/credits` `debit()`. Evidence: ADR-0024;
  ADR-0007; `packages/credits/src/credits.ts`.
- **B) Debit-after-success.** Violates debit-before-spend; a runaway agent loop generates without
  paying (the market gap is exactly missing circuit-breakers). Reject.
- **C) Record a `generation` row first, debit from an async job/webhook.** Splits the atomic debit from
  the act and races the 402 gate. Reject — the debit is synchronous + atomic in the same `withTenant`
  txn.

## Research mandate

Run these before locking the forks (you start research-informed — the concrete findings below are
already gathered; re-run to confirm currency and to pull exact API signatures into the code):

- **`get_code_context_exa`** — `"Node.js crypto AES-256-GCM createCipheriv random 12-byte IV auth
tag field encryption"` and `"Drizzle ORM customType toDriver fromDriver encrypted column example"`.
  Grounds: Fork 1 (the exact `createCipheriv`/`getAuthTag` calls) + Fork 2/the `column.ts` custom-type.
  Found: `node:crypto` GCM round-trip needs a fresh random IV per message + `cipher.getAuthTag()` on
  encrypt / `decipher.setAuthTag()` on decrypt (rjz gist; nodejs.org/api/crypto); Drizzle `customType`
  with `toDriver`/`fromDriver` is the sanctioned transparent-encryption hook (orm.drizzle.team/docs/
  custom-types; OmarMcAdam/drizzle-encryption; drizzle-orm issue #2098 — note `toDriver` cannot return
  a raw SQL type, so emit the serialized string).
- **`web_search_exa`** — `"AES-256-GCM 96-bit random nonce 2^32 limit vs XChaCha20-Poly1305 192-bit
nonce field encryption recommendation"`. Grounds Fork 1's nonce-ceiling math. Found: libsodium AEAD
  table — AES256-GCM safe to **2^32** random-nonce messages, XChaCha20-Poly1305-IETF **no practical
  limit**, AES256-GCM "requires hardware support", XChaCha20 "not standardized but widely implemented"
  (doc.libsodium.org/secret-key_cryptography/aead); Filippo Valsorda + Neil Madden + Soatok on the
  96-bit birthday bound (random nonce uncomfortable past 2^32; consequences of reuse catastrophic);
  `draft-irtf-cfrg-aead-limits` (GCM key+nonce reuse limit = 1).
- **`web_search_exa`** — `"versioned ciphertext envelope format version byte algorithm id nonce
ciphertext tag AWS Encryption SDK message format Tink wire format"`. Grounds Fork 2. Found: AWS ESDK
  message format = `Version(1B) | Algorithm ID(2B) | Message ID | ... | IV | body | tag`, version 1
  vs 2 for key-commitment (docs.aws.amazon.com/encryption-sdk/.../message-format.html); Tink AEAD =
  `prefix(1B version + 4B key hint) || IV || ciphertext || tag` (developers.google.com/tink/wire-format).
- **`web_search_exa`** — `"HKDF salt per-tenant vs single fixed application salt info parameter domain
separation RFC 5869 best practice"`. Grounds Fork 3. Found: RFC 5869 §3.1-3.2 (salt = domain
  separation + randomness extraction; `info` binds context/identities); Trail of Bits 2025-01-28
  ("avoid potentially attacker-controlled salts… put context in `info`"); Soatok "Understanding HKDF"
  ("the security def says _a_ salt, not multiple… shove context in `info`"); crypto.stackexchange
  97975 ("uniformly-random IKM → no salt needed for extraction; use `info` for separation").
- **`get_code_context_exa`** — `"degit scaffold template repository copy without git history
programmatic API"` and `"ts-morph Project createSourceFile programmatic code generation add
imports"`. Grounds Fork 5. Found: degit (Rich-Harris/degit, MIT, ~900k weekly dl, snapshots without
  history); ts-morph (dsherret/ts-morph, MIT, 19.8M weekly dl; `Project.createSourceFile` + transforms,
  "not a typical scenario" for plain generation).
- **`get_code_context_exa` / `web_search_exa`** — `"GitHub Packages private npm registry .npmrc scope
mapping"` and `"serve registry index static JSON vs Cloudflare Worker service entitlement read
path"`. Grounds Fork 4. Found: GitHub Packages npm via `.npmrc` `@scope:registry=https://
npm.pkg.github.com` + `_authToken` (docs.github.com); Cloudflare Pages private-registry via `.npmrc`
  - `NPM_TOKEN` (developers.cloudflare.com/pages/how-to/npm-private-registry); npflared / `@vltpkg/vsr`
    prove a Worker+R2+D1 registry is feasible but is heavier than a static index.

**No design/GTM surface exists in Wave 0** — all six forks are backend substrate, so no `refero`
research applies here. GTM/marketing-site design research belongs to the separate Wave-2 GTM session.

## Standards (binding)

Every line of code satisfies all of these; reviewers/auditors block merge on any violation.

- **gridwork-core security floor** (auto-loaded `identity/security.md`): `crypto.timingSafeEqual` for
  every secret/token/key compare (never `===`/`Buffer.compare`) — use `safeEqualFixed`/`safeEqualVariable`
  from `@caisson/kernel`; `execFileSync(cmd, [args])` never string-interpolated shell; Zod
  `.object().strict()` at every boundary; reject paths with `..`/null-bytes/absolute-from-untrusted
  (the generator's module-id/version/path handling is a traversal surface — validate id+version against
  the allowlist _and_ re-assert the slug regex _before_ any path/subprocess, per ADR-0021); no
  `localhost`/`127.0.0.1` fallback in product code; secrets only from env, never logged (the
  `MASTER_FIELD_KEY` is read once and never enters any log/embedding/egress path).
- **Caisson engineering invariants (ADR-0002):** TS strict; Bun runtime/PM (never npm/yarn); no `any`,
  no `console.log` in product code; `crypto.randomUUID()` for IDs; **integer** credits/money (never
  floats); append-only versions (supersede, never mutate); `fetchWithTimeout` on every outbound fetch
  (the native AbortSignal timeout is forbidden on Bun — `@caisson/kernel` `fetchWithTimeout`); fail-
  closed (RLS, 402 credit gate, license checks); a package ships only through the `tooling/` standards
  gate; **golden-file regression before any compliance/evidence logic.**
- **Boundary lint (ADR-0022):** field-crypto + cli pass all four gate checks — AGPL boundary (both are
  `LicenseRef-Caisson-Commercial`, never depend on AGPL), provider-SDK boundary (neither imports a
  provider SDK — only `ai-config`/`ai-kit` may), down-only (a `base`/`primitive` never depends "up" on
  an edition), manifest↔package.json agreement (id/version/license/deps match). Run `bun run gate` +
  eslint + dependency-cruiser locally and in CI.
- **Error model (ADR-0019):** throw `CaissonError` subclasses only; the credit-gate path raises the
  exact `InsufficientCreditsError` 402; a unique-violation maps to `ConflictError` (23505); never
  serialize SQL/stack to a client.
- **Tenancy (ADR-0005):** all field-crypto integration tests and the meter integration test run inside
  `withTenant` on PGlite with `SET ROLE app` (a superuser would BYPASSRLS and mask a fail-closed bug);
  the **encryption boundary equals the RLS tenant boundary** — the cross-tenant decrypt-fails test is
  the proof.
- **Testing (ADR-0013):** `bun test`; integration files `*.integration.test.ts` on PGlite;
  golden fixtures via `matchGolden`, updated only with `BLESS=1`, landing as a reviewed diff; CI runs
  with `BLESS` unset. **Golden-file the envelope, the audit chain, the version chain, and the generated
  file set before the logic that produces each.**
- **AEAD discipline (from research):** a fresh CSPRNG nonce per encrypt; bind `tenant_id || key_version
|| column-context` as AAD; authenticate on decrypt (tamper + AAD-mismatch must throw); never reuse a
  (key, nonce) pair.

(No `ui`/`frontend` surface in Wave 0 → WCAG AA / security-response-headers do not apply here; they
bind the Wave-2 GTM + reference-app sessions.)

## Cadence

Run the full **spec-first 7-act** with the **Workflow tool** as the orchestrator, adversarially
verifying every non-trivial claim (re-derive nonce/limit math, re-run the cross-tenant test from a
clean DB, diff the rebuilt index byte-for-byte):

1. **SPEC** (`outputs/specs/wave0-shared-substrate/`) — restate the goal + the four deliverables +
   the tags (`security`, `secrets`, `external-system` for the KMS adapter, `infra` for the CI index
   job). Declare which forks become ADRs.
2. **PLAN** — atomic tasks with per-task verify commands; order: kernel primitives → field-crypto →
   registry runtime (incl. the `@stack` fix) → cli skeleton. One task = one commit.
3. **AskUserQuestion** the six forks **before** the code each gates. **ADR-lock each NEW fork the
   picker resolves** as an append-only `knowledge/decisions/ADR-NNNN-slug.md` (next free number is
   **ADR-0045**; allocate 0045, 0046, … sequentially for each new locked decision — Fork 1, 2, 4, 5, 6
   are likely new ADRs; Fork 3 confirms ADR-0043 → a board note unless the operator deviates) **and add
   a row to `docs/state/decisions-and-forks.md`**. ADRs are append-only — never edit a locked one;
   supersede.
4. **EXECUTE** — implement to the locked forks; iterate to green against each task's verify; self-
   review before each commit. Conventional atomic commits, scopes `field-crypto` `kernel` `cli`
   `tooling` `registry` `adr` `state`.
5. **VERIFY (goal-backward)** — re-ask the mission against the diff: does field-crypto derive distinct
   per-tenant keys with a cross-tenant decrypt failing? Is the index provably CI-built? Does the
   generator reject an unknown module id+version before any path/subprocess? Does the codegen debit
   fire before any file write and absorb a retry? Does the audit chain verify + detect a break?
6. **SWEEP** — downstream impact: which Wave-1 edition sessions now unblock (Compliance ← field-crypto
   - kernel primitives; P5 ← registry runtime + cli); stale docs (`registry/README.md`, `SUMMARY.md`,
     the board); queued follow-ups (full P5 generation/MCP drive; live KMS wiring).
7. **SHIP** — inline REVIEW always; conditional **SECURITY audit** fires (tags `security`/`secrets`/
   `external-system`) — adversarially verify the crypto + the traversal gate + the KMS seam; open the
   PR; **stop at the merged PR** (DEPLOY is a separate operator-gated act — do not restart/redeploy
   anything).

## Deliverables

- `packages/field-crypto/` — derive · provider (+ DerivedKeyProvider) · kms (documented AWS adapter,
  GCP/Azure/Vault seam) · cipher (AEAD + versioned envelope) · rotation registry · Drizzle column type ·
  barrel · manifest.ts · AGENTS.md · README.md · config; cipher/derive unit tests + the cross-tenant
  isolation integration test + the envelope golden fixture.
- `registry/` runtime — `scripts/build-index.ts` (CI-only builder) · `registry/ledger.jsonl` (git-
  tracked version ledger) · the `loadRegistryIndexFromFile` read path · the `@stack`→`@caisson` regex
  fix (+ test) · the CI `registry-index` byte-identical-rebuild job · golden fixture for the built index.
- `packages/cli/` — generate (allowlist-gated) · meter (debit-before-spend seam) · cli entry ·
  manifest.ts · AGENTS.md · README.md · config; generated-file-set golden fixture + the meter
  integration test.
- `packages/kernel/` — `audit-chain.ts` + `versioning.ts` exported from the barrel; unit tests + two
  golden fixtures.
- New ADRs `knowledge/decisions/ADR-0045-*.md …` (one per new locked fork) + matching rows in
  `docs/state/decisions-and-forks.md`; a board confirmation note for Fork 3 if it confirms ADR-0043.
- Updated `registry/README.md` / `SUMMARY.md` where the runtime changes their claims.
- An opened, green PR off `wave0/shared-substrate` (atomic conventional commits).

## Exit gate

"Done" means **all** of these are verifiably green (run them, read the output — evidence before
assertion):

- `bun install` clean at the repo root; `bun run gate` green (standards gate passes for the new
  packages); `bun run check` clean; eslint + dependency-cruiser green (all four ADR-0022 gates).
- `bun test` green across the repo, including: `field-crypto` round-trip + tamper/AAD-mismatch reject +
  the **cross-tenant isolation integration test** (two tenants → distinct keys; tenant B's decrypt of
  tenant A's envelope **fails**; a pre-rotation v1 ciphertext still decrypts after rotation to v2);
  the **meter integration test** (debit fires before any write; a retried generation with the same
  `idempotency_key` debits once; a short balance returns 402 with nothing written); the audit-chain
  verify + break-detection test; the `@caisson` id parses / `@stack` id rejected test.
- All golden fixtures present and matched with `BLESS` unset (envelope, built index, generated file
  set, audit chain, version chain).
- The registry **index-rebuild is byte-identical**: running `scripts/build-index.ts` from the ledger
  reproduces `registry/index.json` exactly (the CI job fails on any drift), proving the file is CI-built.
- `create-caisson` (skeleton) **rejects an unknown module id and an unknown version before any
  file/subprocess** (a test asserts the throw precedes any path construction).
- Each new locked fork has an append-only ADR (from 0045) + a board row; no locked ADR was edited.
- The PR is open and CI is green; **no service was restarted or redeployed** (DEPLOY is out of scope).

## Out of scope / firewall

- **No edition feature code.** No `audit-worm` S3/WORM, no evidence-pack generator, no AI-Kit metering,
  no local-ai, no agent-dev — those are Wave 1. You build only the shared substrate above. The
  field-crypto column type + kernel primitives are _consumed_ by Compliance later; you do not build
  Compliance.
- **No full P5 generation/MCP drive.** The cli is a **skeleton**: the allowlist gate + the debit seam +
  the idempotency contract are real and tested; the complete agent-driven generation, the buyer MCP
  wiring, and the topological backfill publish are P5. Do not build them — just leave the seams.
- **No live cloud calls in CI.** The `KmsKeyProvider` ships as a typed, documented, test-doubled
  adapter; no real AWS/GCP/Azure/Vault network call runs in CI. The seam + envelope-tagging are real;
  the network is behind the port.
- **No registry read service / Worker** unless the operator picks Fork 4-B (default A = static index).
  No commerce/license issuer, no support-bot, no docs site, no marketing site — those are later waves.
- **No DEPLOY.** SHIP stops at the merged PR; never restart, redeploy, or touch a running service.
- **Pro-private firewall (binding):** **nothing from `media-pipeline` (pro-private) may seed any
  package — patterns/ideas only, never implementation.** The field-crypto/registry/cli work is built
  rebuild-clean; if you reach for a reference, the harvestable license/crypto kit is the PUBLIC
  `tessera`, never `media-pipeline`. Do not relitigate any locked ADR (source-of-truth hierarchy in
  `CLAUDE.md`: board > ADRs > specs > plan/SUMMARY).
