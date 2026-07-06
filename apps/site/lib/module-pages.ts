// The 11 standalone-module depth-page records (ADR-0237 F2) — generated 2026-07-03 from the
// adversarially-reviewed copy workflow output, with the entitlement-honesty overrides applied
// (ai-evals is standalone-only: no edition or bundle grants it — registry members map truth,
// pinned by pricing.test.ts). Checked-in source from here on: edit records in place; keep every
// claim true-to-built (ADR-0082) and V1-live (ADR-0237 rider 2).
//
// `modulePageSpec` (module-page-spec.tsx) turns a record into the PageSpec the shared
// <PageSections> renderer consumes; the buy rail is page chrome, not a section.

/** One artifact proof block: real package code, cited by file. */
export interface ModulePageArtifact {
  label: string;
  lang: "ts" | "sql" | "toml" | "bash";
  /** Repo path the code is lifted from — rendered as the CodeBlock label suffix. */
  file: string;
  code: string;
}

export interface ModulePageRecord {
  /** = ModulePrice.id — the cart key, route param, and mark key. */
  slug: string;
  metaTitle: string;
  metaDescription: string;
  /** Hero lede — one sentence, answer-first. */
  heroOneLiner: string;
  /** 40-70 word definition ("What it is"). */
  definition: string;
  /** 4-6 included capabilities (→ featureGrid). */
  included: readonly { title: string; body: string }[];
  artifact: ModulePageArtifact;
  faq: readonly { question: string; answer: string }[];
  /** Curated glossary cross-links — every slug resolves in GLOSSARY_TERMS (lint in tests). */
  relatedGlossary: readonly string[];
  /** How this module is sold relative to its edition family — entitlement-honest. */
  sells: { edition: string; note: string };
  /** A produced media asset for this module's `media` section (ADR-0263) — omitted means the
   *  page still gets the plain icon placeholder. Only set once a render has actually shipped. */
  video?: { src: string; poster?: string };
}

export const MODULE_PAGES: readonly ModulePageRecord[] = [
  {
    slug: "field-crypto",
    metaTitle: "Field Encryption — Per-Tenant AES-256-GCM | Caisson",
    metaDescription:
      "A distinct HKDF-SHA256 key per tenant, a self-describing AES-256-GCM envelope, and AAD that refuses a ciphertext moved across tenants, columns, or rows.",
    heroOneLiner:
      "One key per tenant, derived not stored — a ciphertext moved to another tenant fails to decrypt, provably.",
    definition:
      "field-crypto derives a distinct AES-256-GCM key per tenant with HKDF-SHA256, seals values into a self-describing envelope, and binds tenant, column, and row identity into the AEAD's additional authenticated data — so a ciphertext copied to another tenant, column, or row fails to decrypt. A pluggable KMS seam and crypto-shred erasure ship in the same package.",
    included: [
      {
        title: "Fail-closed on every read and write",
        body: "encryptedColumn() wires a Drizzle customType whose toDriver/fromDriver only run inside withFieldCryptoContext. Reach an encrypted column with no bound tenant context and currentFieldCryptoContext() throws InternalError instead of returning a partial or unscoped result.",
      },
      {
        title: "Per-tenant key, derived not stored",
        body: "deriveTenantKey() runs HKDF-SHA256 over a 32-byte MASTER_FIELD_KEY and a 32-byte FIELD_CRYPTO_SALT, folding the tenant id and key version into the HKDF info string. There is no key table to back up or leak — DerivedKeyProvider re-derives the key on demand.",
      },
      {
        title: "AAD binds tenant, column, and row",
        body: "buildAad() serializes a JSON tuple — tenant id, key version, column context, and, for row-bound fields, the row's UUID — as GCM's additional authenticated data. Relocate the ciphertext to another tenant, column, or row and decryption fails as an AEAD authentication error, never a silent wrong-plaintext read.",
      },
      {
        title: "Self-describing envelope survives rotation",
        body: "serializeEnvelope() packs format version, algorithm id, and key version ahead of the nonce, ciphertext, and tag into one base64 string; parseEnvelope() reads the version back off the value itself. KeyVersionRegistry.rotate() bumps a tenant forward with no bulk re-encrypt job — older envelopes keep decrypting under the version they were written with.",
      },
      {
        title: "KMS envelope encryption behind one port",
        body: "KmsKeyProvider wraps a per-tenant data-encryption key under a KMS-held key-encryption key that never leaves the KMS — only the wrapped DEK is persisted. awsKmsClient() is the wired AWS driver; the same three-method KmsClient port is the seam a GCP, Azure Key Vault, or Vault Transit driver drops into.",
      },
      {
        title: "Crypto-shred erasure without breaking the audit chain",
        body: "cryptoShred() schedules KEK deletion through the KMS port and mints an erasure.crypto-shred audit payload that carries no PII. Every ciphertext under that key becomes permanently unrecoverable while the WORM-anchored hash chain's committed bytes never change — verifyChain still passes after the shred.",
      },
    ],
    artifact: {
      label: "TenantFieldCrypto.decryptField — the isolation proof",
      lang: "ts",
      file: "packages/field-crypto/src/crypto.ts",
      code: '  /**\n   * Decrypt a stored envelope for `tenantId`. The key version + algorithm come FROM the envelope\n   * (self-describing, ADR-0046), so a value written under an older version still decrypts after\n   * rotation. Throws on tamper, an AAD mismatch, or a cross-tenant key (the isolation proof).\n   */\n  async decryptField(\n    tenantId: string,\n    stored: string,\n    columnContext: string,\n  ): Promise<string> {\n    const env = parseEnvelope(stored);\n    const key = await this.provider.keyFor(tenantId, env.keyVersion);\n    const aad = buildAad(tenantId, env.keyVersion, columnContext);\n    const cipher = cipherForAlg(env.algId);\n    const plaintext = cipher.decrypt(\n      key,\n      { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },\n      aad,\n    );\n    return plaintext.toString("utf8");\n  }',
    },
    faq: [
      {
        question: "Does field encryption make us HIPAA or SOC 2 compliant?",
        answer:
          "No — no module makes an organization compliant; that determination is your organization's and its auditor's to make. field-crypto ships the technical control both frameworks point at for data at rest: a distinct key per tenant and cryptographic proof, not a policy statement, that a ciphertext can't cross tenant boundaries.",
      },
      {
        question: "What happens when I rotate a tenant's key?",
        answer:
          "KeyVersionRegistry.rotate() bumps the tenant to the next version; new writes encrypt under it immediately. There's no bulk re-encrypt job — every envelope carries its own key_version, so a value written under an older version keeps decrypting until its next write lazily re-encrypts it under the current one.",
      },
      {
        question: "Can I use our own KMS instead of the derived key?",
        answer:
          "Yes. FieldKeyProvider is a two-method port — keyFor and currentVersion. DerivedKeyProvider (HKDF, zero infra) is the default; KmsKeyProvider wraps a per-tenant DEK under AWS KMS today through awsKmsClient(). GCP, Azure Key Vault, and Vault Transit map cleanly onto the same three-method KmsClient port — implement it to plug them in.",
      },
      {
        question:
          "How does this handle a GDPR or CCPA erasure request without breaking our immutable audit log?",
        answer:
          "cryptoShred() destroys the tenant or subject's key-encryption key through the KMS port, so every ciphertext under it becomes permanently unrecoverable — while the append-only WORM chain never mutates, because it only ever committed the ciphertext envelope, never plaintext. The chain's verifyChain() still passes after a shred.",
      },
    ],
    relatedGlossary: ["hipaa-technical-safeguards", "row-level-security"],
    sells: {
      edition: "Compliance",
      note: "Sold standalone at $199, or as one of the primitives composing the $799 Compliance edition alongside audit-worm, retention-runner, and the alert pipeline.",
    },
  },
  {
    slug: "audit-worm",
    metaTitle: "Audit Chain + WORM — append-only audit log | Caisson",
    metaDescription:
      "Append-only SHA-256 audit chain with a write-once WORM anchor per entry, plus an S3 Object-Lock store. Tamper, truncation, and rewrite all surface on verify.",
    heroOneLiner:
      "An audit log that proves it wasn't edited: hash-chained entries, a write-once anchor per append, and an S3 Object-Lock store underneath.",
    definition:
      "Audit Chain + WORM is Caisson's evidentiary primitive: an append-only SHA-256 hash chain (AuditChainStore) anchored to a write-once WORM object on every append, plus the S3 Object-Lock artifact store (S3ArtifactStore) it anchors into and an append-only locked-version table with a derived current. Three composable layers, each enforced by a different mechanism, over the kernel's pure chain algebra.",
    included: [
      {
        title: "Append-only hash chain, three independent locks",
        body: "AuditChainStore.append composes the kernel's canonicalize/chainEntry/anchorChain functions, writes each entry to a table whose migration grants the app role SELECT + INSERT only (no UPDATE/DELETE), serializes appends per tenant under a pg_advisory_xact_lock, and mints a fresh WORM anchor after every entry; a UNIQUE(account_id, seq) constraint is the hard belt if two appends race.",
      },
      {
        title: "Verify catches tamper, reorder, and truncation",
        body: "AuditChainStore.verify recomputes the hash chain against the trusted WORM anchor and treats the anchor store as the length oracle: if an anchor exists for a length beyond what the DB can currently produce, the tail was cut, and verify fails even though the surviving prefix hashes clean on its own.",
      },
      {
        title: "S3 Object-Lock backend, write-once by construction",
        body: "S3ArtifactStore.put is a conditional IfNoneMatch: '*' PUT; S3 answers 412 on an existing key, which the store turns into ArtifactExistsError. GOVERNANCE mode is the default everywhere; COMPLIANCE mode (SEC-17a-4 grade, irreversible until retain_until) requires a typed irreversibleComplianceOptIn() naming the exact bucket and only builds under NODE_ENV==='production', never under a test runner.",
      },
      {
        title: "Retention floor and monotonic escalation",
        body: "retainUntilFrom enforces MIN_RETENTION_YEARS=6 (HIPAA §164.316(b)(2) and SEC 17a-4 both floor at six years) and defaults new locks to 7; a term below the floor throws rather than silently rounding up. extendRetention only accepts a strictly-later date, and escalateToCompliance hardens GOVERNANCE→COMPLIANCE through the same three-belt gate as a write-time COMPLIANCE store; no code path ever shortens a lock or de-escalates it.",
      },
      {
        title: "Locked-version table with a derived current",
        body: "LockedVersionStore never stores a 'current' flag: insertVersion appends under an advisory lock with a UNIQUE(account_id, supersedes_id) constraint (a fork hits the belt and rolls back), and currentVersions/currentVersion derive the tip two independent ways (a no-successor SQL predicate and the kernel's currentVersions() over the loaded set), throwing if the two ever disagree.",
      },
    ],
    artifact: {
      label:
        "AuditChainStore.verify: the WORM store as trusted length oracle, catching tail truncation a clean-hashing prefix would otherwise hide",
      lang: "ts",
      file: "packages/audit-worm/src/chain-store.ts",
      code: "  async verify(accountId: string): Promise<ChainVerification> {\n    return withTenant(this.db, accountId, async (tx) => {\n      const entries = await loadEntries(tx, accountId);\n\n      // Truncation guard (TM-I): the WORM store is the trusted length oracle. An anchor for a length\n      // past what the DB can now produce means the tail was dropped — invalid even if the surviving\n      // prefix is internally consistent (which, being a true prefix, it always is).\n      const beyond = await this.store.head(\n        anchorKey(accountId, entries.length + 1),\n      );\n      if (beyond !== null) {\n        return { valid: false, brokenAt: entries.length };\n      }\n      if (entries.length === 0) {\n        return { valid: true, brokenAt: null };\n      }\n\n      const anchorObj = await this.store.get(\n        anchorKey(accountId, entries.length),\n      );\n      const anchor = decodeAnchor(anchorObj.body);\n      return verifyChain(entries, anchor);\n    });\n  }",
    },
    faq: [
      {
        question:
          "Can an admin (or Caisson) edit or delete an entry after it's written?",
        answer:
          "No. The migration for audit_chain_entry grants the app role SELECT and INSERT only: UPDATE and DELETE are withheld at the privilege level, not just by application convention. Even a compromised app connection can't rewrite a committed entry through SQL.",
      },
      {
        question:
          "What actually stops someone truncating the tail of the chain and re-appending?",
        answer:
          "Every append mints a fresh anchor keyed by chain length and writes it to the WORM store under a write-once key. verify() checks whether an anchor exists for a length beyond what the DB currently holds: if it does, the tail was cut, even though the surviving rows still hash together cleanly as a valid prefix.",
      },
      {
        question: "Does this need AWS, or is there a local option?",
        answer:
          "The package ships a LocalArtifactStore (a retention-ignored filesystem double) for dev/CI and an S3ArtifactStore for production, both implementing the same ArtifactStore port. The S3 path was proven live against a real Object-Lock bucket on 2026-07-01; the local store never claims Object-Lock guarantees.",
      },
      {
        question:
          "If I buy this standalone, do I also get retention policy scheduling?",
        answer:
          "No. Audit Chain + WORM is the storage and verification primitive (chain, anchor, S3 Object-Lock, retention floor/escalation). Scheduled expiry and legal-hold enforcement is the separate Retention Runner module; Compliance composes both.",
      },
    ],
    relatedGlossary: [
      "worm-audit-log",
      "hash-chain-audit-trail",
      "s3-object-lock",
    ],
    sells: {
      edition: "compliance",
      note: "Every evidence collector in Compliance chains through this store: buy it standalone to anchor your own audit trail, or get it composed for you inside the Compliance edition.",
    },
    // The ADR-0263 pilot render: append -> tamper-attempt -> verify-catches-it, produced from
    // apps/site/remotion/AuditWormDemo.tsx via `bun run remotion:render`.
    video: { src: "/videos/audit-worm-demo.mp4" },
  },
  {
    slug: "retention-runner",
    metaTitle: "Retention Runner — CCPA/GDPR Erasure Module | Caisson",
    metaDescription:
      "The right-to-erasure runner in Caisson's Compliance edition: multi-store erasure, per-target failure isolation, one audit row per run — scheduled or on request.",
    heroOneLiner:
      "One erasure request, every store, one audit row — even when a target fails.",
    definition:
      "Retention runner is Caisson's CCPA/GDPR right-to-erasure module: `runErasure` fans one subject's erasure out across every registered store (object storage, cascade DB, orphan sweep), isolates each target's failure so one broken store never blocks the others, and writes exactly one reason-tagged audit row per run.",
    included: [
      {
        title: "Three reference erasure targets",
        body: "createObjectStorageTarget, createCascadeDbTarget, and createOrphanSweepTarget each take an injected minimal client (purge / cascadeDelete / sweep) — the real S3 or Postgres client is a documented seam, never a package dependency. No aws-sdk or pg import ships in retention-runner itself.",
      },
      {
        title: "Per-target error isolation",
        body: "eraseOne catches every target's throw into a TargetResult ({ target, ok, error? }) instead of letting it propagate. runErasure runs all targets and always returns a full result set — a failing object-storage purge doesn't stop the cascade DB delete from running.",
      },
      {
        title: "One reason-tagged audit row per run",
        body: "erasureReasonSchema is a closed Zod enum — auto_90d, ccpa_request, or operator_manual; an unrecognized reason fails parseStrict before any target runs. The row lands in retention_audit (migration 0001), and migration 0002 adds FORCE ROW LEVEL SECURITY scoped to app.current_account so one tenant's erasure history can't leak into another's query.",
      },
      {
        title: "Recurring auto_90d sweep on @caisson/jobs",
        body: "defineRetentionTask returns a TaskDefinition for @caisson/jobs; enqueueAutoSweep enqueues it under a singletonKey of `${tenantId}:${subjectId}` so a long-running erasure can't double-run for the same subject while distinct subjects still sweep in parallel.",
      },
      {
        title: "Deterministic, testable runs",
        body: "runErasure takes an injected now: () => number clock (defaults to Date.now) instead of calling the real clock inline — every test in run-erasure.test.ts pins a fixed timestamp and asserts the exact audit row written.",
      },
    ],
    artifact: {
      label:
        "runErasure — validate, fan out with isolation, write one audit row",
      lang: "ts",
      file: "packages/retention-runner/src/run-erasure.ts",
      code: "export async function runErasure(\n  request: ErasureRequest,\n  targets: ErasureTarget[],\n  sink: RetentionAuditSink,\n  now: () => number = Date.now,\n): Promise<RetentionRunResult> {\n  const { subjectId, tenantId, reason } = parseStrict(\n    erasureRequestSchema,\n    request,\n  );\n\n  const results = await Promise.all(\n    targets.map((target) => eraseOne(target, subjectId, tenantId)),\n  );\n\n  const row: RetentionRunResult = {\n    subjectId,\n    tenantId,\n    reason,\n    results,\n    at: now(),\n  };\n  await sink.record(row);\n  return row;\n}",
    },
    faq: [
      {
        question:
          "Does retention runner delete data automatically, or do I trigger it myself?",
        answer:
          "Both. auto_90d is the recurring scheduled sweep — enqueueAutoSweep puts one job per subject due for erasure onto a @caisson/jobs queue. ccpa_request and operator_manual are one-shot calls straight into runErasure with no queue involved, for a subject request or an operator-initiated erasure.",
      },
      {
        question:
          "What happens if one of my storage targets is down mid-erasure?",
        answer:
          "The other targets still run. eraseOne catches each target's throw into a TargetResult instead of aborting the run, so the audit row records exactly which stores succeeded and which failed (with the error message) rather than leaving the whole erasure half-done and unaccounted for.",
      },
      {
        question: "Is the erasure audit log itself tenant-isolated?",
        answer:
          "Yes. Migration 0002 enables FORCE ROW LEVEL SECURITY on retention_audit with a policy scoped to app.current_account — a query that never binds a tenant context returns zero rows, not another tenant's erasure history.",
      },
      {
        question:
          "Does running retention runner make us GDPR or CCPA compliant?",
        answer:
          "No single module does that. Retention runner ships the erasure execution and the audit row proving a subject's data was purged across every registered store — it's the technical control an auditor checks for, generated as evidence, not a compliance certificate.",
      },
    ],
    relatedGlossary: ["worm-retention-policy", "row-level-security"],
    sells: {
      edition: "Compliance",
      note: "@caisson/compliance composes retention-runner at runtime as a real workspace:* dependency (ADR-0205) — buy it standalone at $199 or get it inside the $799 Compliance edition.",
    },
  },
  {
    slug: "alerting",
    metaTitle: "Alerting — the SOC 2 CC7.2 alert pipeline | Caisson",
    metaDescription:
      "Deduped, rate-capped, quiet-hours alert delivery to email, webhook, Slack, and Telegram, with a structured audit row per outcome — the SOC 2 CC7.2 control.",
    heroOneLiner:
      "Five deterministic stages between an event and a delivered alert — dedup, rate-cap, quiet hours, multi-channel send, one audit row.",
    definition:
      "The alerting module is Caisson's SOC 2 CC7.2 alert-delivery control: a five-stage pipeline — dedup, rate-cap-to-digest, IANA-timezone quiet hours with a critical override, multi-channel delivery (email, webhook, Slack, Telegram), then a structured audit row — that runs deterministically because every dependency, including the clock, is injected.",
    included: [
      {
        title: "Dedup on an open incident's key",
        body: "dedup() suppresses a repeat event while an incident sharing its dedupeKey is still open, so a flapping check doesn't re-fire an alert that already has a live incident.",
      },
      {
        title: "Rate-cap to a digest, never a drop",
        body: 'rateCap() checks the recipient\'s recent send count against a per-event-type RateCapPolicy; once the window\'s maxPerWindow is reached the outcome flips to "digest" instead of "deliver" — noisy alert types back off, they don\'t vanish.',
      },
      {
        title: "IANA-timezone quiet hours, critical overrides",
        body: 'quietHours() resolves the recipient\'s local hour via Intl.DateTimeFormat (no timezone database dependency) and holds delivery inside the configured window — except a "critical" severity event always delivers, no matter the hour.',
      },
      {
        title: "Four delivery channels behind one port, isolated",
        body: "createEmailChannel, createWebhookChannel, createSlackChannel, and createTelegramChannel all implement the same AlertChannel port; deliverAll() runs them via Promise.all and catches every throw into a failed DeliveryResult, so one channel being down never blocks the others.",
      },
      {
        title: "SSRF-guarded buyer-supplied destinations",
        body: "Webhook, Slack, and Telegram config URLs pass @caisson/kernel's assertSafePublicUrl at the Zod schema boundary and assertSafePublicUrlResolved again at the fetch call (a DNS-rebinding recheck), and every outbound POST sets redirect: \"error\" so a 3xx can't hop the request to a private host after the check.",
      },
      {
        title: "One structured audit row per outcome",
        body: "processAlert() always calls auditSink.record() exactly once — delivered, suppressed, held, or digested — into a plain, RLS-forced Postgres table (alert_audit_log), explicitly not the hash-chained WORM audit-worm product; the two are kept deliberately distinct.",
      },
    ],
    artifact: {
      label:
        "processAlert — five stages, short-circuit at the first non-deliver outcome, exactly one audit row either way",
      lang: "ts",
      file: "packages/alerting/src/orchestrator.ts",
      code: 'export async function processAlert(\n  event: AlertEvent,\n  deps: ProcessAlertDeps,\n): Promise<ProcessAlertResult> {\n  if (dedup(event, deps.openIncidents)) {\n    return finish(event, deps, "suppressed", []);\n  }\n\n  if (rateCap(event, deps.recentCount, deps.ratePolicy) === "digest") {\n    return finish(event, deps, "digested", []);\n  }\n\n  if (\n    quietHours(event, deps.recipientTz, deps.quietPolicy, deps.now) === "hold"\n  ) {\n    return finish(event, deps, "held", []);\n  }\n\n  const deliveries = await deliverAll(event, deps.channels);\n  return finish(event, deps, "delivered", deliveries);\n}',
    },
    faq: [
      {
        question: "What SOC 2 control does the alerting module satisfy?",
        answer:
          "CC7.2 — detection of, and response to, unauthorized or anomalous changes. The pipeline routes a qualifying event through dedup, rate-cap, and quiet hours to a real channel and writes one audit row per outcome. That ships the technical control; it doesn't make you SOC 2 compliant on its own — compliance status is your auditor's call.",
      },
      {
        question:
          "Is the alert audit trail the same as the WORM audit chain in audit-worm?",
        answer:
          "No, and the code says so explicitly: audit.ts and its migration are plain structured logging (an RLS-forced alert_audit_log table), not hash-chained. @caisson/audit-worm is the separate tamper-evident chain product; alerting's audit sink deliberately doesn't import it, so the two stay distinct products with distinct guarantees.",
      },
      {
        question:
          "What happens if Slack is down but email and webhook are configured?",
        answer:
          'deliverAll() runs every configured channel through Promise.all and catches each one\'s throw into its own failed DeliveryResult — a down Slack webhook returns { channel: "slack", ok: false, error }, while email and webhook still deliver. One channel failing never aborts the others.',
      },
      {
        question:
          "Can I buy the alerting module standalone, or only inside Compliance?",
        answer:
          "Standalone, $149. It's also a real workspace:* dependency of the Compliance edition, re-exported from its entry point (\"export * from '@caisson/alerting'\") rather than just listed on a manifest — buying Compliance gets you the same package, not a promise of it.",
      },
    ],
    relatedGlossary: ["soc2-audit-log", "control-to-code-mapping"],
    sells: {
      edition: "Compliance",
      note: "Alerting is a real workspace:* dependency that the Compliance edition re-exports at runtime (packages/compliance/src/index.ts), not a manifest-only listing — buy it standalone at $149 or get it composed into Compliance.",
    },
  },
  {
    slug: "ai-meter",
    metaTitle: "Token Metering — @caisson/ai-meter | Caisson",
    metaDescription:
      "PG-atomic reserve/reconcile token metering for LLM calls: per-tenant spend caps, a circuit breaker, and a MinHash dedup gate. Integer credits only, no floats.",
    heroOneLiner:
      "Reserve a token estimate before the call, true it to actual usage after: a runaway prompt loop 402s on the next call instead of running your bill up.",
    definition:
      "ai-meter is the metered-inference money path: estimate a call's cost, reserve integer credits against it before the provider answers, then reconcile to the provider's actual reported usage. A per-tenant spend window and circuit breaker sit on top, so a crossed hard cap blocks the next reservation before a provider call ever fires; the block is checked against real usage, never assumed.",
    included: [
      {
        title: "Pre-call estimate",
        body: "estimateCost sizes the reservation before the provider responds: a chars/4 heuristic (estimateTokens) against the message array, deliberately rounded up (a full output budget assumed, no cache) so reconcile() trues a shortfall down rather than an under-reservation slipping past a cap.",
      },
      {
        title: "reserve() then reconcile()",
        body: "reserve() debits the estimate from the tenant's credit wallet before the call; reconcile() computes the real cost from provider-reported usage and trues the delta: a feature_grant refund on over-reservation, a feature_debit shortfall charge on under-reservation, nothing at all when the delta is zero. The usage_event (account_id, call_id) UNIQUE constraint makes a retried reconcile settle exactly once.",
      },
      {
        title: "Versioned, fail-closed price book",
        body: "BUNDLED_PRICE_BOOK maps provider/model to integer micro-USD rates per million tokens; resolvePriceEntry throws on an unrecognized provider/model instead of metering at zero. Every leg rounds up per computeCost, so a partial-cache mix never under-bills, and forge.config can swap in an operator-supplied book validated by parsePriceBook.",
      },
      {
        title: "Circuit breaker",
        body: "assertBreakerClosed runs before every reserve(): an open breaker throws SpendCapError (402) with no provider call made. A crossed hard_limit trips it (tripBreaker); it stays open until an operator calls resetBreaker, so a runaway loop can't spend past the cap on the next retry.",
      },
      {
        title: "Dedup-before-meter gate",
        body: "checkDedupGate runs a dependency-free MinHash/LSH similarity check (normalizePrompt → shingle → computeMinHashSignature → lshBands) against recent calls in the same account+scope, ahead of the price-book estimate. It only detects a likely-redundant prompt above a 0.92 Jaccard threshold and returns duplicate-of; it never auto-skips the call or moves a credit itself.",
      },
    ],
    artifact: {
      label:
        "bumpSpend(): the atomic per-tenant spend-window mutation reserve() and reconcile() both call",
      lang: "ts",
      file: "packages/ai-meter/src/meter.ts",
      code: "/**\n * Atomic running-spend mutation, returning the new total. A non-negative `amount` upserts (the window\n * row may not exist yet — the reservation creates it). A negative `amount` (a reconcile refund) is a\n * plain UPDATE on the row the reservation already created: `ON CONFLICT` only arbitrates UNIQUE\n * violations, so a negative VALUES tuple would trip the `spent >= 0` CHECK during the insert attempt\n * BEFORE the conflict resolves — the UPDATE instead evaluates the CHECK on the resulting (>= 0) row.\n */\nasync function bumpSpend(\n  tx: TenantExecutor,\n  accountId: string,\n  scope: string,\n  key: string,\n  amount: number,\n): Promise<number> {\n  if (amount >= 0) {\n    const r = await tx.query<{ spent: number }>(\n      `INSERT INTO ${TENANT_SPEND_WINDOW_TABLE} (account_id, scope, unit, window_key, spent)\n         VALUES ($1, $2, $3, $4, $5)\n       ON CONFLICT (account_id, scope, unit, window_key)\n         DO UPDATE SET spent = ${TENANT_SPEND_WINDOW_TABLE}.spent + EXCLUDED.spent,\n                       updated_at = now()\n         RETURNING spent`,\n      [accountId, scope, SPEND_UNIT, key, amount],\n    );\n    return r.rows[0]?.spent ?? amount;",
    },
    faq: [
      {
        question: "Does ai-meter call the LLM provider itself?",
        answer:
          "No. ai-meter is the money-path seam around a call, not a provider client: reserve() and reconcile() take a provider/model/usage shape from whatever gateway made the call (the AI Production Kit's inference gateway composes it this way) and never make an HTTP request themselves.",
      },
      {
        question: "What happens when a tenant's spend cap is hit mid-session?",
        answer:
          "The reserve() that crosses the hard_limit trips the circuit breaker in the same transaction. The NEXT reserve() call for that account+scope throws SpendCapError (402) before the provider is ever invoked; the call that tripped it still completes and reconciles normally.",
      },
      {
        question: "Can a network retry double-charge a call?",
        answer:
          "No. reserve() debits against an idempotencyKey of `${callId}:reserve`, and reconcile() inserts into usage_event on a (account_id, call_id) UNIQUE with ON CONFLICT DO NOTHING: a retried reconcile detects the existing row and returns the already-settled result instead of writing a second credit event.",
      },
      {
        question:
          "Is the estimate exact, or does it round in the customer's favor?",
        answer:
          "It's a conservative heuristic (chars/4, full assumed output budget, no cache credit) that deliberately over-reserves rather than under-reserves. reconcile() then refunds the difference to the actual provider-reported usage, so the wallet never sits short mid-call.",
      },
    ],
    relatedGlossary: ["token-metering", "row-level-security"],
    sells: {
      edition: "ai-kit",
      note: "ai-meter is the metering primitive the AI Production Kit's inference gateway composes at runtime: buy it standalone onto the free base, or get it (plus guardrails and the prompt registry) bundled into the $599 edition.",
    },
  },
  {
    slug: "ai-evals",
    metaTitle: "Eval Harness Module — Regression Gate for LLM Code",
    metaDescription:
      "A CI eval harness that fails the build on a real score regression against a committed baseline — cassette-replayed judges, no live model call in CI.",
    heroOneLiner:
      "Regression-grade evals that run in CI, not in prod. A model swap fails the build first, not a customer's session.",
    definition:
      "@caisson/ai-evals is a regression gate for prompt and model changes: defineEval() scores a version-bound dataset through a grader taxonomy, then compareToBaseline() fails the build if the mean score, any individual scorer, or a Wilson confidence floor drops below the committed baseline — offline and deterministic, no live provider call inside CI.",
    included: [
      {
        title: "Version-bound eval runs",
        body: 'defineEval({ name, promptVersionId, cases, scorers, threshold }) grades every case with every scorer and returns a deterministic EvalRun. Each dataset carries a promptVersionId FK, so a score is always attributable to one immutable prompt version — never a floating "current prompt."',
      },
      {
        title: "Six graders, two classes",
        body: "Deterministic exactGrader/regexGrader/jsonShapeGrader/schemaGrader run pure, offline, no model. judgeGrader routes through the Judge port for model-graded scoring. injectionGrader is its own fail-closed substring-denial class that a graded input can never talk its way past — an empty rubric throws instead of silently passing.",
      },
      {
        title: "Committed-baseline regression gate",
        body: "gateAgainstBaseline() compares each run to a committed JSON baseline and fails closed: a missing baseline, a score below threshold, or any scorer regression blocks the gate. BLESS=1 bun run eval is the one sanctioned path to rewrite it, mirroring the golden-fixture discipline in @caisson/testing.",
      },
      {
        title: "Offline judge via cassette replay",
        body: "cassetteJudge() replays recorded verdicts from a committed cassette — zero network, zero provider secret, in CI. An unrecorded case id is a hard cassette-miss error, not a silent pass. recordingJudge() wraps a real local judge to mint a fresh cassette for review before it's committed.",
      },
      {
        title: "Wilson confidence floor and exit classifier",
        body: "wilsonLowerBound() threads an opt-in confidence floor into the baseline gate so a small lucky-draw sample can't pass as reliable. classifyExit() tags WHY a run exited — error, timeout, budget-exhausted, refusal, empty-output — as a signal orthogonal to pass/fail.",
      },
      {
        title: "Reflexivity queue for judge/human disagreement",
        body: "captureDisagreement() enqueues a case only when the model verdict and a human verdict disagree; consolidateReflexivityQueue() dedupes and caps the list for operator review. Nothing here auto-writes a committed dataset — merging a candidate back in stays a human act.",
      },
    ],
    artifact: {
      label: "The fail-closed regression compare",
      lang: "ts",
      file: "packages/ai-evals/src/baseline.ts",
      code: 'export function compareToBaseline(\n  run: EvalRun,\n  baseline: BaselineFile,\n): BaselineComparison {\n  const findings: RegressionFinding[] = [];\n\n  if (run.score + EPS < run.threshold) {\n    findings.push({\n      kind: "below-threshold",\n      actual: run.score,\n      baseline: run.threshold,\n      detail: `score ${run.score} < threshold ${run.threshold}`,\n    });\n  }\n\n  const prior = baseline.evals[run.name];\n  if (prior === undefined) {\n    findings.push({\n      kind: "missing-baseline",\n      actual: run.score,\n      detail: `no committed baseline for eval "${run.name}" — bless to record it`,\n    });\n    return { eval: run.name, passed: false, findings, blessed: false };\n  }',
    },
    faq: [
      {
        question: "Does the eval gate call a live model in CI?",
        answer:
          'No. Model-graded scorers route through cassetteJudge(), which replays a recorded verdict from a committed cassette file — zero network call, zero provider secret. An unrecorded case id is a hard error ("cassette miss"), not a silent pass. A live judge only runs locally, wrapped in recordingJudge() to mint the cassette you then commit.',
      },
      {
        question:
          "A prompt change is a real improvement and now fails the regression gate. What do I do?",
        answer:
          "Run BLESS=1 bun run eval. That's the one sanctioned path: it rewrites the committed baseline file from the current runs, merging into existing entries so a partial run never drops other evals, then passes. Review the baseline diff like any other committed fixture before merging.",
      },
      {
        question:
          "What happens the first time I add a new eval with no baseline yet?",
        answer:
          'It fails closed. compareToBaseline() returns a "missing-baseline" finding rather than treating an absent entry as a pass — bless it once to record the starting baseline, same as any other eval.',
      },
      {
        question:
          "Does this eval gate get wired into CI on the app I generate?",
        answer:
          "No. The eval CLI runs as a distinct turbo eval task inside this monorepo only — it is never injected into a generated buyer repo as a required CI job. You own your own eval cadence once you generate.",
      },
    ],
    relatedGlossary: [],
    sells: {
      edition: "ai-kit",
      note: "Sold standalone at $199 — no edition includes it (standalone by design), so it stays its own line on any stack. It pairs with the AI Production Kit's metering and guardrails to gate CI on regression.",
    },
  },
  {
    slug: "guardrails",
    metaTitle: "Guardrails: Fail-Closed Input/Output Guard | Caisson",
    metaDescription:
      "A fail-closed guard around every model call: PII redaction (mask, hash, or tokenize), a swappable moderator, and an unconditional secret-shape gate.",
    heroOneLiner:
      "The chokepoint between your app and the model — moderate, redact, and block, fail-closed by default.",
    definition:
      "Guardrails is the fail-closed input/output guard around a model call: guardInput moderates then redacts PII on the way in, guardOutput moderates on the way out, and either leg throws a 422 GuardrailError on a block instead of letting a moderator outage pass content through silently. A swappable Moderator port (local regex, provider, or custom) backs the moderation call; an unconditional secret-shape gate runs before it on either leg, no opt-out.",
    included: [
      {
        title: "Fail-closed by default",
        body: "guardInput and guardOutput throw GuardrailError (HTTP 422) on any block. A moderator outage or timeout fails closed unless the policy explicitly sets failOpen: true — the default protects the request, not the moderator's uptime.",
      },
      {
        title: "Unconditional secret-shape gate",
        body: 'Before either leg reaches a moderator, guard.ts checks looksLikeSecret(text) and blocks category "secret" with no policy field and no opt-out (ADR-0215) — a leaked credential never gets a moderation call, live or not.',
      },
      {
        title: "Swappable Moderator port",
        body: "localModerator runs a zero-network regex blocklist; providerModerator wraps an injected async check for a real vendor call; customModerator hooks in your own function. All three implement the one-method Moderator interface guard.ts calls under moderateWithDeadline.",
      },
      {
        title: "Three PII redaction modes",
        body: "detectPii finds email, SSN, Luhn-validated credit card, and phone spans. redactPii replaces them irreversibly (mask → [EMAIL], hash → [EMAIL:ab12…]); tokenizePii instead seals the original via field-crypto and swaps in an opaque placeholder that detokenizePii can restore after the round trip.",
      },
      {
        title: "FTC “4 Ps” dark-pattern evaluator",
        body: "evaluateFtc4P scores marketing/UI copy against five rule classes — false urgency, forced continuity, confirmshaming, opt-out enrollment, drip pricing — charted across four dimensions (prominence, presentation, placement, proximity). Wrap it as a Moderator with ftc4pModerator to gate guardOutput on your own copy.",
      },
      {
        title: "Metadata-only blocked event",
        body: "Every block emits a guardrail.blocked event to the kernel EventSink carrying blockId, stage, category, policy, and failClosed — never the flagged text. The emit is fire-and-forget: a telemetry-sink failure can't mask or delay the block itself.",
      },
    ],
    artifact: {
      label:
        "moderate() — the secret-shape gate, then a fail-closed moderator race under a deadline",
      lang: "ts",
      file: "packages/guardrails/src/guard.ts",
      code: '  // Unconditional credential-shape gate (ADR-0215) — runs BEFORE the (possibly outaged/provider)\n  // moderator, reusing the ONE `looksLikeSecret` predicate (kernel). No policy field, no opt-out: a\n  // raw credential in either leg never reaches a moderator call, live or not.\n  if (looksLikeSecret(text)) block(stage, "secret", false, policy, rt);\n  let result: ModerationResult;\n  try {\n    result = await moderateWithDeadline(\n      policy.moderator,\n      text,\n      policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,\n    );\n  } catch {\n    // Outage / timeout / driver throw → fail-closed unless the operator explicitly opted out.\n    if (policy.failOpen === true) return;\n    block(stage, "moderation", true, policy, rt);\n  }\n  if (result.flagged) block(stage, result.category, false, policy, rt);',
    },
    faq: [
      {
        question:
          "What happens if the moderator times out or the provider is down?",
        answer:
          "The call fails closed: moderateWithDeadline races the moderator against a timeoutMs deadline (2,000ms by default), and a rejection — outage, timeout, or driver throw — blocks the request unless the policy explicitly sets failOpen: true.",
      },
      {
        question: "Does guardrails call an LLM to moderate content?",
        answer:
          "Not by itself. localModerator is a zero-network regex blocklist; providerModerator wraps a check function you supply (your real vendor call, tested with an injected double in CI); guardrails itself makes no outbound request.",
      },
      {
        question: "Can redacted PII be restored later?",
        answer:
          "Only in tokenize mode: tokenizePii seals each match via field-crypto and returns opaque placeholders plus the sealed tokens; detokenizePii opens them under the same tenant context to restore the originals. mask and hash mode are irreversible by design.",
      },
      {
        question: "Does it catch leaked API keys, not just PII or profanity?",
        answer:
          'Yes. guard.ts runs looksLikeSecret(text) as an unconditional gate — category "secret" — before either leg reaches the configured moderator. There is no policy field to disable it.',
      },
    ],
    relatedGlossary: [],
    sells: {
      edition: "ai-kit",
      note: "Guardrails ships inside the $599 AI Production Kit (with ai-meter and prompt-registry) or standalone at $149.",
    },
  },
  {
    slug: "prompt-registry",
    metaTitle: "Prompt Registry — Versioned Prompts | Caisson",
    metaDescription:
      "Append-only prompt versioning with name@version and name@alias addressing, a mutable alias pointer for zero-redeploy promotion, and injection-safe rendering.",
    heroOneLiner:
      "Prompts hardcoded three layers deep in a route handler, versioned like everything else that ships.",
    definition:
      "Prompt registry is a package that stores prompt templates as append-only versions and resolves them by name@version or name@alias. Every edit mints a new row instead of mutating one — the database revokes UPDATE and DELETE outright — and a mutable alias pointer (prod, canary) lets you promote a prompt to production without a redeploy or touching a version row.",
    included: [
      {
        title: "Append-only versioning, not a mutable prompts table",
        body: "registerPrompt derives the current tip from the kernel's versioning chain and supersedes it — the first call to a name is v1, each later call is tip.version + 1. A concurrent mint of the same (name, version) hits the unique index and throws ConflictError instead of silently overwriting.",
      },
      {
        title: "name@version and name@alias addressing",
        body: "parsePromptRef reads a bare name as the current tip, a numeric suffix as an exact version, and anything else as an alias. resolvePrompt takes that parsed reference straight to the matching row — one function call from a string ref to an immutable PromptVersion.",
      },
      {
        title: "Promote without a redeploy",
        body: "setAlias points prod or canary at a specific version number. It resolves the target version first, so an alias can never point at a version that doesn't exist, and it only ever writes the prompt_alias pointer row — the version rows themselves are never touched.",
      },
      {
        title: "Injection-safe rendering, not string interpolation",
        body: "renderPrompt validates raw vars against the version's own varSpec (a strict Zod schema — unknown vars rejected, missing vars fail), then substitutes {{name}} placeholders in a single non-recursive pass. Every inserted value is brace-escaped, so a variable's own content can never open a new placeholder or forge a message role.",
      },
      {
        title: "Every table is tenant-isolated by default",
        body: "prompt_version and prompt_alias both go through buildTenantPolicySql (force-RLS), and every registry function takes a TenantExecutor — a query outside a withTenant scope sees nothing, not an empty result you have to remember to check for.",
      },
      {
        title: "The render contract is pinned, not just tested",
        body: "The single-pass, brace-escaped rendering behavior is locked against a golden fixture (src/__golden__/render.json) — a change to the substitution logic that shifts the output has to update the fixture deliberately, it can't drift silently through a passing test suite.",
      },
    ],
    artifact: {
      label:
        "renderContent — single-pass substitution, brace-escaped, re-checked against the content cap after escaping",
      lang: "ts",
      file: "packages/prompt-registry/src/render.ts",
      code: 'function renderContent(template: string, vars: Record<string, string>): string {\n  const rendered = template.replace(PLACEHOLDER_RE, (_match, name: string) => {\n    const value = vars[name];\n    if (value === undefined) {\n      // A placeholder with no bound variable is a template/schema mismatch — never emit it raw.\n      throw new ValidationError("Unbound prompt variable", { name });\n    }\n    return escapeValue(value);\n  });\n  // Escaping can inflate a value (every `{`/`}` doubles), and several per-cap-bounded values can\n  // still sum past the cap in one template — re-check the rendered total, not just each input.\n  if (rendered.length > MAX_CONTENT_LENGTH) {\n    throw new ValidationError(\n      "Rendered prompt content exceeds the content cap",\n      {\n        length: rendered.length,\n        max: MAX_CONTENT_LENGTH,\n      },\n    );\n  }\n  return rendered;\n}',
    },
    faq: [
      {
        question:
          "Can two people editing the same prompt name overwrite each other's work?",
        answer:
          "No. registerPrompt computes the next version from the current lineage tip and inserts under a unique (account_id, name, version) index. A race lands both writers on the same target version; the loser's INSERT hits the unique violation and gets back a ConflictError instead of a silent overwrite.",
      },
      {
        question: "How do I roll a prompt back to a previous version?",
        answer:
          'Point the alias at it — setAlias(tx, { accountId, name, alias: "prod", version: 3 }) moves the prod pointer back to version 3. Nothing is deleted or re-inserted; the version 4 row that\'s no longer live stays exactly where it is for as long as you keep it.',
      },
      {
        question:
          "What happens if I pass a variable the template doesn't declare, or forget one it does?",
        answer:
          "renderPrompt compiles the version's varSpec into a strict Zod object schema before touching the template — an unknown key is rejected, a missing required key fails validation, and both happen before any substitution runs.",
      },
      {
        question:
          "Does this run as a hosted service or is it a library I call from my own code?",
        answer:
          "It's a library — a TenantExecutor-scoped API you import and call directly, the same primitive the AI Production Kit's inference gateway resolves prompt refs through before every model call. There's no standalone prompt-registry server or HTTP route; you own the calling code.",
      },
    ],
    relatedGlossary: ["row-level-security"],
    sells: {
      edition: "ai-kit",
      note: "Prompt registry is one of the modules composing the $599 AI Production Kit edition — the inference gateway resolves every promptRef through it before rendering and metering a call. Buy it standalone at $99, or get it with ai-meter and guardrails in the edition, or in the $1,499 Everything bundle — all four editions plus the base.",
    },
  },
  {
    slug: "local-store",
    metaTitle: "Local Vector Store — Hybrid FTS5 + sqlite-vec | Caisson",
    metaDescription:
      "A local canonical store for hybrid retrieval: sqlite-vec KNN fused with FTS5 by Reciprocal Rank Fusion, one SQLite file per tenant, no vector cloud involved.",
    heroOneLiner:
      "Hybrid vector + full-text search that runs on disk, in one SQLite file per tenant — nothing shipped to a vector cloud.",
    definition:
      "Local vector store is Caisson's on-disk hybrid retrieval engine: sqlite-vec (vec0) for KNN and SQLite FTS5 for text, fused by Reciprocal Rank Fusion (RRF_K=60). It runs FTS5-only with no embedder configured — the vector leg degrades cleanly on any backend fault. Tenant isolation is physical: one SQLite file per tenant, not a shared table with a filter.",
    included: [
      {
        title: "RRF hybrid search",
        body: "LocalStore.hybridSearch runs the vec0 KNN leg and the FTS5 leg independently, then fuses them by Reciprocal Rank Fusion (RRF_K=60). Either leg can come up empty — a missing query vector, an empty query, or a vec backend fault — and the other still returns results.",
      },
      {
        title: "File-per-tenant isolation",
        body: "tenantDbPath and openTenantDb resolve one SQLite file per tenant under a root directory. The path is rejected fail-closed on traversal, null bytes, absolute paths, or path separators before anything is opened — a cross-tenant query is not expressible, because a connection only ever holds one tenant's file.",
      },
      {
        title: "Pluggable embedder port, no bundled model",
        body: "Embedder is an interface the edition wires — this package never calls a model or opens a socket. embedOrSkip treats an absent embedder as a first-class mode: retrieval runs on the FTS5 floor alone, not an error, not a silent default model.",
      },
      {
        title: "Cloud-egress secret scrub",
        body: "When a buyer does wire a cloud embedder, scrubForEgress runs on every text before it leaves the box, stripping PEM key blocks, URL userinfo passwords, secret-named assignments, and bare token shapes. guardEmbedder and createCloudEmbedder apply it structurally, not as an opt-in step.",
      },
      {
        title: "Dedup-on-write + retention GC",
        body: "decideWrite hashes normalized content per scope and reinforces an existing duplicate (resets its recency, slides its TTL) instead of writing a second row. planGc then evicts in order — expired, decayed below a score floor, or over a per-scope cap — as a pure function of items, config, and now.",
      },
      {
        title: "Validated memory-item boundary",
        body: "MemoryItemSchema is a Zod .strict() boundary: UUID ids, bounded text (100k chars) and scope (256 chars), optional string-to-string metadata. Unknown keys are rejected, not silently dropped.",
      },
    ],
    artifact: {
      label:
        "LocalStore.hybridSearch — vec0 KNN + FTS5 fused by RRF (RRF_K=60)",
      lang: "ts",
      file: "packages/local-store/src/store.ts",
      code: "  hybridSearch(opts: HybridSearchOptions): SearchHit[] {\n    const limit = opts.limit ?? 10;\n    const legLimit = Math.max(limit * 8, 50);\n\n    const vecRanks = this.vecLeg(opts.queryVector, legLimit);\n    const ftsRanks = this.ftsLeg(opts.queryText, legLimit);\n\n    // RRF fusion: every leg a doc appears in contributes 1/(RRF_K + rank); sum across legs.\n    const fused = new Map<number, number>();\n    for (const [rowid, rank] of vecRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));\n    for (const [rowid, rank] of ftsRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));\n\n    const ranked = [...fused.entries()]\n      // score descending; deterministic tie-break by rowid ascending (stable, env-free).\n      .sort((a, b) => b[1] - a[1] || a[0] - b[0])\n      .slice(0, limit);\n    if (ranked.length === 0) return [];\n\n    return ranked.map(([rowid, score]) => ({ id: this.docId(rowid), score }));\n  }",
    },
    faq: [
      {
        question: "Does local-store need a vector database service?",
        answer:
          "No. It's bun:sqlite plus the sqlite-vec extension (vec0) on disk — one file per tenant, no separate database to run or pay for.",
      },
      {
        question: "Do I have to bring my own embedding model?",
        answer:
          "Yes. Embedder is an interface the edition or your app wires — local-store bundles no model and never calls one. With no embedder configured, retrieval runs on the FTS5 leg alone, which is a documented zero-config mode, not a degraded one.",
      },
      {
        question: "How is tenant data kept apart?",
        answer:
          "Physically. tenantDbPath resolves one SQLite file per tenant under a root directory and rejects traversal, null-byte, absolute, or separator-bearing tenant ids before any file is opened — there's no shared table a filter could get wrong.",
      },
      {
        question: "Is it safe to point this at a cloud embedding API?",
        answer:
          "createCloudEmbedder scrubs every text through scrubForEgress before it leaves the box — PEM blocks, URL passwords, secret-named fields, and bare token shapes are redacted to a constant sentinel first, and the transport is fetchWithTimeout with an injectable seam for tests.",
      },
    ],
    relatedGlossary: [],
    sells: {
      edition: "local-first",
      note: "Local vector store is the retrieval engine inside Local-first AI ($349), alongside on-device inference and the privacy gate. Buy it standalone ($99) to add hybrid search to any stack without the rest of the edition.",
    },
  },
  {
    slug: "agent-kernel",
    metaTitle: "Agent Kernel — Governed Agent Lifecycle FSM | Caisson",
    metaDescription:
      "Agent Kernel: the agent/skill/rule schema, seven-act lifecycle FSM, and hooks dispatcher behind Caisson's Agentic-Dev edition. No vendor SDK, $199 standalone.",
    heroOneLiner:
      "The guarded agent lifecycle FSM: VERIFY failing reopens PLAN, there's no edge to SHIP.",
    definition:
      "Agent kernel is the engine-neutral base for governed AI agent work: a Zod schema for agent/skill/rule artifacts, a seven-act lifecycle state machine (spec through ship), allow/deny/mutate governance guards, a hooks dispatcher, and an opt-in tamper-evident audit-chain recorder. It imports no vendor SDK and runs no LLM: composition only, consumed by both the base CLI and the Agentic-Dev edition.",
    included: [
      {
        title: "Typed agent/skill/rule schema",
        body: "AgentArtifact, SkillArtifact, and RuleArtifact are a Zod discriminatedUnion on kind, built on @caisson/kernel's strictObject: an unknown field is rejected outright, not silently dropped. A bad artifact fails through parseArtifact as a redaction-safe ValidationError, never the rejected values.",
      },
      {
        title: "Seven-act lifecycle FSM",
        body: "ACTS runs spec through ship in canonical order. transition() is the only way to move between acts and throws on any edge outside the fixed TRANSITIONS adjacency. The two branches that matter: verify can reopen plan, and eval has no edge but ship.",
      },
      {
        title: "allow / deny / mutate governance",
        body: "governance.ts gives transition guards and hook vetoes one shared decision shape. evaluateGuards folds a guard list fail-closed: the first deny short-circuits, and a guard that throws is itself treated as a deny, so a buggy guard can never accidentally admit a transition.",
      },
      {
        title: "Hooks dispatcher: fail-open on crashes, fail-closed on vetoes",
        body: "HookDispatcher.dispatch runs registered before:/after: act handlers in order. A handler that throws is isolated, reported to an optional sink (hook name + error type only, never a message or stack), and treated as allow; a handler that returns deny() still short-circuits the loop.",
      },
      {
        title: "Safe shell hooks: no interpolation is possible",
        body: "commandHandler runs a fixed argv array through node:child_process execFile: no shell is spawned, and no HookContext value can reach the command's arguments, so shell injection through a hook is structurally impossible, not just avoided by convention.",
      },
      {
        title: "Opt-in tamper-evident audit chain",
        body: "AuditedLifecycle wraps every governed transition with the kernel's chainEntry/anchorChain/verifyChain hash-chain primitives, the same mechanism the Compliance edition's audit-worm package uses. Off by default; set audited: true and each admitted step becomes an append-only, tamper-evident chain entry.",
      },
    ],
    artifact: {
      label: "TRANSITIONS: the seven-act lifecycle's only two branch edges",
      lang: "ts",
      file: "packages/agent-kernel/src/lifecycle.ts",
      code: '/**\n * Legal forward adjacency. The two branch edges:\n *   - `verify → plan` — a failed goal-backward verify opens a fresh PLAN cycle (does not SHIP).\n *   - `sweep → ship` — an untagged phase skips EVAL straight to SHIP.\n * An EVAL regression is a fail-stop (no edge out of `eval` but `ship`); `ship` is terminal.\n */\nconst TRANSITIONS: Record<Act, readonly Act[]> = {\n  spec: ["plan"],\n  plan: ["execute"],\n  execute: ["verify"],\n  verify: ["sweep", "plan"],\n  sweep: ["eval", "ship"],\n  eval: ["ship"],\n  ship: [],\n};',
    },
    faq: [
      {
        question: "Does agent-kernel call an LLM or import a vendor SDK?",
        answer:
          "No. Its own package.json says it plainly: engine-neutral, no vendor SDK, no LLM call; the schema, FSM, governance, hooks, and audit-chain primitives are composition mechanism only, consumed down-only by the base cli/mcp-server and by the Agentic-Dev edition.",
      },
      {
        question:
          "What happens if a transition is attempted out of order, like execute straight to ship?",
        answer:
          "transition() throws a ValidationError immediately. canTransition() checks the fixed TRANSITIONS adjacency and there is no edge from execute to ship, only execute → verify; an illegal move throws rather than getting silently reinterpreted.",
      },
      {
        question: "Is the tamper-evident audit chain mandatory?",
        answer:
          "No. AuditedLifecycle takes an audited option that defaults to false: with it off, every transition is still FSM-validated but nothing is recorded. Turn it on with a store (InMemoryAuditLifecycleStore ships for offline/CLI use, or bring your own) and each admitted step gets chained.",
      },
      {
        question:
          "Does buying agent-kernel alone get me the sandboxed agent runner too?",
        answer:
          "No. agent-kernel ($199) is the schema/FSM/governance/hooks/audit-chain base; running an actual sandboxed agent process is agent-runner ($49), a separate module. Those are the two Agentic-Dev SKUs sold standalone; the $249 Agentic-Dev edition additionally bundles the local hybrid memory, the sandboxed tool-exec gate, and the multi-harness emitter that wire agent-kernel into one governed loop. Buy the modules for your own tooling, or buy the edition for the assembled loop.",
      },
    ],
    relatedGlossary: ["hash-chain-audit-trail"],
    sells: {
      edition: "agentic-dev",
      note: "Agent kernel ($199) and agent-runner ($49) are the two Agentic-Dev SKUs sold standalone; the $249 Agentic-Dev edition additionally bundles the local hybrid memory, the sandboxed tool-exec gate, and the multi-harness emitter that wire agent-kernel into one governed loop. Buy the module alone to consume the schema/FSM/governance/hooks/audit-chain from your own tooling, or buy the edition for the assembled loop.",
    },
  },
  {
    slug: "agent-runner",
    metaTitle: "Agent Runner — Sandboxed, Governed Agent Execution",
    metaDescription:
      "Agent Runner spawns a headless coding agent in an isolated worktree with a scrubbed, from-scratch env and streams an auditable .jsonl transcript of every run.",
    heroOneLiner:
      "Spawn a headless coding agent with a scrubbed environment, an isolated worktree, and a transcript you can audit line by line.",
    definition:
      "Agent Runner spawns a headless coding-agent CLI as a detached subprocess in a caller-supplied worktree, building its environment from scratch instead of inheriting the caller's. It streams the run's stream-json output to a durable .jsonl file and parses that transcript into a structured report of tool calls, files touched, and outcome.",
    included: [
      {
        title: "Env built from scratch, not inherited",
        body: "buildEngineEnv() never spreads process.env. It starts from an empty object, copies only the PASSTHROUGH_KEYS allowlist (PATH, LANG, LC_ALL, LC_CTYPE, TERM, TZ, TMPDIR), then adds the target provider's routing vars and the one auth key the caller passed in — nothing else reaches the child.",
      },
      {
        title: "Provider-agnostic profile",
        body: "ProviderConfig is a Zod-validated {binary, baseUrlEnv, authEnv, model, configDirEnv, modelEnv, args} shape — no vendor is hardcoded. The shipped CLAUDE_CLI_PROFILE runs the Claude Code CLI headless in stream-json mode with --strict-mcp-config, so no MCP server can be smuggled into the sandbox.",
      },
      {
        title: "Whole-token argv templating",
        body: "The {task} and {model} placeholders in a provider's args are substituted only when they are an entire argv element, never spliced into a larger string — a hostile task string can't add, split, or merge argv entries, and there's no shell in the spawn path to inject into.",
      },
      {
        title: "Detached, isolated worktree spawn",
        body: "spawn() launches the agent CLI with its own HOME and config dir inside a caller-supplied worktree, detached and unref'd so the run survives the launcher process exiting. stdout and stderr write straight to the transcript file descriptor, so there's no pipe-pumping babysitter to lose data if the caller dies.",
      },
      {
        title: "A structured report, not a raw log",
        body: "summarize() walks the stream-json events into a tool-call count, the file set an Edit/Write/MultiEdit/NotebookEdit tool touched, and the last assistant text. finalReport() adds status, timestamps, binary, and model — the shape a caller reviews before trusting the diff.",
      },
      {
        title: "Fail-closed run registry",
        body: "Every RunMeta read off disk is .strict()-validated before use, and a runId is checked against a UUID shape before it ever becomes a path segment. status() self-heals a run whose process died without a recorded outcome, marking it done or error instead of leaving it falsely running forever.",
      },
    ],
    artifact: {
      label:
        "buildEngineEnv — the child env built from scratch, never spread from process.env",
      lang: "ts",
      file: "packages/agent-runner/src/agent-runner.ts",
      code: '  const env: Record<string, string> = {};\n  for (const key of PASSTHROUGH_KEYS) {\n    const value = parentEnv[key];\n    if (typeof value === "string" && value.length > 0) env[key] = value;\n  }\n  // Isolation + provider routing only — no secret beyond the one provider key.\n  env["HOME"] = opts.home;\n  env[opts.provider.baseUrlEnv] = opts.baseUrl;\n  env[opts.provider.authEnv] = opts.authKey;\n  if (opts.provider.configDirEnv !== undefined) {\n    env[opts.provider.configDirEnv] = opts.configDir;\n  }\n  if (opts.provider.modelEnv !== undefined) {\n    env[opts.provider.modelEnv] = opts.provider.model;\n  }\n  // Hygiene for CLIs that honor these conventions: no self-update, no telemetry from the sandbox.\n  env["DISABLE_AUTOUPDATER"] = "1";\n  env["DISABLE_TELEMETRY"] = "1";\n  env["DISABLE_ERROR_REPORTING"] = "1";\n  return env;',
    },
    faq: [
      {
        question:
          "Does the sandboxed subprocess ever see my API keys or other secrets?",
        answer:
          "No — buildEngineEnv() builds the child's environment from an empty object; it never spreads process.env. Only a fixed non-secret allowlist (PATH, LANG, LC_ALL, LC_CTYPE, TERM, TZ, TMPDIR) plus the one target-provider auth key the caller explicitly passes in reach the subprocess. The leak-guard test plants eight secret canaries — OPENROUTER_API_KEY, GITHUB_TOKEN, AWS_SECRET_ACCESS_KEY, and five more — into a polluted parent env and asserts none of them appear in the returned child env, by key or value. A separate end-to-end test proves the same holds for a real spawned subprocess: it plants its own canary into the actual transcript the child writes and asserts that canary never shows up there either.",
      },
      {
        question: "Which agent CLI does it run?",
        answer:
          "Whichever one you configure — ProviderConfig is a {binary, baseUrlEnv, authEnv, model} shape, not a hardcoded vendor. The package ships one worked profile, CLAUDE_CLI_PROFILE, which runs the Claude Code CLI headless in stream-json mode with --strict-mcp-config so no MCP server, credentialed or not, loads into the sandbox.",
      },
      {
        question: "What does the caller get back — just a log file?",
        answer:
          "The transcript is a durable .jsonl on disk, but you don't parse it yourself: tail() returns compact incremental events, status() reports running/done/killed/error plus a live summary, and finalReport() returns one RunReport — result text, files touched, tool-call count, binary, model, and timestamps.",
      },
      {
        question:
          "Who commits the diff, opens the PR, or deploys after the agent finishes?",
        answer:
          "The caller, always. Agent Runner's contract stops at the worktree: the subprocess produces a diff and a transcript inside the worktree you gave it, and never touches git, opens a PR, or reaches a deploy target — that stays the orchestrator's job, one call site away.",
      },
    ],
    relatedGlossary: [],
    sells: {
      edition: "Agentic-Dev",
      note: "$49 à la carte, or included in the $249 Agentic-Dev edition alongside agent-kernel.",
    },
  },
];
