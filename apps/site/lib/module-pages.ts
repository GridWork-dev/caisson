// The standalone-module depth-page records — one per sellable module, 26 as of the ADR-0380
// module-depth slice that closed the last three gaps (access-review, risk-register, trust-page).
// The count is pinned at parity by module-pages.test.ts rather than trusted from this comment,
// which has now drifted twice. (ADR-0237 F2; the 13-record ADR-0368 wave joined
// 2026-07-19 via the same adversarial workflow) — the original 11 generated 2026-07-03 from the
// adversarially-reviewed copy workflow output, with the entitlement-honesty overrides applied
// (ai-evals is standalone-only: no edition or bundle grants it — registry members map truth,
// pinned by pricing.test.ts). Checked-in source from here on: edit records in place; keep every
// claim true-to-built (ADR-0082) and V1-live (ADR-0237 rider 2).
//
// `modulePageSpec` (module-page-spec.tsx) turns a record into the PageSpec the shared
// <PageSections> renderer consumes; the docs/demo rail is page chrome, not a section.

/** One artifact proof block: real package code, cited by file. */
export interface ModulePageArtifact {
  label: string;
  lang: "ts" | "sql" | "toml" | "bash";
  /** Repo path the code is lifted from — rendered as the CodeBlock label suffix. */
  file: string;
  code: string;
  /** 2-3 "what to notice" captions (SYNTHESIS §6 Tier-1 row 7 — the Resend/WorkOS annotated-snippet
   *  pattern), each naming a real identifier from `code` above it — never a line number (the
   *  snippet is a partial excerpt; a number would drift the moment the cited file reflows). */
  annotations: readonly string[];
}

export interface ModulePageRecord {
  /** = CatalogModule.id — the cart key, route param, and mark key. */
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
}

export const MODULE_PAGES: readonly ModulePageRecord[] = [
  {
    slug: "field-crypto",
    metaTitle: "Field Encryption, Per-Tenant AES-256-GCM | Caisson",
    metaDescription:
      "A distinct tenant key, KMS-wrapped in hosted production, plus a self-describing AES-256-GCM envelope and AAD that refuses relocated ciphertext.",
    heroOneLiner:
      "One protected key per tenant, and ciphertext moved to another tenant fails to decrypt, provably.",
    definition:
      "field-crypto seals values under a distinct AES-256-GCM key per tenant, using HKDF-SHA256 for dev/self-hosted deployments or request-scoped KMS envelope encryption in hosted production. Its self-describing envelope always binds tenant and column identity into the AEAD's additional authenticated data; explicit row-bound fields bind row identity too.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/field-crypto/browser inside a client bundle, a Cloudflare Worker, or any other WebCrypto-only runtime for the same HKDF derivation, AES-256-GCM seal and open, row-bound AAD, and envelope codec the server runs, over crypto.subtle and Uint8Array instead of node:crypto and Buffer (Node 20.12 or later). The main entry keeps the full surface including the KMS and Drizzle halves, every browser-entry export is also on it, and both directions of the interop are pinned byte-for-byte against the same fixtures.",
      },
      {
        title: "Fail-closed on every read and write",
        body: "encryptedColumn() wires a Drizzle customType whose toDriver/fromDriver only run inside withFieldCryptoContext. Reach an encrypted column with no bound tenant context and currentFieldCryptoContext() throws InternalError instead of returning a partial or unscoped result.",
      },
      {
        title: "Per-tenant keys, derived or KMS-wrapped",
        body: "DerivedKeyProvider keeps the zero-infrastructure dev/self-hosted path by folding tenant id and key version into HKDF-SHA256. Caisson's hosted production site instead persists only append-only wrapped DEKs, unwraps every historical version into a disposable request context, and zeroizes all plaintext key buffers at exit.",
      },
      {
        title: "AAD binds tenant, column, and row",
        body: "buildAad() serializes a JSON tuple (tenant id, key version, column context, and, for row-bound fields, the row's UUID) as GCM's additional authenticated data. Relocate the ciphertext to another tenant, column, or row and decryption fails as an AEAD authentication error, never a silent wrong-plaintext read.",
      },
      {
        title: "Self-describing envelope survives rotation",
        body: "serializeEnvelope() packs format version, algorithm id, and key version ahead of the nonce, ciphertext, and tag into one base64 string; parseEnvelope() reads the version back off the value itself. KeyVersionRegistry.rotate() bumps a tenant forward with no bulk re-encrypt job, older envelopes keep decrypting under the version they were written with.",
      },
      {
        title: "KMS envelope encryption behind one port",
        body: "KmsKeyProvider wraps a per-tenant data-encryption key under a KMS-held key-encryption key that never leaves the KMS, only the wrapped DEK is persisted. AWS KMS, GCP KMS, and Azure Key Vault drivers ship behind the same three-method KmsClient port; Caisson's hosted production site uses Azure with required purge protection.",
      },
      {
        title: "Crypto-shred erasure without breaking the audit chain",
        body: "cryptoShred() requests KEK deletion through the KMS port and mints an erasure.crypto-shred audit payload that carries no PII plus the provider-proven deletion state. The authorized host must persist and reconcile recoverable receipts; permanent cryptographic erasure is claimed only when the provider proves it irreversible. The WORM-anchored hash chain's committed bytes never change, so verifyChain still passes.",
      },
    ],
    artifact: {
      label: "decryptField(), the isolation proof",
      lang: "ts",
      file: "packages/field-crypto/src/crypto.ts",
      code: '  async decryptField(\n    tenantId: string,\n    stored: string,\n    columnContext: string,\n  ): Promise<string> {\n    const env = parseEnvelope(stored);\n    const key = await this.provider.keyFor(tenantId, env.keyVersion);\n    const aad = buildAad(tenantId, env.keyVersion, columnContext);\n    const cipher = cipherForAlg(env.algId);\n    let plaintext: Buffer | undefined;\n    try {\n      plaintext = cipher.decrypt(\n        key,\n        { nonce: env.nonce, ciphertext: env.ciphertext, tag: env.tag },\n        aad,\n      );\n      return plaintext.toString("utf8");\n    } finally {\n      plaintext?.fill(0);\n      key.fill(0);\n    }\n  }',
      annotations: [
        "parseEnvelope reads the key version back off the stored value itself, so a ciphertext written under an older version still decrypts after rotation, no migration job, no lookup table.",
        "buildAad binds tenant and column identity into the AEAD's additional authenticated data, decrypt under the wrong tenant or column and cipher.decrypt throws, it never returns the wrong plaintext.",
        "The finally block zeroizes both the plaintext buffer and the unwrapped DEK when the call settles, whether it returns or throws. Request-scoped disposal on abort is a separate seam, withKmsFieldCryptoContext, and covers the keys that context owns.",
      ],
    },
    faq: [
      {
        question: "Does field encryption make us HIPAA or SOC 2 compliant?",
        answer:
          "No, no module makes an organization compliant; that determination is your organization's and its auditor's to make. field-crypto ships the technical control both frameworks point at for data at rest: a distinct key per tenant and cryptographic proof, not a policy statement, that a ciphertext can't cross tenant boundaries.",
      },
      {
        question: "What happens when I rotate a tenant's key?",
        answer:
          "KeyVersionRegistry.rotate() bumps the tenant to the next version; new writes encrypt under it immediately. There's no bulk re-encrypt job, every envelope carries its own key_version, so a value written under an older version keeps decrypting until its next write lazily re-encrypts it under the current one.",
      },
      {
        question: "Can I use our own KMS instead of the derived key?",
        answer:
          "Yes. FieldKeyProvider is the two-method key port: the library's DerivedKeyProvider serves zero-infrastructure dev/self-hosted deployments, while KmsKeyProvider works with the shipped AWS, GCP, and Azure clients. Caisson's hosted production site binds Azure-backed keys in a disposable request context and never falls back after a KMS failure.",
      },
      {
        question:
          "How does this handle a GDPR or CCPA erasure request without breaking our immutable audit log?",
        answer:
          "cryptoShred() validates that the destructive key scope matches the recorded tenant or subject, refuses an unprovisioned scope, requests deletion, and returns the KMS receipt. The authorized host persists and reconciles a soft-deleted or scheduled key until its retention or cancellation window closes; permanent erasure is recorded only after an irreversible receipt. The append-only WORM chain still verifies because it committed ciphertext, never plaintext.",
      },
    ],
  },
  {
    slug: "audit-worm",
    metaTitle: "Audit Chain + WORM, append-only audit log | Caisson",
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
      annotations: [
        "The truncation guard checks for a WORM anchor ONE PAST the DB's current length, that catches a cut tail even though the surviving rows still hash together as a clean prefix.",
        "entries.length === 0 short-circuits to a valid empty chain, a brand-new tenant never has to special-case verify.",
      ],
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
          "If I use this standalone, do I also get retention policy scheduling?",
        answer:
          "No. Audit Chain + WORM is the storage and verification primitive (chain, anchor, S3 Object-Lock, retention floor/escalation). Scheduled expiry and legal-hold enforcement is the separate Retention Runner module; Compliance composes both.",
      },
    ],
  },
  {
    slug: "retention-runner",
    metaTitle: "Retention Runner, CCPA/GDPR Erasure Module | Caisson",
    metaDescription:
      "The right-to-erasure runner in Caisson's Compliance bundle: multi-store erasure, per-target failure isolation, one audit row per run, scheduled or on request.",
    heroOneLiner:
      "One erasure request, every store, one audit row, even when a target fails.",
    definition:
      "Retention runner is Caisson's CCPA/GDPR right-to-erasure module: `runErasure` fans one subject's erasure out across every registered store (object storage, cascade DB, orphan sweep), isolates each target's failure so one broken store never blocks the others, and writes exactly one reason-tagged audit row per run.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/retention-runner/browser inside a client bundle for the request contract, the ErasureTarget port with all three reference drivers, the audit-sink port with its in-memory driver, and runErasure itself. The scheduling half stays on the main entry, which keeps the complete node-capable surface, and every browser-entry export is also on it.",
      },
      {
        title: "Three reference erasure targets",
        body: "createObjectStorageTarget, createCascadeDbTarget, and createOrphanSweepTarget each take an injected minimal client (purge / cascadeDelete / sweep), the real S3 or Postgres client is a documented seam, never a package dependency. No aws-sdk or pg import ships in retention-runner itself.",
      },
      {
        title: "Per-target error isolation",
        body: "eraseOne catches every target's throw into a TargetResult ({ target, ok, error? }) instead of letting it propagate. runErasure runs all targets and always returns a full result set, a failing object-storage purge doesn't stop the cascade DB delete from running.",
      },
      {
        title: "One reason-tagged audit row per run",
        body: "erasureReasonSchema is a closed Zod enum, auto_90d, ccpa_request, or operator_manual; an unrecognized reason fails parseStrict before any target runs. The row lands in retention_audit (migration 0001), and migration 0002 adds FORCE ROW LEVEL SECURITY scoped to app.current_account so one tenant's erasure history can't leak into another's query.",
      },
      {
        title: "Recurring auto_90d sweep on @caisson/jobs",
        body: "defineRetentionTask returns a TaskDefinition for @caisson/jobs; enqueueAutoSweep enqueues it under a singletonKey of `${tenantId}:${subjectId}` so a long-running erasure can't double-run for the same subject while distinct subjects still sweep in parallel.",
      },
      {
        title: "Deterministic, testable runs",
        body: "runErasure takes an injected now: () => number clock (defaults to Date.now) instead of calling the real clock inline, every test in run-erasure.test.ts pins a fixed timestamp and asserts the exact audit row written.",
      },
    ],
    artifact: {
      label:
        "runErasure, validate, fan out with isolation, write one audit row",
      lang: "ts",
      file: "packages/retention-runner/src/run-erasure.ts",
      code: "export async function runErasure(\n  request: ErasureRequest,\n  targets: ErasureTarget[],\n  sink: RetentionAuditSink,\n  now: () => number = Date.now,\n): Promise<RetentionRunResult> {\n  const { subjectId, tenantId, reason } = parseStrict(\n    erasureRequestSchema,\n    request,\n  );\n\n  const results = await Promise.all(\n    targets.map((target) => eraseOne(target, subjectId, tenantId)),\n  );\n\n  const row: RetentionRunResult = {\n    subjectId,\n    tenantId,\n    reason,\n    results,\n    at: now(),\n  };\n  await sink.record(row);\n  return row;\n}",
      annotations: [
        "parseStrict validates the request before any target runs, an unrecognized reason never gets partway through an erasure.",
        "Promise.all over eraseOne means every target attempts erasure independently, one target's throw doesn't cancel or block the others.",
      ],
    },
    faq: [
      {
        question:
          "Does retention runner delete data automatically, or do I trigger it myself?",
        answer:
          "Both. auto_90d is the recurring scheduled sweep, enqueueAutoSweep puts one job per subject due for erasure onto a @caisson/jobs queue. ccpa_request and operator_manual are one-shot calls straight into runErasure with no queue involved, for a subject request or an operator-initiated erasure.",
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
          "Yes. Migration 0002 enables FORCE ROW LEVEL SECURITY on retention_audit with a policy scoped to app.current_account, a query that never binds a tenant context returns zero rows, not another tenant's erasure history.",
      },
      {
        question:
          "Does running retention runner make us GDPR or CCPA compliant?",
        answer:
          "No single module does that. Retention runner ships the erasure execution and the audit row proving a subject's data was purged across every registered store, it's the technical control an auditor checks for, generated as evidence, not a compliance certificate.",
      },
    ],
  },
  {
    slug: "alerting",
    metaTitle: "Alerting, the SOC 2 CC7.2 alert pipeline | Caisson",
    metaDescription:
      "Deduped, rate-capped, quiet-hours alert delivery to email, webhook, Slack, and Telegram, with a structured audit row per outcome, the SOC 2 CC7.2 control.",
    heroOneLiner:
      "Five deterministic stages between an event and a delivered alert, dedup, rate-cap, quiet hours, multi-channel send, one audit row.",
    definition:
      "The alerting module is Caisson's SOC 2 CC7.2 alert-delivery control: a five-stage pipeline (dedup, rate-cap-to-digest, IANA-timezone quiet hours with a critical override, multi-channel delivery (email, webhook, Slack, Telegram), then a structured audit row) that runs deterministically because every dependency, including the clock, is injected.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/alerting/browser inside a client bundle for the event contract, all three decision stages, the delivery port with its isolation wrapper and capture driver, the audit port with its in-memory driver, and processAlert itself. The five network drivers stay on the main entry, which keeps the complete node-capable surface, and every browser-entry export is also on it.",
      },
      {
        title: "Dedup on an open incident's key",
        body: "dedup() suppresses a repeat event while an incident sharing its dedupeKey is still open, so a flapping check doesn't re-fire an alert that already has a live incident.",
      },
      {
        title: "Rate-cap to a digest, never a drop",
        body: 'rateCap() checks the recipient\'s recent send count against a per-event-type RateCapPolicy; once the window\'s maxPerWindow is reached the outcome flips to "digest" instead of "deliver", noisy alert types back off, they don\'t vanish.',
      },
      {
        title: "IANA-timezone quiet hours, critical overrides",
        body: 'quietHours() resolves the recipient\'s local hour via Intl.DateTimeFormat (no timezone database dependency) and holds delivery inside the configured window, except a "critical" severity event always delivers, no matter the hour.',
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
        body: "processAlert() always calls auditSink.record() exactly once (delivered, suppressed, held, or digested) into a plain, RLS-forced Postgres table (alert_audit_log), explicitly not the hash-chained WORM audit-worm product; the two are kept deliberately distinct.",
      },
    ],
    artifact: {
      label:
        "processAlert, five stages, short-circuit at the first non-deliver outcome, exactly one audit row either way",
      lang: "ts",
      file: "packages/alerting/src/orchestrator.ts",
      code: 'export async function processAlert(\n  event: AlertEvent,\n  deps: ProcessAlertDeps,\n): Promise<ProcessAlertResult> {\n  if (dedup(event, deps.openIncidents)) {\n    return finish(event, deps, "suppressed", []);\n  }\n\n  if (rateCap(event, deps.recentCount, deps.ratePolicy) === "digest") {\n    return finish(event, deps, "digested", []);\n  }\n\n  if (\n    quietHours(event, deps.recipientTz, deps.quietPolicy, deps.now) === "hold"\n  ) {\n    return finish(event, deps, "held", []);\n  }\n\n  const deliveries = await deliverAll(event, deps.channels);\n  return finish(event, deps, "delivered", deliveries);\n}',
      annotations: [
        "Each stage (dedup, rateCap, quietHours) can short-circuit to its own finish() outcome before a channel is ever touched.",
        "deliverAll only runs after all three gates pass, and finish() fires on every path, the audit row is written whether or not anything actually delivered.",
      ],
    },
    faq: [
      {
        question: "What SOC 2 control does the alerting module satisfy?",
        answer:
          "CC7.2 (detection of, and response to, unauthorized or anomalous changes. The pipeline routes a qualifying event through dedup, rate-cap, and quiet hours to a real channel and writes one audit row per outcome. That ships the technical control; it doesn't make you SOC 2 compliant on its own) compliance status is your auditor's call.",
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
          'deliverAll() runs every configured channel through Promise.all and catches each one\'s throw into its own failed DeliveryResult, a down Slack webhook returns { channel: "slack", ok: false, error }, while email and webhook still deliver. One channel failing never aborts the others.',
      },
      {
        question:
          "Can I use the alerting module standalone, or only inside Compliance?",
        answer:
          "Standalone, yes. It's also composed directly into the Compliance family, re-exported from its entry point (\"export * from '@caisson/alerting'\") rather than just listed on a manifest, so Compliance gets you the same package, not a promise of it.",
      },
    ],
  },
  {
    slug: "access-review",
    metaTitle: "Access Reviews, Attested Campaigns | Caisson",
    metaDescription:
      "Import a reviewer roster, append approve or revoke decisions to the tenant audit chain, and close each campaign with every undecided reviewee reported unresolved.",
    heroOneLiner:
      "A review campaign closes complete or at its deadline, and every missing decision stays visible as unresolved, never guessed into approval.",
    definition:
      "access-review is the headless campaign kernel for periodic entitlement attestation: openCampaign freezes an imported reviewer roster, recordDecision appends approve or revoke decisions to the tenant audit chain, and closeCampaign refuses an early partial close. At deadline, scanCampaignDecisions reports every undecided reviewee as unresolved, never approved. Job task definitions carry the same lifecycle onto a recurring cadence.",
    included: [
      {
        title: "CSV, JSON, or in-memory membership snapshots",
        body: "createCsvMembershipSnapshotSource(), createJsonMembershipSnapshotSource(), and createInMemoryMembershipSnapshotSource() validate three input forms into the same frozen reviewer and reviewee roster. The adapters perform no I/O themselves, so your loader stays at the edge and every campaign receives the same parsed MembershipSnapshot shape.",
      },
      {
        title: "Strict campaign boundaries",
        body: "openCampaignSchema, recordDecisionSchema, and closeCampaignSchema reject unknown fields before the lifecycle touches Postgres or the chain. Reviewee ids are bounded, rosters must be unique, campaign windows are positive and capped by MAX_CAMPAIGN_WINDOW_MS, and every account or campaign id must be a UUID.",
      },
      {
        title: "One chained record per lifecycle event",
        body: "openCampaign(), recordDecision(), and closeCampaign() append CAMPAIGN_OPENED_RECORD, CAMPAIGN_DECISION_RECORD, and CAMPAIGN_CLOSED_RECORD payloads through the narrow CampaignChainStore port. The mutable campaign row answers operational queries; the append-only chain preserves who decided what and the unresolved roster recorded at close.",
      },
      {
        title: "Latest decision wins, absence stays unresolved",
        body: "scanCampaignDecisions() sorts loaded entries by sequence, takes the latest approve or revoke decision per reviewee, and returns the frozen roster members with no decision. closeCampaign() refuses while the campaign is incomplete and not due; at the deadline it records that unresolved list as-is, never as approval.",
      },
      {
        title: "Recurring open and close jobs",
        body: "defineCampaignOpenTask() and defineCampaignCloseTask() expose the lifecycle as @caisson/jobs task definitions. enqueueCampaignOpen() uses a tenant-and-reviewer singleton key, while enqueueCampaignClose() keys by tenant and campaign, so overlapping schedule ticks do not enqueue the same review twice.",
      },
    ],
    artifact: {
      label:
        "scanCampaignDecisions, the flag-never-guess decision fold over the audit chain",
      lang: "ts",
      file: "packages/access-review/src/decisions.ts",
      code: 'export function scanCampaignDecisions(\n  entries: readonly AuditChainEntry[],\n  campaignId: string,\n  reviewees: readonly string[],\n): CampaignDecisionScan {\n  const decisions = new Map<string, ReviewDecision>();\n  // "Latest wins" depends on seq-ascending iteration order — sort defensively rather than trust\n  // the caller\'s ordering (entries is fully in memory already, so this is one cheap pass).\n  const bySeq = [...entries].sort((a, b) => a.seq - b.seq);\n  for (const entry of bySeq) {\n    const decision = decisionFromEntry(entry, campaignId);\n    if (decision !== null)\n      decisions.set(decision.revieweeId, decision.decision);\n  }\n  const unresolved = reviewees.filter((r) => !decisions.has(r));\n  return { decisions, unresolved };\n}',
      annotations: [
        "scanCampaignDecisions sorts by seq before folding, so a revised decision supersedes the earlier append even when the caller supplied entries out of order.",
        "scanCampaignDecisions derives unresolved from the frozen roster after the fold; no missing decision enters the decisions map as an approval.",
      ],
    },
    faq: [
      {
        question: "Does access-review include a reviewer portal?",
        answer:
          "No. It is a headless campaign package: snapshot adapters, strict lifecycle functions, job definitions, and the audit-chain port. Your app owns the reviewer-facing route and authentication. The live control on this page is a deterministic demonstration of the package logic, not a hosted review service.",
      },
      {
        question: "Can a reviewer revise an earlier decision?",
        answer:
          "Yes. recordDecision() appends the revision instead of editing history, and scanCampaignDecisions() takes the latest entry by sequence. A decision is refused when its campaign read observes closed_at, but that read is not atomic with closeCampaign(): a decision already racing the close can append after campaign.closed and does not change the unresolved list already reported at close.",
      },
      {
        question:
          "What happens when the deadline arrives with decisions missing?",
        answer:
          "closeCampaign() can close because the campaign is due, but it does not fill the gaps. It appends CAMPAIGN_CLOSED_RECORD with every still-undecided reviewee in unresolved and returns the same list to the caller.",
      },
      {
        question: "What audit store does the standalone module require?",
        answer:
          "You inject a CampaignChainStore implementing append() and load(); the real AuditChainStore satisfies that narrow port. A standalone purchase gives you the campaign package, not a hosted chain. The Compliance bundle grants access-review and audit-worm together if you want both source packages.",
      },
    ],
  },
  {
    slug: "risk-register",
    metaTitle: "AI Risk Register, Computed Residuals | Caisson",
    metaDescription:
      "Likelihood by impact scoring with a computed residual, WORM-logged operator overrides, framework crosswalk pointers, and a deterministic treatment-plan artifact.",
    heroOneLiner:
      "The residual is computed from likelihood and impact; an operator can override the judgment, but never rewrite the score that came before it.",
    definition:
      "risk-register is a framework-agnostic risk model: defineRiskEntry derives a branded likelihood by impact residual that callers cannot supply, recordResidualOverride writes a separate exception to the tenant audit chain, and buildRiskTreatmentPlan emits a deterministic, crosswalk-linked evidence artifact. Computed and effective scores remain side by side, so an operator judgment never rewrites the original rating.",
    included: [
      {
        title: "Strict authored risk rows",
        body: "defineRiskEntry() parses RiskEntryInput without accepting a residual field, then returns a fully checked RiskEntry carrying subject, likelihood, impact, treatment plan, owner, SHA-256 evidence digest, and framework crosswalk pointers. Unknown fields and malformed digests fail before a row is admitted.",
      },
      {
        title: "Residuals are derived, not typed in",
        body: "computeResidual() is the only function that returns the nominal Residual type, multiplying the fixed Likelihood and Impact ordinals into an integer from 1 through 25. The runtime RiskEntry schema re-computes that value as a second check, so a hand-assembled mismatch is rejected too.",
      },
      {
        title: "Overrides stay separate and accountable",
        body: "recordResidualOverride() leaves the RiskEntry residual untouched and appends a RiskResidualOverrideRecord carrying the computed score, override score, who, why, and when. If the chain append fails, the function throws an evidence-gap InternalError instead of returning an override no audit trail can prove.",
      },
      {
        title: "Deterministic treatment-plan evidence",
        body: "buildRiskTreatmentPlan() re-derives every computed score, applies the supplied latest override only to effectiveResidual, sorts rows by riskId, and returns canonicalize(toJson(plan)) as canonicalPlan. Identical register state produces identical bytes regardless of input order, filesystem, locale, or clock.",
      },
      {
        title: "Summary counts cannot be fabricated",
        body: "riskTreatmentPlanSchema derives totalRisks, overriddenCount, and unmitigatedCount from the actual rows and rejects any mismatched summary. RISK_TREATMENT_PLAN_FORMAT_VERSION pins the artifact contract, while the posture stays readiness-style, recording treatment coverage without claiming compliance.",
      },
    ],
    artifact: {
      label:
        "defineRiskEntry, the only authored-row path and its computed residual",
      lang: "ts",
      file: "packages/risk-register/src/model.ts",
      code: "export function defineRiskEntry(input: RiskEntryInput): RiskEntry {\n  const parsed = parseStrict(RiskEntryInput, input);\n  const residual = computeResidual(parsed.likelihood, parsed.impact);\n  return parseStrict(RiskEntry, { ...parsed, residual });\n}",
      annotations: [
        "defineRiskEntry parses RiskEntryInput before it derives anything, so callers cannot smuggle a residual or an unknown field into the authored row.",
        "computeResidual is the sole residual mint in this path; the finished object is parsed through RiskEntry again, including its likelihood-by-impact cross-check.",
      ],
    },
    faq: [
      {
        question: "Can an API caller supply the residual score directly?",
        answer:
          "No. RiskEntryInput has no residual field, and defineRiskEntry() derives it through computeResidual(). The resulting Residual is nominally branded at the type level, then RiskEntry re-computes and checks it at runtime as a second belt.",
      },
      {
        question: "Does an operator override erase the computed score?",
        answer:
          "No. recordResidualOverride() appends a separate risk.residual-overridden chain record. buildRiskTreatmentPlan() keeps computedResidual and effectiveResidual side by side, plus who, why, when, and the override score, so the original model output remains recoverable.",
      },
      {
        question: "Is the register limited to the EU AI Act?",
        answer:
          "No. The model is framework-agnostic. Each RiskEntry carries CrosswalkReference-shaped pointers into any shipped framework pack, while compliance-core uses the same model for its EU AI Act risk-management collector.",
      },
      {
        question:
          "Does buildRiskTreatmentPlan write a file or read the audit chain?",
        answer:
          "Neither. It is a pure builder over the RiskEntry rows and latest overrides you supply. It returns the validated plan plus canonicalPlan; your application resolves the latest chain records and decides where to persist or package the artifact.",
      },
    ],
  },
  {
    slug: "trust-page",
    metaTitle: "Trust Page Generator, Allowlist-Redacted | Caisson",
    metaDescription:
      "Generate self-contained HTML and JSON from an evidence pack after an allowlist redaction gate, with aggregate-only defaults and readiness-language checks.",
    heroOneLiner:
      "A fact absent from the allowlist reaches neither HTML nor JSON, and the default page exposes aggregate posture without tenant or control detail.",
    definition:
      "trust-page is a pure generator that turns an EvidencePackManifest into self-contained HTML and JSON for a buyer-hosted trust page. flattenManifestFacts defines the only fields that can appear; generateTrustPage filters that universe through DEFAULT_TRUST_PAGE_ALLOWLIST before rendering either output and rejects prohibited readiness claims. It adds no auth, comments, sign-off, hosting, or runtime fetch.",
    included: [
      {
        title: "A finite fact ceiling before redaction",
        body: "flattenManifestFacts() converts the evidence-pack manifest into the flat scalar key universe the generator can render. Tenant id, framework identity, chain-anchor values, summary counts, and per-control fields enter through this one function; a fabricated field outside that universe has no route into either output.",
      },
      {
        title: "Aggregate-only defaults",
        body: "DEFAULT_TRUST_PAGE_ALLOWLIST admits framework title and version plus aggregate posture, total, ready, and gap counts. It excludes tenantId, the raw chain-anchor hash, total evidence count, every per-control title and readiness value, and the crosswalk table unless the caller opts each field in.",
      },
      {
        title: "Crosswalk rows require explicit opt-in",
        body: "CROSSWALK_ROLLUP_ROWS_KEY is the sentinel that enables generateTrustPage() to render the crosswalk-rollup table. Without that exact allowlist entry, the HTML contains no table and the JSON crosswalk stays empty; opting in also exposes the cells' evidence pointers, so the choice is visible and deliberate.",
      },
      {
        title: "HTML and JSON are independently self-contained",
        body: "generateTrustPage() returns a TrustPage-shaped pair of complete static HTML and newline-terminated JSON. Neither output fetches the other at runtime, and sorted fact keys keep both stable across caller allowlist order, so a buyer can host either artifact anywhere without a Caisson service.",
      },
      {
        title: "Readiness language is enforced",
        body: "generateTrustPage() runs every rendered string through the shared readiness-language gate before returning. A prohibited compliant, certified, or verified claim throws instead of entering the artifact, while crosswalk rows pass through the same citation-row guard as the rest of the compliance render surface.",
      },
    ],
    artifact: {
      label:
        "generateTrustPage, allowlist first, readiness gate second, render last",
      lang: "ts",
      file: "packages/trust-page/src/render.ts",
      code: 'export function generateTrustPage(\n  manifest: EvidencePackManifest,\n  options: GenerateTrustPageOptions = {},\n): TrustPage {\n  const allowlist = options.allowlist ?? DEFAULT_TRUST_PAGE_ALLOWLIST;\n  const facts = redactToAllowlist(flattenManifestFacts(manifest), allowlist);\n  for (const [key, value] of Object.entries(facts)) {\n    if (typeof value === "string") {\n      assertReadinessLanguage(value, `trust page fact "${key}"`);\n    }\n  }\n  const rows = allowlist.includes(CROSSWALK_ROLLUP_ROWS_KEY)\n    ? crosswalkRollupRows(manifest)\n    : [];\n  return {\n    html: renderHtml(facts, rows),\n    json: renderJson(facts, rows),\n  };\n}',
      annotations: [
        "generateTrustPage calls flattenManifestFacts and redactToAllowlist before either renderer receives data; a field missing from the allowlist never enters HTML or JSON.",
        "DEFAULT_TRUST_PAGE_ALLOWLIST is the fallback when the caller supplies no override, and generateTrustPage still runs every surviving string through the readiness-language gate.",
      ],
    },
    faq: [
      {
        question: "Is trust-page a hosted trust center?",
        answer:
          "No. generateTrustPage() is a pure source-code generator that returns static HTML and JSON. It ships no server, authentication, comments, sign-off, NDA gate, hosting, or runtime fetch; your application decides where and how the artifacts are published.",
      },
      {
        question: "What can the default page reveal?",
        answer:
          "Only the six DEFAULT_TRUST_PAGE_ALLOWLIST fields: framework title and version, aggregate posture, total controls, controls ready, and controls with gaps. Tenant id, raw anchor hashes, evidence totals, per-control detail, and crosswalk rows stay absent.",
      },
      {
        question: "Can the generated page claim we are compliant or certified?",
        answer:
          "No. generateTrustPage() sends every surviving string through assertReadinessLanguage before rendering. Prohibited outcome language throws instead of reaching the HTML or JSON; the page reports evidence readiness, never an auditor's conclusion.",
      },
      {
        question: "How do I show the crosswalk rollup?",
        answer:
          "Add CROSSWALK_ROLLUP_ROWS_KEY to the allowlist. That enables the citation-row table in HTML and the crosswalk array in JSON, including each cell's evidence pointers. Without the sentinel, both outputs omit those rows completely.",
      },
    ],
  },
  {
    slug: "ai-meter",
    metaTitle: "Token Metering, @caisson/ai-meter | Caisson",
    metaDescription:
      "PG-atomic reserve/reconcile token metering for LLM calls: per-tenant spend caps, a circuit breaker, and a MinHash dedup gate. Integer credits only, no floats.",
    heroOneLiner:
      "Reserve a token estimate before the call, true it to actual usage after: a runaway prompt loop 402s on the next call instead of running your bill up.",
    definition:
      "ai-meter is the metered-inference money path: estimate a call's cost, reserve integer credits against it before the provider answers, then reconcile to the provider's actual reported usage. A per-tenant spend window and circuit breaker sit on top, so a crossed hard cap blocks the next reservation before a provider call ever fires; the block is checked against real usage, never assumed.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/ai-meter/browser inside a client bundle for the pure half: BUNDLED_PRICE_BOOK with computeCost and creditsForMicroUsd, the estimateTokens/estimateUsage estimator, and the spend vocabulary including SpendCapError. The main entry keeps the full surface, every browser-entry export is also on it, and nothing that moves a credit or takes a database handle is reachable from it.",
      },
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
      annotations: [
        "A non-negative amount runs as an upsert (ON CONFLICT ... DO UPDATE), the spend-window row may not exist yet when the very first reservation for that key lands.",
        "The doc comment explains the ordering trick: a negative refund evaluates the spent >= 0 CHECK on the UPDATE path, never the INSERT path, so a refund can't trip the constraint before the conflict resolves.",
      ],
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
  },
  {
    slug: "ai-evals",
    metaTitle: "Eval Harness Module, Regression Gate for LLM Code",
    metaDescription:
      "A CI eval harness that fails the build on a real score regression against a committed baseline, cassette-replayed judges, no live model call in CI.",
    heroOneLiner:
      "Regression-grade evals that run in CI, not in prod. A model swap fails the build first, not a customer's session.",
    definition:
      "@caisson/ai-evals is a regression gate for prompt and model changes: defineEval() scores a version-bound dataset through a grader taxonomy, then compareToBaseline() fails the build if the mean score, any individual scorer, or a Wilson confidence floor drops below the committed baseline, offline and deterministic, no live provider call inside CI.",
    included: [
      {
        title: "Version-bound eval runs",
        body: 'defineEval({ name, promptVersionId, cases, scorers, threshold }) grades every case with every scorer and returns a deterministic EvalRun. Each dataset carries a promptVersionId FK, so a score is always attributable to one immutable prompt version, never a floating "current prompt."',
      },
      {
        title: "Six graders, two classes",
        body: "Deterministic exactGrader/regexGrader/jsonShapeGrader/schemaGrader run pure, offline, no model. judgeGrader routes through the Judge port for model-graded scoring. injectionGrader is its own fail-closed substring-denial class that a graded input can never talk its way past, an empty rubric throws instead of silently passing.",
      },
      {
        title: "Committed-baseline regression gate",
        body: "gateAgainstBaseline() compares each run to a committed JSON baseline and fails closed: a missing baseline, a score below threshold, or any scorer regression blocks the gate. BLESS=1 bun run eval is the one sanctioned path to rewrite it, mirroring the golden-fixture discipline in @caisson/testing.",
      },
      {
        title: "Offline judge via cassette replay",
        body: "cassetteJudge() replays recorded verdicts from a committed cassette, zero network, zero provider secret, in CI. An unrecorded case id is a hard cassette-miss error, not a silent pass. recordingJudge() wraps a real local judge to mint a fresh cassette for review before it's committed.",
      },
      {
        title: "Wilson confidence floor and exit classifier",
        body: "wilsonLowerBound() threads an opt-in confidence floor into the baseline gate so a small lucky-draw sample can't pass as reliable. classifyExit() tags WHY a run exited (error, timeout, budget-exhausted, refusal, empty-output) as a signal orthogonal to pass/fail.",
      },
      {
        title: "Reflexivity queue for judge/human disagreement",
        body: "captureDisagreement() enqueues a case only when the model verdict and a human verdict disagree; consolidateReflexivityQueue() dedupes and caps the list for operator review. Nothing here auto-writes a committed dataset, merging a candidate back in stays a human act.",
      },
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/ai-evals/browser inside a client bundle for the gate's rules with no file I/O: the baseline boundary schema, compareToBaseline, the pre-bless eligibility check, the bless merge, and wilsonLowerBound. gateAgainstBaseline stays on the main entry because it reads and writes the committed baseline file, and every browser-entry export is also on the main entry.",
      },
    ],
    artifact: {
      label: "The fail-closed regression compare",
      lang: "ts",
      file: "packages/ai-evals/src/baseline-compare.ts",
      code: 'export function compareToBaseline(\n  run: EvalRun,\n  baseline: BaselineFile,\n): BaselineComparison {\n  const findings: RegressionFinding[] = [];\n\n  if (run.score + EPS < run.threshold) {\n    findings.push({\n      kind: "below-threshold",\n      actual: run.score,\n      baseline: run.threshold,\n      detail: `score ${run.score} < threshold ${run.threshold}`,\n    });\n  }\n\n  const prior = baseline.evals[run.name];\n  if (prior === undefined) {\n    findings.push({\n      kind: "missing-baseline",\n      actual: run.score,\n      detail: `no committed baseline for eval "${run.name}" — bless to record it`,\n    });\n    return { eval: run.name, passed: false, findings, blessed: false };\n  }',
      annotations: [
        "The EPS tolerance on the threshold compare (run.score + EPS < run.threshold) avoids a false regression from float rounding noise, not just a strict less-than.",
        "A missing baseline returns its own missing-baseline finding immediately, it's never silently treated as a pass.",
      ],
    },
    faq: [
      {
        question: "Does the eval gate call a live model in CI?",
        answer:
          'No. Model-graded scorers route through cassetteJudge(), which replays a recorded verdict from a committed cassette file, zero network call, zero provider secret. An unrecorded case id is a hard error ("cassette miss"), not a silent pass. A live judge only runs locally, wrapped in recordingJudge() to mint the cassette you then commit.',
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
          'It fails closed. compareToBaseline() returns a "missing-baseline" finding rather than treating an absent entry as a pass, bless it once to record the starting baseline, same as any other eval.',
      },
      {
        question:
          "Does this eval gate get wired into CI on the app I generate?",
        answer:
          "No. The eval CLI runs as a distinct turbo eval task inside this monorepo only, it is never injected into a generated buyer repo as a required CI job. You own your own eval cadence once you generate.",
      },
    ],
  },
  {
    slug: "guardrails",
    metaTitle: "Guardrails: Fail-Closed Input/Output Guard | Caisson",
    metaDescription:
      "A fail-closed guard around every model call: PII redaction (mask, hash, or tokenize), a swappable moderator, and an unconditional secret-shape gate.",
    heroOneLiner:
      "The chokepoint between your app and the model, moderate, redact, and block, fail-closed by default.",
    definition:
      "Guardrails is the fail-closed input/output guard around a model call: guardInput moderates then redacts PII on the way in, guardOutput moderates on the way out, and either leg throws a 422 GuardrailError on a block instead of letting a moderator outage pass content through silently. A swappable Moderator port (local regex, provider, or custom) backs the moderation call; an unconditional secret-shape gate runs before it on either leg, no opt-out.",
    included: [
      {
        title: "Fail-closed by default",
        body: "guardInput and guardOutput throw GuardrailError (HTTP 422) on any block. A moderator outage or timeout fails closed unless the policy explicitly sets failOpen: true, the default protects the request, not the moderator's uptime.",
      },
      {
        title: "Unconditional secret-shape gate",
        body: 'Before either leg reaches a moderator, guard.ts checks looksLikeSecret(text) and blocks category "secret" with no policy field and no opt-out (ADR-0215), a leaked credential never gets a moderation call, live or not.',
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
        body: "evaluateFtc4P scores marketing/UI copy against five rule classes (false urgency, forced continuity, confirmshaming, opt-out enrollment, drip pricing) charted across four dimensions (prominence, presentation, placement, proximity). Wrap it as a Moderator with ftc4pModerator to gate guardOutput on your own copy.",
      },
      {
        title: "Metadata-only blocked event",
        body: "Every block emits a guardrail.blocked event to the kernel EventSink carrying blockId, stage, category, policy, and failClosed, never the flagged text. The emit is fire-and-forget: a telemetry-sink failure can't mask or delay the block itself.",
      },
    ],
    artifact: {
      label:
        "moderate(), the secret-shape gate, then a fail-closed moderator race under a deadline",
      lang: "ts",
      file: "packages/guardrails/src/guard.ts",
      code: '  // Unconditional credential-shape gate (ADR-0215) — runs BEFORE the (possibly outaged/provider)\n  // moderator, reusing the ONE `looksLikeSecret` predicate (kernel). No policy field, no opt-out: a\n  // raw credential in either leg never reaches a moderator call, live or not.\n  if (looksLikeSecret(text)) block(stage, "secret", false, policy, rt);\n  let result: ModerationResult;\n  try {\n    result = await moderateWithDeadline(\n      policy.moderator,\n      text,\n      policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,\n    );\n  } catch {\n    // Outage / timeout / driver throw → fail-closed unless the operator explicitly opted out.\n    if (policy.failOpen === true) return;\n    block(stage, "moderation", true, policy, rt);\n  }\n  if (result.flagged) block(stage, result.category, false, policy, rt);',
      annotations: [
        "looksLikeSecret runs before the moderator call, live or not, a leaked credential never becomes a moderation API call.",
        "The try/catch around moderateWithDeadline is where fail-closed lives: only an explicit failOpen: true on the policy lets an outage pass content through instead of blocking.",
      ],
    },
    faq: [
      {
        question:
          "What happens if the moderator times out or the provider is down?",
        answer:
          "The call fails closed: moderateWithDeadline races the moderator against a timeoutMs deadline (2,000ms by default), and a rejection (outage, timeout, or driver throw) blocks the request unless the policy explicitly sets failOpen: true.",
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
          'Yes. guard.ts runs looksLikeSecret(text) as an unconditional gate (category "secret") before either leg reaches the configured moderator. There is no policy field to disable it.',
      },
    ],
  },
  {
    slug: "prompt-registry",
    metaTitle: "Prompt Registry, Versioned Prompts | Caisson",
    metaDescription:
      "Append-only prompt versioning with name@version and name@alias addressing, a mutable alias pointer for zero-redeploy promotion, and injection-safe rendering.",
    heroOneLiner:
      "Prompts hardcoded three layers deep in a route handler, versioned like everything else that ships.",
    definition:
      "Prompt registry is a package that stores prompt templates as append-only versions and resolves them by name@version or name@alias. Every edit mints a new row instead of mutating one (the database revokes UPDATE and DELETE outright) and a mutable alias pointer (prod, canary) lets you promote a prompt to production without a redeploy or touching a version row.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/prompt-registry/browser inside a client bundle for name@version addressing and the injection-safe render boundary with its strict variable schemas. The registry functions and the schema stay off that entry on purpose, each takes a TenantExecutor and runs SQL, so tenant isolation stays on the server. The main entry keeps the full surface, and every browser-entry export is also on it.",
      },
      {
        title: "Append-only versioning, not a mutable prompts table",
        body: "registerPrompt derives the current tip from the kernel's versioning chain and supersedes it, the first call to a name is v1, each later call is tip.version + 1. A concurrent mint of the same (name, version) hits the unique index and throws ConflictError instead of silently overwriting.",
      },
      {
        title: "name@version and name@alias addressing",
        body: "parsePromptRef reads a bare name as the current tip, a numeric suffix as an exact version, and anything else as an alias. resolvePrompt takes that parsed reference straight to the matching row, one function call from a string ref to an immutable PromptVersion.",
      },
      {
        title: "Promote without a redeploy",
        body: "setAlias points prod or canary at a specific version number. It resolves the target version first, so an alias can never point at a version that doesn't exist, and it only ever writes the prompt_alias pointer row, the version rows themselves are never touched.",
      },
      {
        title: "Injection-safe rendering, not string interpolation",
        body: "renderPrompt validates raw vars against the version's own varSpec (a strict Zod schema, unknown vars rejected, missing vars fail), then substitutes {{name}} placeholders in a single non-recursive pass. Every inserted value is brace-escaped, so a variable's own content can never open a new placeholder or forge a message role.",
      },
      {
        title: "Every table is tenant-isolated by default",
        body: "prompt_version and prompt_alias both go through buildTenantPolicySql (force-RLS), and every registry function takes a TenantExecutor, a query outside a withTenant scope sees nothing, not an empty result you have to remember to check for.",
      },
      {
        title: "The render contract is pinned, not just tested",
        body: "The single-pass, brace-escaped rendering behavior is locked against a golden fixture (src/__golden__/render.json), a change to the substitution logic that shifts the output has to update the fixture deliberately, it can't drift silently through a passing test suite.",
      },
    ],
    artifact: {
      label:
        "renderContent, single-pass substitution, brace-escaped, re-checked against the content cap after escaping",
      lang: "ts",
      file: "packages/prompt-registry/src/render.ts",
      code: 'function renderContent(template: string, vars: Record<string, string>): string {\n  const rendered = template.replace(PLACEHOLDER_RE, (_match, name: string) => {\n    const value = vars[name];\n    if (value === undefined) {\n      // A placeholder with no bound variable is a template/schema mismatch — never emit it raw.\n      throw new ValidationError("Unbound prompt variable", { name });\n    }\n    return escapeValue(value);\n  });\n  // Escaping can inflate a value (every `{`/`}` doubles), and several per-cap-bounded values can\n  // still sum past the cap in one template — re-check the rendered total, not just each input.\n  if (rendered.length > MAX_CONTENT_LENGTH) {\n    throw new ValidationError(\n      "Rendered prompt content exceeds the content cap",\n      {\n        length: rendered.length,\n        max: MAX_CONTENT_LENGTH,\n      },\n    );\n  }\n  return rendered;\n}',
      annotations: [
        "escapeValue runs on every substituted value, a variable's own content can never forge a new {{placeholder}} or escape into the surrounding template.",
        "The length check runs AFTER escaping, not before, escaping can inflate a value, so the cap has to catch the real rendered total, not the pre-escape input.",
      ],
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
          'Point the alias at it, setAlias(tx, { accountId, name, alias: "prod", version: 3 }) moves the prod pointer back to version 3. Nothing is deleted or re-inserted; the version 4 row that\'s no longer live stays exactly where it is for as long as you keep it.',
      },
      {
        question:
          "What happens if I pass a variable the template doesn't declare, or forget one it does?",
        answer:
          "renderPrompt compiles the version's varSpec into a strict Zod object schema before touching the template, an unknown key is rejected, a missing required key fails validation, and both happen before any substitution runs.",
      },
      {
        question:
          "Does this run as a hosted service or is it a library I call from my own code?",
        answer:
          "It's a library, a TenantExecutor-scoped API you import and call directly, the same primitive the AI Production Kit's inference gateway resolves prompt refs through before every model call. There's no standalone prompt-registry server or HTTP route; you own the calling code.",
      },
    ],
  },
  {
    slug: "local-store",
    metaTitle: "Local Vector Store, Hybrid FTS5 + sqlite-vec | Caisson",
    metaDescription:
      "A local canonical store for hybrid retrieval: sqlite-vec KNN fused with FTS5 by Reciprocal Rank Fusion, one SQLite file per tenant, no vector cloud involved.",
    heroOneLiner:
      "Hybrid vector + full-text search that runs on disk, in one SQLite file per tenant, nothing shipped to a vector cloud.",
    definition:
      "Local vector store is Caisson's on-disk hybrid retrieval engine: sqlite-vec (vec0) for KNN and SQLite FTS5 for text, fused by Reciprocal Rank Fusion (RRF_K=60). It runs FTS5-only with no embedder configured, the vector leg degrades cleanly on any backend fault. Tenant isolation is physical: one SQLite file per tenant, not a shared table with a filter.",
    included: [
      {
        title: "RRF hybrid search",
        body: "LocalStore.hybridSearch runs the vec0 KNN leg and the FTS5 leg independently, then fuses them by Reciprocal Rank Fusion (RRF_K=60). Either leg can come up empty (a missing query vector, an empty query, or a vec backend fault) and the other still returns results.",
      },
      {
        title: "File-per-tenant isolation",
        body: "tenantDbPath and openTenantDb resolve one SQLite file per tenant under a root directory. The path is rejected fail-closed on traversal, null bytes, absolute paths, or path separators before anything is opened, a cross-tenant query is not expressible, because a connection only ever holds one tenant's file.",
      },
      {
        title: "Pluggable embedder port, no bundled model",
        body: "Embedder is an interface the bundle wires, this package never calls a model or opens a socket. embedOrSkip treats an absent embedder as a first-class mode: retrieval runs on the FTS5 floor alone, not an error, not a silent default model.",
      },
      {
        title: "Cloud-egress secret scrub",
        body: "When a buyer does wire a cloud embedder, scrubForEgress runs on every text before it leaves the box, stripping PEM key blocks, URL userinfo passwords, secret-named assignments, and bare token shapes. guardEmbedder and createCloudEmbedder apply it structurally, not as an opt-in step.",
      },
      {
        title: "Dedup-on-write + retention GC",
        body: "decideWrite hashes normalized content per scope and reinforces an existing duplicate (resets its recency, slides its TTL) instead of writing a second row. planGc then evicts in order (expired, decayed below a score floor, or over a per-scope cap) as a pure function of items, config, and now.",
      },
      {
        title: "Validated memory-item boundary",
        body: "MemoryItemSchema is a Zod .strict() boundary: UUID ids, bounded text (100k chars) and scope (256 chars), optional string-to-string metadata. Unknown keys are rejected, not silently dropped.",
      },
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/local-store/browser inside a client bundle for fuseByRrf and RRF_K, the fusion arithmetic with no database attached, to merge leg rankings your server or worker already produced. Retrieval itself stays on the main entry: the vec0 KNN and FTS5 legs need bun:sqlite and the sqlite-vec native extension. Every browser-entry export is also on the main entry.",
      },
    ],
    artifact: {
      label:
        "fuseByRrf, the Reciprocal Rank Fusion hybridSearch merges both legs through (RRF_K=60)",
      lang: "ts",
      file: "packages/local-store/src/rrf.ts",
      code: 'export function fuseByRrf(\n  legs: readonly RrfLeg[],\n  opts: RrfOptions = {},\n): RrfRow[] {\n  const rrfK = opts.rrfK ?? RRF_K;\n  assertPositive(rrfK, "rrfK");\n  const fused = new Map<number, number>();\n  for (const leg of legs) {\n    assertPositive(leg.weight, "RRF leg weight");\n    for (const [key, rank] of leg.ranks) {\n      fused.set(key, (fused.get(key) ?? 0) + leg.weight / (rrfK + rank));\n    }\n  }\n  const ranked = [...fused.entries()].sort(\n    (a, b) => b[1] - a[1] || a[0] - b[0],\n  );\n  const rows = opts.limit === undefined ? ranked : ranked.slice(0, opts.limit);\n  return rows.map(([key, score]) => ({ key, score }));\n}',
      annotations: [
        "fuseByRrf sums weight/(RRF_K + rank) across every leg a document appears in, a doc that only hits in the vector leg or only the FTS5 leg still scores, it isn't dropped for missing the other.",
        "The sort's tie-break is key ascending, which is rowid order for hybridSearch, deterministic ranking with no dependence on wall-clock time or run-to-run ordering.",
        "The fusion has no database attached, which is why it is also the whole of the browser entry point while the vec0 and FTS5 legs stay server-side.",
      ],
    },
    faq: [
      {
        question: "Does local-store need a vector database service?",
        answer:
          "No. It's bun:sqlite plus the sqlite-vec extension (vec0) on disk, one file per tenant, no separate database to run or pay for.",
      },
      {
        question: "Do I have to bring my own embedding model?",
        answer:
          "Yes. Embedder is an interface the bundle or your app wires, local-store bundles no model and never calls one. With no embedder configured, retrieval runs on the FTS5 leg alone, which is a documented zero-config mode, not a degraded one.",
      },
      {
        question: "How is tenant data kept apart?",
        answer:
          "Physically. tenantDbPath resolves one SQLite file per tenant under a root directory and rejects traversal, null-byte, absolute, or separator-bearing tenant ids before any file is opened, there's no shared table a filter could get wrong.",
      },
      {
        question: "Is it safe to point this at a cloud embedding API?",
        answer:
          "createCloudEmbedder scrubs every text through scrubForEgress before it leaves the box, PEM blocks, URL passwords, secret-named fields, and bare token shapes are redacted to a constant sentinel first, and the transport is fetchWithTimeout with an injectable seam for tests.",
      },
    ],
  },
  {
    slug: "agent-kernel",
    metaTitle: "Agent Kernel, Governed Agent Lifecycle FSM | Caisson",
    metaDescription:
      "Agent Kernel: the agent/skill/rule schema, seven-act lifecycle FSM, and hooks dispatcher behind Caisson's Agentic-Dev bundle. No vendor SDK, usable standalone.",
    heroOneLiner:
      "The guarded agent lifecycle FSM: VERIFY failing reopens PLAN, there's no edge to SHIP.",
    definition:
      "Agent kernel is the engine-neutral base for governed AI agent work: a Zod schema for agent/skill/rule artifacts, a seven-act lifecycle state machine (spec through ship), allow/deny/mutate governance guards, a hooks dispatcher, and an opt-in tamper-evident audit-chain recorder. It imports no vendor SDK and runs no LLM: composition only, consumed by both the base CLI and the Agentic-Dev bundle.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/agent-kernel/browser inside a client bundle for the artifact schema and its authoring helpers, the lifecycle act FSM, the governance decision algebra, and the redacting logger. The main entry keeps the complete node-capable surface (the execFile command handler and the audited hash-chain lifecycle), and every browser-entry export is also on it.",
      },
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
        body: "AuditedLifecycle wraps every governed transition with the kernel's chainEntry/anchorChain/verifyChain hash-chain primitives, the same mechanism the Compliance bundle's audit-worm package uses. Off by default; set audited: true and each admitted step becomes an append-only, tamper-evident chain entry.",
      },
    ],
    artifact: {
      label: "TRANSITIONS: the seven-act lifecycle's only two branch edges",
      lang: "ts",
      file: "packages/agent-kernel/src/lifecycle.ts",
      code: '/**\n * Legal forward adjacency. The two branch edges:\n *   - `verify → plan` — a failed goal-backward verify opens a fresh PLAN cycle (does not SHIP).\n *   - `sweep → ship` — an untagged phase skips EVAL straight to SHIP.\n * An EVAL regression is a fail-stop (no edge out of `eval` but `ship`); `ship` is terminal.\n */\nconst TRANSITIONS: Record<Act, readonly Act[]> = {\n  spec: ["plan"],\n  plan: ["execute"],\n  execute: ["verify"],\n  verify: ["sweep", "plan"],\n  sweep: ["eval", "ship"],\n  eval: ["ship"],\n  ship: [],\n};',
      annotations: [
        "verify is the only act with two outgoing edges, a failed VERIFY reopens plan, it has no edge to ship.",
        "ship: [], an empty adjacency list makes SHIP a hard terminal state in the type itself, not just a documented convention.",
      ],
    },
    faq: [
      {
        question: "Does agent-kernel call an LLM or import a vendor SDK?",
        answer:
          "No. Its own package.json says it plainly: engine-neutral, no vendor SDK, no LLM call; the schema, FSM, governance, hooks, and audit-chain primitives are composition mechanism only, consumed down-only by the base cli/mcp-server and by the Agentic-Dev bundle.",
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
          "Does agent-kernel alone get me the sandboxed agent runner too?",
        answer:
          "No. agent-kernel is the schema/FSM/governance/hooks/audit-chain base; running an actual sandboxed agent process is agent-runner, a separate module. Both work standalone, as do the family's other modules (agent-trajectory, tool-exec, and local-store); the Agentic-Dev family additionally brings the local hybrid memory, the sandboxed tool-exec gate, and the multi-harness emitter (Claude Code, Cursor, Devin, GitHub Copilot, Cline, plus a universal AGENTS.md base read natively by Codex, Zed, and Gemini CLI, with fidelity warnings whenever a target can't represent an authored activation choice) that wire agent-kernel into one governed loop. Use the modules in your own tooling, or the whole family for the assembled loop.",
      },
    ],
  },
  {
    slug: "agent-runner",
    metaTitle: "Agent Runner, Sandboxed, Governed Agent Execution",
    metaDescription:
      "Agent Runner spawns a headless coding agent in an isolated worktree with a scrubbed, from-scratch env and streams an auditable .jsonl transcript of every run.",
    heroOneLiner:
      "Spawn a headless coding agent with a scrubbed environment, an isolated worktree, and a transcript you can audit line by line.",
    definition:
      "Agent Runner spawns a headless coding-agent CLI as a detached subprocess in a caller-supplied worktree, building its environment from scratch instead of inheriting the caller's. It streams the run's stream-json output to a durable .jsonl file and parses that transcript into a structured report of tool calls, files touched, and outcome.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/agent-runner/browser inside a client bundle for the ProviderConfig model, CLAUDE_CLI_PROFILE, PASSTHROUGH_KEYS, and buildEngineEnv, the same module the runner itself imports, so you can run and show the env scrub anywhere. The main entry keeps the full node-capable surface (detached spawn, run registry, transcript parsing), and every browser-entry export is also on it.",
      },
      {
        title: "Env built from scratch, not inherited",
        body: "buildEngineEnv() never spreads process.env. It starts from an empty object, copies only the PASSTHROUGH_KEYS allowlist (PATH, LANG, LC_ALL, LC_CTYPE, TERM, TZ, TMPDIR), then adds the target provider's routing vars and the one auth key the caller passed in, nothing else reaches the child.",
      },
      {
        title: "Provider-agnostic profile",
        body: "ProviderConfig is a Zod-validated {binary, baseUrlEnv, authEnv, model, configDirEnv, modelEnv, args} shape, no vendor is hardcoded. The shipped CLAUDE_CLI_PROFILE runs the Claude Code CLI headless in stream-json mode with --strict-mcp-config, so no MCP server can be smuggled into the sandbox.",
      },
      {
        title: "Whole-token argv templating",
        body: "The {task} and {model} placeholders in a provider's args are substituted only when they are an entire argv element, never spliced into a larger string, a hostile task string can't add, split, or merge argv entries, and there's no shell in the spawn path to inject into.",
      },
      {
        title: "Detached, isolated worktree spawn",
        body: "spawn() launches the agent CLI with its own HOME and config dir inside a caller-supplied worktree, detached and unref'd so the run survives the launcher process exiting. stdout and stderr write straight to the transcript file descriptor, so there's no pipe-pumping babysitter to lose data if the caller dies.",
      },
      {
        title: "A structured report, not a raw log",
        body: "summarize() walks the stream-json events into a tool-call count, the file set an Edit/Write/MultiEdit/NotebookEdit tool touched, and the last assistant text. finalReport() adds status, timestamps, binary, and model, the shape a caller reviews before trusting the diff.",
      },
      {
        title: "Fail-closed run registry",
        body: "Every RunMeta read off disk is .strict()-validated before use, and a runId is checked against a UUID shape before it ever becomes a path segment. status() self-heals a run whose process died without a recorded outcome, marking it done or error instead of leaving it falsely running forever.",
      },
    ],
    artifact: {
      label:
        "buildEngineEnv, the child env built from scratch, never spread from process.env",
      lang: "ts",
      file: "packages/agent-runner/src/engine-env.ts",
      code: '  const env: Record<string, string> = {};\n  for (const key of PASSTHROUGH_KEYS) {\n    const value = parentEnv[key];\n    if (typeof value === "string" && value.length > 0) env[key] = value;\n  }\n  // Isolation + provider routing only — no secret beyond the one provider key.\n  env["HOME"] = opts.home;\n  env[opts.provider.baseUrlEnv] = opts.baseUrl;\n  env[opts.provider.authEnv] = opts.authKey;\n  if (opts.provider.configDirEnv !== undefined) {\n    env[opts.provider.configDirEnv] = opts.configDir;\n  }\n  if (opts.provider.modelEnv !== undefined) {\n    env[opts.provider.modelEnv] = opts.provider.model;\n  }\n  // Hygiene for CLIs that honor these conventions: no self-update, no telemetry from the sandbox.\n  env["DISABLE_AUTOUPDATER"] = "1";\n  env["DISABLE_TELEMETRY"] = "1";\n  env["DISABLE_ERROR_REPORTING"] = "1";\n  return env;',
      annotations: [
        "The env object starts empty, PASSTHROUGH_KEYS is the only thing ever copied from the parent process, never a blanket process.env spread.",
        "Only the ONE target-provider auth key the caller passed in (opts.authKey) is added, every other secret sitting in the parent shell has no path into the child.",
      ],
    },
    faq: [
      {
        question:
          "Does the sandboxed subprocess ever see my API keys or other secrets?",
        answer:
          "No. buildEngineEnv() builds the child's environment from an empty object; it never spreads process.env. Only a fixed non-secret allowlist (PATH, LANG, LC_ALL, LC_CTYPE, TERM, TZ, TMPDIR) plus the one target-provider auth key the caller explicitly passes in reach the subprocess. The leak-guard test plants eight secret canaries (OPENROUTER_API_KEY, GITHUB_TOKEN, AWS_SECRET_ACCESS_KEY, and five more) into a polluted parent env and asserts none of them appear in the returned child env, by key or value. A separate end-to-end test proves the same holds for a real spawned subprocess: it plants its own canary into the actual transcript the child writes and asserts that canary never shows up there either.",
      },
      {
        question: "Which agent CLI does it run?",
        answer:
          "Whichever one you configure, ProviderConfig is a {binary, baseUrlEnv, authEnv, model} shape, not a hardcoded vendor. The package ships one worked profile, CLAUDE_CLI_PROFILE, which runs the Claude Code CLI headless in stream-json mode with --strict-mcp-config so no MCP server, credentialed or not, loads into the sandbox.",
      },
      {
        question: "What does the caller get back, just a log file?",
        answer:
          "The transcript is a durable .jsonl on disk, but you don't parse it yourself: tail() returns compact incremental events, status() reports running/done/killed/error plus a live summary, and finalReport() returns one RunReport, result text, files touched, tool-call count, binary, model, and timestamps.",
      },
      {
        question:
          "Who commits the diff, opens the PR, or deploys after the agent finishes?",
        answer:
          "The caller, always. Agent Runner's contract stops at the worktree: the subprocess produces a diff and a transcript inside the worktree you gave it, and never touches git, opens a PR, or reaches a deploy target, that stays the orchestrator's job, one call site away.",
      },
    ],
  },
  {
    slug: "agent-trajectory",
    metaTitle: "Agent Trajectory, Append-Only Run Log | Caisson",
    metaDescription:
      "An append-only event contract for every agent step, tool proposal, approval, and spend, sensitive bodies referenced by digest, paused-run state encrypted at rest, replay byte-identical every time.",
    heroOneLiner:
      "Every step, tool proposal, approval, and dollar an agent run touches, appended once and replayed byte-identical, never a mutable log an incident review can't trust.",
    definition:
      "agent-trajectory is the append-only event contract a governed agent run writes into: eleven event kinds spanning run, step, model call, tool proposal/approval/result, and checkpoint, each Zod-`.strict()`-validated. Sensitive bodies (prompts, tool args, tool results) never inline; they're carried only as a sha256 `DigestRef`. A deterministic `project()` folds any event order into one byte-identical projection, and a park/approve/deny state machine holds paused runs with their snapshot encrypted at rest.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/agent-trajectory/browser inside a client bundle for the strict event schema, the in-memory append-only store, the run-state port, both deterministic projections, and the Claude-transcript adapter, so a dashboard can replay and validate a trajectory client-side. The main entry keeps the full node-capable surface including the two Postgres-backed stores, and every browser-entry export is also on it.",
      },
      {
        title: "Eleven-kind closed event vocabulary",
        body: "EVENT_KINDS fixes the whole vocabulary, run.started/finished, step.started/finished, model.call, model.usage, tool.proposed/approved/denied/result, checkpoint. TrajectoryEvent is a Zod discriminatedUnion keyed on kind, each variant .strict(), so an unknown field or a made-up kind is rejected at the boundary, not silently stored.",
      },
      {
        title: "Sensitive bodies never inline, DigestRef only",
        body: "The rendered prompt on model.call, the tool arguments on tool.proposed, the tool output on tool.result, and the serialized state on checkpoint are all typed DigestRef, a sha256 digest, a byte length, and an optional encRef pointer. The trajectory log itself is safe to persist, replay, and anchor without ever holding the bodies it references.",
      },
      {
        title: "Append-only store, idempotent and gap-rejecting",
        body: "createMemoryTrajectoryStore()'s append() enforces a monotonic 0-based seq per run: re-appending a byte-identical event at an already-recorded seq is a no-op (safe retry), a different event at that seq throws ConflictError, and a seq beyond the next free slot throws too, no rewrites, no gaps.",
      },
      {
        title: "billingStatus honesty bands, enforced by schema",
        body: "Every model.usage event carries billingStatus: metered | priced | estimated | unsupported. A superRefine enforces the honesty: credits can only be nonzero on metered or priced events, and priceBookVersion provenance is only legal on priced, an estimated adapter output can never masquerade as a charge.",
      },
      {
        title: "Deterministic replay: project() and projectToolCalls()",
        body: "project() sorts by seq before folding, so a shuffled batch always resolves to the same RunProjection (step tree, per-band usage totals, checkpoints) with JSON.stringify byte-identical across runs. projectToolCalls() is the sibling fold an eval scorer reads: one entry per toolCallId with its proposal, approval/denial, and result.",
      },
      {
        title: "Paused-run state, encrypted at rest",
        body: "createPgRunStateStore()'s park() seals the caller's opaque parkedState through @caisson/field-crypto's encryptField before it reaches the row, keyed to the run's own primary key as the row-binding identity; claimResume() is the only path that opens it back. deny() and finish() null the snapshot out on every terminal transition, a run that will never resume keeps no plaintext around.",
      },
    ],
    artifact: {
      label:
        "The billingStatus honesty refine, credits can't lie about their own grade",
      lang: "ts",
      file: "packages/agent-trajectory/src/schema.ts",
      code: '  .strict()\n  .superRefine((v, ctx) => {\n    // The previously comment-only invariant, now enforced (ADR-0360 U-4): credit claims are only\n    // legal on billing-grade bands; provenance only decorates the band it explains.\n    if (\n      v.credits > 0 &&\n      v.billingStatus !== "metered" &&\n      v.billingStatus !== "priced"\n    ) {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["credits"],\n        message: `credits must be 0 when billingStatus is "${v.billingStatus}" (only metered/priced carry credit claims)`,\n      });\n    }\n    if (v.priceBookVersion !== undefined && v.billingStatus !== "priced") {\n      ctx.addIssue({\n        code: z.ZodIssueCode.custom,\n        path: ["priceBookVersion"],\n        message: `priceBookVersion is only valid on billingStatus "priced" (got "${v.billingStatus}")`,\n      });\n    }\n  });',
      annotations: [
        "superRefine rejects a nonzero credits value on any billingStatus other than metered or priced, an estimated adapter's token count can never be smuggled in as a charge.",
        "priceBookVersion is only legal on a priced event, the schema itself pins provenance to the band it explains, not left to caller discipline.",
      ],
    },
    faq: [
      {
        question:
          "Can two agent runners double-write the same event and corrupt the log?",
        answer:
          "No, append() is idempotent on (runId, seq): re-appending the exact same event at an already-recorded seq is a safe no-op. A different event at that seq throws ConflictError as a rewrite, and a seq past the next free slot throws as a gap, so the log stays a strict, ordered append-only sequence under retry.",
      },
      {
        question:
          "Does the trajectory log ever store my prompts or tool output?",
        answer:
          "No, prompts (model.call), tool arguments (tool.proposed), tool results (tool.result), and checkpoint state are all typed as DigestRef: a sha256 digest, a byte length, and an optional pointer to where the encrypted bytes actually live. The trajectory itself carries no key material and no raw bodies, so it's safe to persist, replay, and anchor on its own.",
      },
      {
        question:
          "Does agent-trajectory make our agent spend auditable for SOC 2?",
        answer:
          "It ships the technical control: an append-only, idempotent event log of every tool proposal, approval, and usage event, with a deterministic replay a reviewer can re-derive byte-for-byte from the raw events. Whether that satisfies a specific SOC 2 control is your auditor's call, the module gives you the tamper-evident record to point at, not the certification.",
      },
      {
        question:
          "What happens to a paused run's state if it gets denied instead of approved?",
        answer:
          "deny() and finish() both null out the stored parkedState on the same transition that makes the run terminal, a denied or finished run keeps no snapshot around to leak. While a run is genuinely parked, that snapshot sits sealed through field-crypto's row-bound encryptField, keyed to the run's own id, so it can't be decrypted if copied to another row.",
      },
    ],
  },
  {
    slug: "tool-exec",
    metaTitle: "Tool-Exec Gate, Default-Deny Command Allowlist | Caisson",
    metaDescription:
      "A default-deny allowlist maps a logical command name to a real executable and a Zod-strict argv schema, validated before spawn, passed to execFile as an array, never a shell string, with a propose/execute split for external approval.",
    heroOneLiner:
      "A default-deny allowlist maps every command an agent is allowed to run, call anything not on it, and NotFoundError refuses the call before a process ever spawns.",
    definition:
      "tool-exec is Caisson's governed tool-call gate, composed live into the Agentic-Dev edition surface: a default-deny allowlist maps a logical command name to a real executable and a Zod-`.strict()` argv schema, validated with parseStrict before spawn and passed to execFile as an array, never a shell string. A two-phase propose/execute split lets an external approval step run between validation and the actual spawn.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/tool-exec/browser inside a client bundle for createToolProposer, the default-deny lookup and Zod argv validation with no spawn seam attached. It is the same gate createToolExec runs, so a UI can decide whether a call is permitted without the process boundary. The main entry keeps the full node-capable surface, and every browser-entry export is also on it.",
      },
      {
        title: "Default-deny allowlist, fail-closed",
        body: "createToolProposer builds its registry from the allowlist it is handed (createToolExec passes config.allowlist straight through), a name not registered there throws NotFoundError before anything spawns. An empty allowlist refuses every call; there's no wildcard escape hatch.",
      },
      {
        title: "Argv arrays, never a shell",
        body: "Each CommandSpec pairs a logical name with the real executable and a Zod argsSchema producing string[]; parseStrict validates the caller's args into that exact argv array before defaultExecFn spawns it via execFile, execSync, exec, and shell: true are never used anywhere in the package.",
      },
      {
        title: "Two-phase propose/execute for external approval",
        body: "propose() validates without spawning and returns a serializable ToolApproval backed by a private stored record. After your authenticated approval decision, execute() consumes the record once, checks the approved digest and current policy, and revalidates the original input. Child environment comes only from the current CommandSpec. Browser-only proposals cannot authorize execution.",
      },
      {
        title: "Bounded output, always a provenance record",
        body: "Every call returns an ExecResult, command, args, exitCode, stdout, stderr, ok, and an at timestamp from an injectable now(). bound() caps stdout/stderr at 64KB before Node's own maxBuffer would throw; a spawn failure resolves exitCode: -1 instead of throwing, so the caller always gets a record.",
      },
      {
        title: "Injectable spawn seam for hermetic tests",
        body: "The default spawn path (execFile, no shell) is swappable via config.execFn, the suite injects a fakeExecFn double that records calls and returns canned output, so the allowlist and validation logic are exercised without ever spawning a real process.",
      },
    ],
    artifact: {
      label:
        "createToolProposer, propose(): the one allowlist lookup + Zod validation run() and propose() both go through",
      lang: "ts",
      file: "packages/tool-exec/src/propose.ts",
      code: '    propose(name: string, args: unknown, reason?: string): ProposedToolCall {\n      const spec = registry.get(name);\n      if (spec === undefined) {\n        throw new NotFoundError(`No command registered for "${name}"`, {\n          command: name,\n        });\n      }\n      const validatedArgs = parseStrict(spec.argsSchema, args);\n      const proposed: ProposedToolCall = {\n        name,\n        command: spec.command,\n        args: validatedArgs,\n      };\n      return reason === undefined ? proposed : { ...proposed, reason };\n    },',
      annotations: [
        "registry.get(name) is the default-deny lookup, a name not in config.allowlist throws NotFoundError before parseStrict or any spawn path runs.",
        "parseStrict validates args against the allowlisted CommandSpec's own argsSchema, a bad shape throws ValidationError, still before anything spawns.",
        "run() spawns exactly the validated argv this returns and never re-derives it, so the single-phase and two-phase paths cannot drift, and this module reaches no node builtin, which is why it is also the browser entry.",
      ],
    },
    faq: [
      {
        question:
          "Can an agent break out of the allowlist and run an arbitrary command?",
        answer:
          "No, createToolExec's registry only recognizes names explicitly listed in config.allowlist; an unregistered name throws NotFoundError before anything spawns, and an empty allowlist refuses every call. There's no wildcard or fallback path around it.",
      },
      {
        question: "Does tool-exec ever run a command through a shell?",
        answer:
          "Never. Each registered CommandSpec resolves to a real executable path plus a Zod argsSchema producing a string[]; the default ExecFn calls node:child_process's execFile with that array directly. execSync, exec, and shell: true are never used anywhere in the package, the source header comment states this as the design invariant.",
      },
      {
        question:
          "How do I gate a call behind human or policy approval before it actually runs?",
        answer:
          "propose() validates without spawning and returns a serializable ToolApproval backed by a private stored record. After your authenticated approval decision, execute() consumes the record once, checks the approved digest and current policy, and revalidates the original input. Child environment comes only from the current CommandSpec. Browser-only proposals cannot authorize execution.",
      },
      {
        question:
          "What stops a hung or output-flooding command from taking down the caller?",
        answer:
          "Every call gets a 30-second default timeout (config.timeoutMs to override) and bound() caps stdout/stderr at 64KB before Node's own maxBuffer would throw. A timeout or spawn failure (ENOENT, a non-numeric error.code) resolves with exitCode: -1 rather than throwing, so the caller always gets a provenance record to inspect, never an uncaught exception.",
      },
    ],
  },
  {
    slug: "org-controls",
    metaTitle: "Org Controls, Cross-Tenant Admin-Write RLS | Caisson",
    metaDescription:
      "The commercial cross-tenant admin-write RLS layer (a separate admin_write Postgres role, one role-scoped policy) plus WorkOS SSO, a Clerk verifier, and owner-gated member management, carved out of the open tenancy-rls floor.",
    heroOneLiner:
      "admin_write is a second Postgres role your buyer-facing tenant-isolation policy never matches, so your own operator control plane can write across every tenant without the app role ever gaining that reach.",
    definition:
      "org-controls is the cross-tenant admin-write RLS layer carved out of the open tenancy-rls floor, plus the org-plan surfaces around it: WorkOS SSO sign-in, a Clerk session-verification driver, and the owner-gated multi-user membership surface. The free tenancy-rls package still enforces the buyer app role's fail-closed single-tenant isolation; this paid layer adds the separate admin_write role your own operator control plane mutates through.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/org-controls/browser inside a client bundle for assertCanManageMembers, so your UI can show and hide owner-only controls using the exact gate the server enforces rather than a second copy of the rule. The main entry keeps the full surface, and every browser-entry export is also on it.",
      },
      {
        title: "Cross-tenant write policy, DB-separated on purpose",
        body: "buildAdminWritePolicySql grants SELECT/INSERT/UPDATE (no DELETE) to admin_write and adds a role-scoped TO admin_write USING (true) WITH CHECK (true) permissive policy alongside the table's existing app tenant-isolation policy, RLS OR-combines them by role, so admin_write reaches every tenant while app never matches this policy. buildAdminSelectPolicySql is the narrower read-only twin for tables the control plane only ever reads.",
      },
      {
        title: "withAdminWrite, the one seam every mutation writes through",
        body: "withAdminWrite opens a transaction, runs the same fail-closed SUPERUSER/BYPASSRLS role pre-flight withTenant uses (deliberately duplicated here per ADR-0257 §1.3 rather than widening the open tenancy-rls surface), then SET LOCAL ROLE admin_write for the transaction's life, never the connection pool directly.",
      },
      {
        title: "Owner-gated multi-user membership",
        body: "assertCanManageMembers gates addAccountMember and removeAccountMember to the owner role, a seat cannot manage members or billing. removeAccountMember additionally refuses self-removal and refuses removing a second owner, so this control can never lock an account's owner out or let one owner unilaterally eject a co-owner.",
      },
      {
        title: "WorkOS SSO sign-in",
        body: "createWorkosSsoProvider builds the AuthKit/SSO authorization URL and exchanges the callback code for a Zod-strict-validated {userId, email} profile over api.workos.com, a framework-agnostic transport seam apps/site wires into better-auth. A failed exchange never echoes the response body, since it can carry the client secret or user PII.",
      },
      {
        title: "Clerk session-verification driver",
        body: "createClerkSessionVerifier verifies a Clerk session JWT (networkless when jwtKey is supplied, live JWKS fetch otherwise) and clerkClaimsToSessionContext maps its claims onto the kernel's SessionContext. An active Organization with no role claim maps to the least-privileged seat, never the owner default, closing a privilege-escalation path a reshaped custom token could otherwise open.",
      },
      {
        title: "Fail-closed entitlement gate",
        body: "holdsOrgControls is the predicate a members-management surface gates through: an empty active-entitlement set denies by default, and it accepts either the bare org-controls purchase id or the full @caisson/org-controls module id, correct whichever form a standalone purchase or bundle grant carries.",
      },
    ],
    artifact: {
      label:
        "buildAdminWritePolicySql, the cross-tenant write policy, scoped to one role",
      lang: "ts",
      file: "packages/org-controls/src/admin-write.ts",
      code: '/**\n * SQL that lets the `admin_write` role INSERT/UPDATE/SELECT every row of `table` cross-tenant,\n * WITHOUT widening what any other role sees. Emitted ALONGSIDE the table\'s existing\n * `buildTenantPolicySql` output (which stays the `app` tenant-isolation floor): a\n * `GRANT SELECT, INSERT, UPDATE ... TO admin_write` (no DELETE — the mutation surface soft-revokes,\n * never hard-deletes) plus a `TO admin_write USING (true) WITH CHECK (true)` policy. RLS\n * OR-combines permissive policies, but each is role-scoped, so `admin_write` sees/writes every\n * tenant while `app` never matches this policy and stays isolated. Applied to the production\n * database at deploy time, mirroring the read-only counterpart policy builder.\n */\nexport function buildAdminWritePolicySql(\n  table: string,\n  { role = ADMIN_WRITE_ROLE }: AdminWritePolicyOptions = {},\n): string {\n  return [\n    // Idempotent so re-running DEPLOY provisioning never errors: GRANT is a no-op when already held,\n    // and DROP POLICY IF EXISTS clears any prior policy before CREATE (Postgres has no\n    // CREATE POLICY IF NOT EXISTS). The policy body is fixed, so drop-then-create is safe to repeat.\n    `GRANT SELECT, INSERT, UPDATE ON ${table} TO ${role};`,\n    `DROP POLICY IF EXISTS ${table}_admin_write ON ${table};`,\n    `CREATE POLICY ${table}_admin_write ON ${table}`,\n    `  TO ${role}`,\n    `  USING (true)`,\n    `  WITH CHECK (true);`,\n  ].join("\\n");\n}',
      annotations: [
        "USING (true) WITH CHECK (true) is scoped TO admin_write only, RLS OR-combines permissive policies, so this cross-tenant grant never widens what the app role's own tenant-isolation policy already sees.",
        "GRANT SELECT, INSERT, UPDATE deliberately omits DELETE, the operator mutation surface this policy backs soft-revokes a row, it never hard-deletes through admin_write.",
        "DROP POLICY IF EXISTS runs before CREATE POLICY so buildAdminWritePolicySql is safe to re-run at every DEPLOY, Postgres has no CREATE POLICY IF NOT EXISTS.",
      ],
    },
    faq: [
      {
        question:
          "Does the admin_write role bypass tenant isolation for ordinary buyer requests too?",
        answer:
          "No, admin_write is a completely separate Postgres role from app, and withAdminWrite is the only seam that ever assumes it. Every buyer request still runs under the app role's own TO app tenant-isolation policy; RLS OR-combines permissive policies by role, so a TO admin_write policy never matches app and never widens what a buyer connection sees.",
      },
      {
        question:
          "If the write policy is USING (true) WITH CHECK (true) across every tenant, what stops a bug from touching more than one account per call?",
        answer:
          "The database policy is unconditional on purpose, there's no per-request GUC to bind. The one-account-per-call bound is enforced at the app layer instead: every mutation function takes exactly one target account id and filters on it, gated by the caller's own authentication check and written to a dual audit log. That's a deliberate, disclosed tradeoff, not an oversight.",
      },
      {
        question:
          "Can a seat manage other members, or reach the admin-write surface?",
        answer:
          "No. assertCanManageMembers gates addAccountMember and removeAccountMember to the owner role before any query runs, and removeAccountMember separately refuses self-removal and refuses removing a second owner, so no owner-gated action can lock the account's own owner out or let one owner unilaterally eject another.",
      },
      {
        question:
          "Does the admin-write role split make our access-control posture SOC 2 compliant?",
        answer:
          "No single module does that. org-controls ships the technical control an auditor checks for role-based access segregation (a DB-enforced split between the buyer app role and the cross-tenant admin_write role, gated by a fail-closed guard that refuses to run as SUPERUSER or BYPASSRLS) not a certification. Compliance status is your organization's and your auditor's call.",
      },
    ],
  },
  {
    slug: "compliance-core",
    metaTitle: "Compliance Evidence Packs, Flag-Never-Guess | Caisson",
    metaDescription:
      "generateEvidencePack refuses to assemble a pack while any control's evidence is unresolved, then produces a byte-stable, SHA-256-verifiable ZIP with a cross-framework crosswalk rollup.",
    heroOneLiner:
      "generateEvidencePack won't produce a pack while any control's evidence is unresolved, what it does hand you is a byte-stable, SHA-256-verifiable ZIP.",
    definition:
      "compliance-core is Caisson's evidence engine: generateEvidencePack composes typed EvidenceCollector results into a deterministic, byte-stable evidence pack, refusing to assemble anything while a control's evidence stays unresolved (flag-never-guess). computeCrosswalkRollup joins every framework pack's crosswalk pointers into one cross-framework view. It depends on and re-exports oscal-spine so existing OSCAL imports keep resolving while the dedicated package owns the formats.",
    included: [
      {
        title: "Flag-never-guess pack generation",
        body: "generateEvidencePack scans every control for an unresolved collector result before assembling anything; if any exist it throws EvidencePackBlockedError (HTTP 422) carrying the full BLOCKED-case report. The throw runs before any assembly and the module touches no filesystem, so a partial pack is structurally impossible, not just policy.",
      },
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/compliance-core/browser inside a client bundle for the collector contract with its result constructors, the four pure collectors (FORCE-RLS, WORM retention, risk register, impersonation dual trail), the pack format, the crosswalk rollup, and assembleEvidenceManifest, the same flag-never-guess refusal and derived-readiness assembly generateEvidencePack composes. The archive and digest phase, the chain-verify collector, and the field-crypto collector stay on the main entry: each needs Node. Every browser-entry export is also on the main entry.",
      },
      {
        title: "Deterministic, byte-stable archive",
        body: "buildDeterministicZip fixes every entry to the 1980-epoch DOS mtime, name-sorts entries, and pins the deflate level over canonicalize()'d contents, so identical evidence always serializes to the identical SHA-256 on EvidencePack.sha256, regardless of when or by whom it was generated. The injected now clock is stamped only on the generatedAt envelope field, never hashed into the body.",
      },
      {
        title: "Cross-framework evidence rollup",
        body: 'computeCrosswalkRollup joins every framework pack\'s crosswalk[] pointers into one flat cell list. A cell renders claim: "implements" only when every contributing control is ready, every contributing verification is reviewed/expert-reviewed and non-stale, and a matching regime-crosswalk row already claims implements, anything short of that defaults to maps-to, mechanically, never editorially.',
      },
      {
        title: "Pluggable EvidenceCollector contract, mandatory reasons",
        body: "EvidenceCollector.collect(fact) is pure, no I/O, no clock, no DB. passResult ships a satisfied check; flaggedResult and unresolvedResult both throw ValidationError on an empty reason, so a recorded deficiency can never reach a pack without a stated cause.",
      },
      {
        title: "Detached external-anchor grade tagging",
        body: "buildExternalAnchorEntry attaches the newest anchor receipt as its own archive entry plus a trusted-timestamped or externally-transparent grade tag on the result envelope, never a field in the canonical manifest.json (the receipt is non-deterministic; hashing it would break byte-stability). anchorGradePhrase keeps a private RFC-3161 receipt from ever claiming the public-transparency language reserved for the externally-transparent grade.",
      },
      {
        title: "Source-compatible OSCAL boundary",
        body: "compliance-core depends on and re-exports @caisson/oscal-spine. Existing assessment-plan, assessment-results, POA&M, catalog, XML, and ISO 27001 SoA imports keep resolving through this package, while one dedicated package owns their implementation and conformance fixtures.",
      },
    ],
    artifact: {
      label:
        "assembleEvidenceManifest, the flag-never-guess scan, before any assembly runs",
      lang: "ts",
      file: "packages/compliance-core/src/evidence/assemble.ts",
      code: 'export function assembleEvidenceManifest(\n  input: AssembleEvidenceManifestInput,\n): EvidencePackManifest {\n  // PHASE 1 — flag-never-guess. Scan EVERY control for unresolved evidence before assembling\n  // anything; refuse the whole pack if any is found. No filesystem touch here → no partial pack.\n  const unresolved: Array<{\n    controlId: string;\n    collectorId: string;\n    reason: string | undefined;\n  }> = [];\n  for (const control of input.controls) {\n    for (const result of control.evidence) {\n      if (result.status === "unresolved") {\n        unresolved.push({\n          controlId: control.controlId,\n          collectorId: result.item.collectorId,\n          reason: result.reason,\n        });\n      }\n    }\n  }\n  if (unresolved.length > 0) {\n    const sortedUnresolved = [...unresolved].sort(\n      (a, b) =>\n        cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),\n    );\n    const report = parseEvidencePackBlocked({\n      formatVersion: EVIDENCE_PACK_FORMAT_VERSION,\n      tenantId: input.tenantId,\n      framework: input.framework,\n      blocked: true,\n      unresolved: sortedUnresolved,\n    });\n    throw new EvidencePackBlockedError(report);\n  }',
      annotations: [
        "The scan over input.controls runs BEFORE any assembly starts, every control is checked for an unresolved result first, so a partial pack is never even started.",
        "EvidencePackBlockedError carries the full sorted report (every unresolved controlId + collectorId), not just a boolean, the caller sees exactly what's missing.",
        "sortedUnresolved is deterministically ordered by cmp(), the same set of gaps always reports in the same order, run to run.",
      ],
    },
    faq: [
      {
        question:
          "Does generating an evidence pack make us SOC 2 or HIPAA compliant?",
        answer:
          "No, no module makes an organization compliant; that determination is your organization's and its auditor's to make. compliance-core generates the evidence a control's readiness is judged from: it refuses to assemble a pack at all while any control's evidence is unresolved, rather than guessing a passing status.",
      },
      {
        question:
          "What happens if a control's evidence is missing when I try to generate a pack?",
        answer:
          "generateEvidencePack throws EvidencePackBlockedError (422) before touching a filesystem, no partial pack is produced. The error carries a full report of every unresolved controlId and collectorId, sorted deterministically, so you know exactly what's missing before retrying.",
      },
      {
        question:
          "Can I re-run the generator and get a different pack for the same evidence?",
        answer:
          "No. buildDeterministicZip fixes entry mtimes to the 1980 ZIP epoch, sorts entries by name, and pins the deflate level over canonicalized bytes, the same collector results always produce the identical archive SHA-256. The generation clock (now) is stamped only on the result envelope, never hashed into the body.",
      },
      {
        question:
          'Does a crosswalk rollup cell claiming "implements" mean Caisson verified that mapping?',
        answer:
          "It means the mapping cleared a mechanical bar: every contributing canonical control is ready, every contributing crosswalk reference carries a reviewed-or-better, non-stale verification record, and a matching regime-crosswalk row already claims implements. Anything short of that (including any reference seeded from NIST's own OLIR mapping, which NIST itself calls subjective and incomplete) renders as the weaker maps-to, never upgraded editorially.",
      },
    ],
  },
  {
    slug: "billing-orchestration",
    metaTitle: "Billing Orchestration, One Port, Four Providers | Caisson",
    metaDescription:
      "One BillingProvider port drives Paddle, Stripe, LemonSqueezy, and Polar. A dual-layer idempotency claim table settles a re-delivered webhook (and its credit grant) exactly once.",
    heroOneLiner:
      "One BillingProvider port normalizes Paddle, Stripe, LemonSqueezy, and Polar into one event stream, a subscription renewal grants credits exactly once, a mid-cycle charge never over-grants.",
    definition:
      "Billing orchestration is Caisson's multi-provider commerce seam: one BillingProvider port (createPaddleBilling, createStripeBilling, plus LemonSqueezy and Polar drivers) normalizes checkout, webhook signature verification, and event parsing across all four providers into one domain event stream. A dual-layer idempotency claim table makes a re-delivered webhook (and its downstream credit grant) settle exactly once, never twice.",
    included: [
      {
        title: "One port, four provider drivers",
        body: "createStripeBilling and createPaddleBilling ship in this package's index.ts alongside createLemonSqueezyBilling and createPolarBilling, all four hand-rolled over each provider's plain REST API (no vendor SDK) behind the one BillingProvider port from @caisson/billing. Paddle is the live platform merchant of record; the LemonSqueezy and Polar drivers are dormant until you construct them with your own credentials.",
      },
      {
        title: "Envelope shape checked before the mapper ever runs",
        body: "createStripeBilling and createPaddleBilling both parseStrict the raw webhook body against StripeEventSchema / PaddleEventSchema after signature verification, a missing or wrong-typed id/type/data is rejected before parseStripeEvent or parsePaddleEvent ever reads it. PaddleEventSchema stops short of .strict() on purpose: a strict envelope rejected every real Paddle delivery in live verification, so only the top-level shape is pinned.",
      },
      {
        title: "A renewal grants once, a mid-cycle charge never over-grants",
        body: "parsePaddleEvent reads the transaction's origin field: subscription_recurring maps to billingReason \"subscription_cycle\" (a renewal), while subscription_charge (a mid-cycle addon or top-up on the same subscription) passes through as its own non-granting reason instead of being read as another cycle. Only a reason inside services/license's GRANTING_REASONS ever triggers a credit grant; an absent or unrecognized origin falls through unmapped and grants nothing.",
      },
      {
        title: "A re-delivered webhook settles exactly once",
        body: "processEvent claims a sourceEventId once via an INSERT ... ON CONFLICT DO NOTHING on billing_processed_event; a re-delivery finds the claim and skips the grant function entirely, and with it the detached post-commit Discord role push, which is gated on that same outer claim. withIdempotentSideEffect claims a composite ${sourceEventId}:${sideEffect} key so a named transactional side effect fires at most once across retries, on top of the credit ledger's own UNIQUE(source_event_id, event_type) constraint.",
      },
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/billing-orchestration/browser inside a client bundle for the pure claim-key half, assertValidSourceEventId and sideEffectEventKey, the same guards processEvent and withIdempotentSideEffect delegate to. The claim itself stays on the main entry, because it runs as an INSERT inside your tenant transaction; the main entry keeps the complete surface, and every browser-entry export is also on it.",
      },
      {
        title: "The claim table is tenant-scoped, not just event-scoped",
        body: "billing_processed_event binds account_id from the tenant GUC on insert and runs under buildTenantPolicySql's force-RLS policy; a CHECK (account_id <> '') rejects a claim attempted outside withTenant rather than letting it land under a shared blank tenant.",
      },
      {
        title: "Integer money at every provider boundary",
        body: "readMoneyMinorUnits rounds LemonSqueezy's numeric money fields (which can carry sub-cent artifacts from currency-rate conversion (e.g. 1499.985)) to the nearest integer minor unit before the amount enters the domain event. Every driver's amountTotal reaches the credit-grant seam as an integer, never a float.",
      },
    ],
    artifact: {
      label:
        "parsePaddleEvent's invoice.paid mapping, a renewal grants, a mid-cycle charge doesn't",
      lang: "ts",
      file: "packages/billing-orchestration/src/paddle-events.ts",
      code: '      if (txnId === "") return null;\n      return {\n        type: "invoice.paid",\n        sourceEventId: event.event_id,\n        accountId,\n        amountTotal: readGrandTotal(obj),\n        currency: readString(obj.currency_code, "usd"),\n        subscriptionId,\n        priceId: readItemPriceId(obj),\n        // Paddle\'s `origin` says HOW the charge arose (verified against developer.paddle.com\'s\n        // transaction.completed reference + the subscription-created/renewed simulator scenarios,\n        // 2026-07-01), mapped onto the billingReason vocabulary the cycle->grant gate\n        // (services/license GRANTING_REASONS) recognizes:\n        //   web | api                → the subscription\'s FIRST charge (Paddle.js checkout / an\n        //                              API-created transaction, e.g. provider.ts createCheckout)\n        //                              → "subscription_create" (grants)\n        //   subscription_recurring   → a renewal cycle → "subscription_cycle" (grants)\n        //   subscription_charge      → a MID-CYCLE one-time charge FOR the subscription\n        //                              (addon/topup) — NOT the first charge (the earlier reading);\n        //                              granting the plan\'s cycle allotment here would OVER-grant,\n        //                              so it passes through as its own non-granting reason\n        //   subscription_update / subscription_payment_method_change → proration / $0\n        //                              method-change transactions — non-granting (the SD-1\n        //                              next-cycle rule)\n        // An absent origin passes through as "" — not in GRANTING_REASONS, so it grants nothing\n        // (fail-closed; Paddle documents `origin` as always present on a transaction).\n        billingReason: ((): string => {\n          const origin = readString(obj.origin);\n          if (origin === "subscription_recurring") return "subscription_cycle";\n          if (origin === "web" || origin === "api")\n            return "subscription_create";\n          return origin;\n        })(),',
      annotations: [
        "origin drives billingReason, subscription_recurring becomes subscription_cycle (a renewal, grants), while subscription_charge passes through unmapped so a mid-cycle addon charge never triggers the plan's cycle credit grant.",
        "An absent or unrecognized origin falls through as the raw string, which never matches services/license's GRANTING_REASONS, fail-closed to no grant rather than a guessed one.",
        "Paddle fires this same transaction.completed event for both a subscription's first charge and every renewal, there is no separate per-cycle webhook, so origin is the only signal this mapper has.",
      ],
    },
    faq: [
      {
        question:
          "Does a mid-cycle top-up charge grant the subscription's credit allotment a second time?",
        answer:
          "No. parsePaddleEvent reads the transaction's origin field: subscription_recurring maps to \"subscription_cycle\" (a renewal, grants), while subscription_charge (a mid-cycle addon or top-up) passes through as its own non-granting reason instead of being read as another cycle renewal. Only a reason in services/license's GRANTING_REASONS ever triggers a credit grant.",
      },
      {
        question:
          "What stops a re-delivered webhook from granting credits twice?",
        answer:
          "Two layers. The credit ledger is already idempotent (its UNIQUE(source_event_id, event_type) index makes a duplicate grant a no-op. This package adds an outer claim table on top: processEvent claims a sourceEventId once, so a re-delivery skips the grant function entirely) and with it the detached post-commit Discord role push, which is gated on that same outer claim. withIdempotentSideEffect adds a per-effect claim for a transactional side effect so it fires at most once across retries.",
      },
      {
        question:
          "Do I need four different provider SDKs to use all four drivers?",
        answer:
          "No SDK at all, createStripeBilling, createPaddleBilling, createLemonSqueezyBilling, and createPolarBilling are each hand-rolled over the provider's plain REST API behind the one BillingProvider port, so swapping the merchant of record is a new driver, not a rewrite. Paddle is the live platform MoR; the LemonSqueezy and Polar drivers are dormant until you construct them with your own credentials.",
      },
      {
        question: "How does it handle a provider's fractional money field?",
        answer:
          "It rounds it. LemonSqueezy's numeric amount fields can carry sub-cent artifacts from currency-rate conversion (e.g. 1499.985); readMoneyMinorUnits rounds every amount to the nearest integer minor unit before it enters the domain event, money and credits are integer units everywhere in Caisson, never floats.",
      },
    ],
  },
  {
    slug: "ui-pro",
    metaTitle: "UI Pro, Zero-Radix Interactive Components | Caisson",
    metaDescription:
      "Fourteen commercial React components on the open @caisson/ui floor: Tooltip/Popover/Menu hand-rolled with zero Radix and zero @floating-ui, plus a filterable/groupable/virtualized data grid, a hash-chain audit timeline, and redaction-aware payload and diff viewers.",
    heroOneLiner:
      "The interactive layer @caisson/ui doesn't ship, Tooltip, Popover, and Menu hand-rolled against zero Radix and zero @floating-ui, plus the data grid, hash-chain audit timeline, and diff viewer a real dashboard needs.",
    definition:
      "ui-pro is the commercial component tier built on the open @caisson/ui floor: a hand-rolled, zero-Radix, zero-@floating-ui interactive layer (Tooltip, Popover, Menu) plus eleven sellable data surfaces, an advanced data grid, virtualized tree, ops/coverage matrix, hash-chain audit timeline, redaction-aware payload and diff viewers, type-to-confirm, date-range picker, charts, kanban board, and command palette.",
    included: [
      {
        title: "Tooltip, Popover, Menu, zero Radix, zero @floating-ui",
        body: "Popover and Menu render their own trigger <button>, portal their panel with react-dom's createPortal, and position it with the package's own computeFloatingPosition, a pure flip-and-clamp function shared through the useFloatingPosition hook by all three interactive primitives (ADR-0291). Menu follows the WAI-ARIA Menu Button pattern (role=\"menu\", roving tabindex, Up/Down/Home/End); Popover follows the APG disclosure-with-portal pattern (explicit focus-in on open, focus-return on every keyboard-initiated close).",
      },
      {
        title: "DataTablePro, filter, group, aggregate, export, virtualize",
        body: "DataTablePro composes the open kit's own Button and Select, then drives the pure lib/table-ops.ts transforms (applyFilters, sortRows, groupRows, aggregate, toCsv, compareCells) plus lib/virtual.ts's windowRange for row virtualization. The transforms are exported standalone (DataTableProColumn, SavedView) so the filtering/grouping/CSV logic is unit-testable and reusable server-side, not locked inside the component.",
      },
      {
        title: "AuditTimeline, renders a hash-chain verification result",
        body: "AuditTimeline takes AuditEntry rows extending lib/audit-chain.ts's ChainEntry, and an optional anchor-derived statuses prop of six-state badges (wired to @caisson/kernel's per-row verifier, ADR-0331/0344). shortHash formats the display; chainIntact and verifyChain are exported for a caller to run the actual chain check, the component displays a verdict, it doesn't compute one.",
      },
      {
        title:
          "PayloadViewer redacts by default; DiffViewer redacts on request",
        body: "PayloadViewer falls back to lib/redact.ts's DEFAULT_REDACT_KEYS and uses isRedactedKey/redactValue (the predicate now re-exported from @caisson/kernel, ADR-0331) whenever the caller doesn't supply its own key list (masking is on out of the box. DiffViewer's JSON mode only redacts when the caller passes its own redactKeys set, which it threads into lib/diff.ts's diffJson (that module calls redactValue internally); DiffViewer imports no default key list itself, and its plain text-line diff mode has no redaction path at all) so a support or audit screen stays unmasked unless the integrator wires redactKeys explicitly.",
      },
      {
        title:
          "TypeToConfirm, DateRangePicker, charts, CommandPalette, KanbanBoard",
        body: "Rounding out the eleven: TypeToConfirm gates a destructive action behind an exact-text match; DateRangePicker ships standardPresets (thisMonth, lastNDays, fiscalQuarter, billingCycle...) from lib/date-presets.ts; AreaChart/BarChart/LineChart/Sparkline read lib/charts.ts's linearScale/areaPath/linePath/niceTicks; CommandPalette runs lib/fuzzy.ts's fuzzyFilter/fuzzyMatch; KanbanBoard drives lib/board.ts's columnCards/moveCard.",
      },
    ],
    artifact: {
      label:
        "computeFloatingPosition, the zero-Radix flip-and-clamp math under Tooltip/Popover/Menu",
      lang: "ts",
      file: "packages/ui-pro/src/lib/position.ts",
      code: "/**\n * Computes a viewport-relative `{top, left}` (paired with `position: fixed`, matching\n * `getBoundingClientRect`'s coordinate space) for a panel anchored to `trigger` on the\n * `preferred` side. Flips to the opposite side if the preferred side would overflow the viewport\n * and the opposite side fits better; otherwise falls back to `preferred` unfit. Both axes are then\n * clamped into `[gap, viewport - panel - gap]` — cheap insurance on the axis that already fit (a\n * no-op there) and the only thing keeping the *main* axis on-screen when neither placement fit.\n * A panel taller/wider than the viewport can still get clamped to `gap` on both ends and overflow\n * regardless — coordinates alone can't shrink it, so panels also carry their own\n * `max-height`/`overflow-y: auto` (see `.cs-popover`/`.cs-menu`) as the belt-and-braces.\n */\nexport function computeFloatingPosition(\n  trigger: Rect,\n  panel: Size,\n  viewport: Size,\n  preferred: Placement = \"bottom\",\n  gap = 8,\n): FloatingPosition {\n  const placement = fits(preferred, trigger, panel, viewport, gap)\n    ? preferred\n    : fits(OPPOSITE[preferred], trigger, panel, viewport, gap)\n      ? OPPOSITE[preferred]\n      : preferred;\n\n  const { top, left } = place(placement, trigger, panel, gap);\n\n  const clampedLeft = Math.min(\n    Math.max(left, gap),\n    Math.max(gap, viewport.width - panel.width - gap),\n  );\n  const clampedTop = Math.min(\n    Math.max(top, gap),\n    Math.max(gap, viewport.height - panel.height - gap),\n  );\n\n  return { top: clampedTop, left: clampedLeft, placement };\n}",
      annotations: [
        "computeFloatingPosition is the entire positioning engine, a pure, unit-tested function with no @floating-ui and no Radix import anywhere in the file",
        "the OPPOSITE-indexed fits() call is the flip logic: try the preferred side, fall back to the opposite side, or give up and let the clamp save it",
        "clampedLeft/clampedTop are the belt-and-braces, even an unfit placement gets pinned inside the viewport instead of rendering off-screen",
      ],
    },
    faq: [
      {
        question:
          "Why hand-roll Popover/Menu instead of shipping on Radix like most component libraries?",
        answer:
          "Zero runtime dependency and one shared positioning primitive. computeFloatingPosition is a ~35-line pure function (no @floating-ui, no Radix) and useFloatingPosition wires the same math to a single hook that Popover, Menu, and Tooltip all reuse, so there's one focus-management and one positioning implementation to audit instead of a vendor's.",
      },
      {
        question:
          "Does the audit timeline verify anything itself, or just display it?",
        answer:
          "It displays a verification result computed elsewhere, AuditTimeline takes an optional anchor-derived statuses prop (six-state badges wired to @caisson/kernel's per-row verifier) and its own lib/audit-chain.ts exports chainIntact and verifyChain for a caller to run the check. The component itself holds no hashing or WORM-anchor logic; it renders whatever chain state you hand it.",
      },
      {
        question:
          "Does DataTablePro replace @caisson/ui's basic table, or is it a separate thing?",
        answer:
          "Separate tier by design: the open @caisson/ui floor keeps a basic table with single sort/filter/pagination; DataTablePro adds the filter builder, grouping/aggregation, column pin/hide, CSV export, and row virtualization on top, and it composes the open kit's own Button and Select rather than duplicating them.",
      },
      {
        question: "Which edition or bundle does ui-pro come with?",
        answer:
          'No persona bundle (buying Compliance, AI-Production, Local-first, Agentic-Dev, or Provenance never silently includes it (standalone placement, no persona-bundle membership at v1), and buying it never silently requires one of them. The whole-catalog Everything bundle is the one exception: it grants every sellable module by construction, ui-pro included) pinned by a registry test literally named "ui-pro is IN the Everything membership."',
      },
    ],
  },
  {
    slug: "local-inference",
    metaTitle: "On-Device Inference, Hash-Verified ONNX | Caisson",
    metaDescription:
      "On-device ONNX embeddings via transformers.js, every model file SHA-256-verified, plus a metered hosted lane (OpenRouter, Azure OpenAI, Bedrock) that's off unless you allowlist its host.",
    heroOneLiner:
      "A hash-verified ONNX model runs inference on-device with zero egress by default, the hosted lane switches on only when you name its host in the privacy allowlist.",
    definition:
      "local-inference implements one InferenceBackend port two ways: OnnxEmbeddingBackend runs a MiniLM-class ONNX model on-device via transformers.js, every fetched model file SHA-256-verified before use; RentedInferenceBackend calls a hosted provider (OpenRouter, Azure OpenAI, Bedrock) only once its host is allowlisted in the privacy gate, metering every call. A deterministic stub backs CI, the live paths are proven, never exercised in tests.",
    included: [
      {
        title: "Hash-verified model load, fail closed on mismatch",
        body: "OnnxEmbeddingBackend's guarded fetch checks every pinned file's SHA-256 digest against the integrity map in OnnxBackendConfig with the constant-time safeEqualFixed before the bytes reach transformers.js; resolveConfig refuses to construct the backend at all with zero hash-pins.",
      },
      {
        title: "One egress chokepoint, two purpose-bound sink kinds",
        body: "Both backends route through the shared EgressGuard's assertAllowedFor (the ONNX backend allowlists only modelHost under the model-fetch sink kind, the rented backend only its endpoint under rented-backend) so a host sanctioned for one purpose can never receive traffic meant for the other.",
      },
      {
        title: "Rented inference is off by default",
        body: 'RentedInferenceBackend\'s constructor calls guard.assertAllowedFor(endpoint, "rented-backend") before it will even build, and re-asserts the same gate on every embed/complete call, a zero-egress privacy policy makes construction itself throw, with no silent hosted fallback.',
      },
      {
        title: "Every rented call meters exactly once",
        body: "#emitMeter builds one UsageMetering record (integer quantity, a fresh idempotencyKey per call) and hands it to the buyer-wired MeterSink before the result returns; if the sink throws, the call fails, because a paid call that can't be recorded must not silently succeed.",
      },
      {
        title: "Four wire dialects, one RentedTransport port",
        body: "createLiveRentedTransport speaks a first-party /embed + /complete wire; createOpenRouterRentedTransport, createAzureOpenAIRentedTransport, and createBedrockRentedTransport map the same port onto OpenRouter, Azure OpenAI, and Bedrock, every response re-validated against the strict RentedEmbedResponse/RentedCompleteResponse shape regardless of which one answered.",
      },
      {
        title: "Deterministic stub, byte-identical in CI",
        body: "StubInferenceBackend seeds a mulberry32 PRNG from the SHA-256 of the input text, so identical text always embeds to the byte-identical vector and CI never touches a model or a socket, the same InferenceBackend port the live backends implement, so swapping to production changes zero call sites.",
      },
    ],
    artifact: {
      label: "RentedInferenceBackend constructor, off by default, provably",
      lang: "ts",
      file: "packages/local-inference/src/rented-backend.ts",
      code: '  constructor(config: RentedBackendConfig) {\n    const dim = config.dim ?? EMBEDDING_DIM;\n    if (!Number.isInteger(dim) || dim <= 0) {\n      throw new ValidationError(\n        "rented backend dim must be a positive integer",\n        { received: dim },\n      );\n    }\n    assertNonEmpty(config.tenantId, "tenantId");\n    assertNonEmpty(config.feature, "feature");\n    assertNonEmpty(config.model, "model");\n\n    // OFF BY DEFAULT. `assertAllowedFor` throws unless the endpoint is HTTPS, the host\n    // is on the privacy allowlist (a zero-egress default policy fails closed), AND the sanctioned\n    // sink KIND is `rented-backend` specifically — a host allowlisted only for the model fetch\n    // can never double as a hosted-inference egress.\n    const url = config.guard.assertAllowedFor(\n      config.endpoint,\n      "rented-backend",\n    );\n\n    this.dim = dim;\n    this.model = config.model;\n    this.#endpoint = url;\n    this.#guard = config.guard;\n    this.#transport = config.transport;\n    this.#meter = config.meter;\n    this.#tenantId = config.tenantId;\n    this.#feature = config.feature;\n  }',
      annotations: [
        "assertAllowedFor throws right here, at construction, unless the endpoint is HTTPS and allowlisted under the rented-backend sink kind specifically, a host sanctioned only for the model fetch can't double as a hosted-inference egress.",
        "The guard check runs before any field is assigned, throw here and `this.#endpoint`, `this.#guard`, and the rest of the private state are never set, so there's no partially-built instance and no silent hosted fallback to fall into.",
        "The dim/EMBEDDING_DIM guard runs before assertAllowedFor is ever called, so a misconfigured embedding width fails closed before the privacy gate is even consulted.",
      ],
    },
    faq: [
      {
        question: "Does local-inference ever send my data off the device?",
        answer:
          "Not unless you opt in. OnnxEmbeddingBackend runs entirely on-device, its guarded fetch chokepoint allows only the pinned modelHost under the model-fetch sink kind, and that's for fetching the model itself, never the text you embed. RentedInferenceBackend is a separate class that refuses to even construct until you allowlist a host under the rented-backend sink kind in the privacy gate.",
      },
      {
        question:
          "How do I know the on-device model hasn't been tampered with?",
        answer:
          "Every model file transformers.js fetches is SHA-256-hash-verified against the integrity map in OnnxBackendConfig before it reaches the runtime. resolveConfig refuses to build the backend at all if you supply zero hash-pins, and a mismatched file throws InternalError instead of loading.",
      },
      {
        question:
          "What if I want a hosted model, GPT- or Claude-class quality instead of MiniLM?",
        answer:
          "Wire RentedInferenceBackend with one of the shipped transports (createLiveRentedTransport, createOpenRouterRentedTransport, createAzureOpenAIRentedTransport, or createBedrockRentedTransport) or your own RentedTransport implementation. Every call still routes through the same egress guard and emits one metered UsageMetering record before it returns.",
      },
      {
        question: "Does this module bill me, or just wire the meter?",
        answer:
          "It wires the shape only. #emitMeter builds an integer-quantity, idempotency-keyed UsageMetering record and hands it to whatever MeterSink you provide, the package never imports @caisson/credits or touches a ledger; your billing integration supplies the sink that calls credits.debit.",
      },
    ],
  },
  {
    slug: "local-privacy",
    metaTitle: "Privacy Egress Gate, Zero-Egress by Default | Caisson",
    metaDescription:
      "A closed-enum PrivacyPolicy plus EgressGuard wrapping the kernel fetchWithTimeout chokepoint: an empty allowlist blocks every host, and only two sanctioned sink kinds can ever be reachable.",
    heroOneLiner:
      "An empty allowlist blocks every outbound host by default, a request only egresses if a typed sink names the exact host and why.",
    definition:
      "local-privacy is the Local-first edition's runtime egress boundary: a closed-enum PrivacyPolicy (Zod .strict(), \"local-only\" the sole mode) declares zero-egress-by-default, and EgressGuard enforces it in front of the kernel's fetchWithTimeout chokepoint. A host must be allowlisted for one of exactly two sanctioned sink kinds (model-fetch or rented-backend) before a socket ever opens; an empty or omitted allowlist blocks everything.",
    included: [
      {
        title: "Closed-enum policy, not a config flag",
        body: 'privacyPolicySchema is a strictObject over privacyModeSchema (PRIVACY_MODES has exactly one member, "local-only") and a bounded allowlist (max 16 entries, default []). There is deliberately no "hosted" mode in the enum, introducing one takes an ADR and a schema change, not a config edit. ZERO_EGRESS_POLICY is the frozen air-gap default: local-only with an empty allowlist.',
      },
      {
        title: "Two sanctioned sink kinds, exact-match hosts",
        body: "SANCTIONED_SINK_KINDS closes the reachable-for-a-reason set to model-fetch (the first-run ONNX model download) and rented-backend (the opt-in metered hosted-inference host). egressSinkSchema validates each entry against HOSTNAME_RE and normalizes it (trim + lowercase), matching is exact-string against url.hostname, never a suffix or wildcard.",
      },
      {
        title: "Blocked before a socket opens",
        body: "EgressGuard.assertAllowed rejects a non-https scheme, a malformed URL, or a host absent from the allowlist, all as fail-closed AuthzError/ValidationError thrown before fetchWithTimeout is ever reached. The thrown error's details carry only host and scheme, never the full URL, so a blocked path or query holding a token or PII is never captured in the error.",
      },
      {
        title:
          "Purpose-bound sinks, a rented-backend Bearer can't reach the model host",
        body: "assertAllowedFor / fetchAs require a host to be allowlisted for a specific kind, not just present on the list. A host sanctioned only for model-fetch throws AuthzError if a rented-backend credentialed request targets it, and vice versa, each sink kind exists for exactly one credentialed surface.",
      },
      {
        title: "guardedFetch, install as another runtime's outbound hook",
        body: "The guard exposes itself as a bare (input, init) => Promise<Response>, the shape transformers.js's env.fetch accepts, so an on-device model loader can be handed the guard directly and cannot egress out of band. @caisson/local-inference's rented-backend transport calls guard.fetchAs(\"rented-backend\", ...) the same way, composed directly, not just a manifest listing.",
      },
      {
        title: "Defensive re-parse at construction",
        body: "The EgressGuard constructor re-runs parsePrivacyPolicy on the policy it's given, so a hand-built or deserialized policy object that bypassed parsePrivacyPolicy at the boundary still fails closed on a bad host, unknown kind, or unknown mode before the guard's host map is even built.",
      },
    ],
    artifact: {
      label:
        "EgressGuard.assertAllowed, the fail-closed check every outbound request passes through first",
      lang: "ts",
      file: "packages/local-privacy/src/egress-guard.ts",
      code: '  assertAllowed(input: string | URL): URL {\n    let url: URL;\n    try {\n      url = input instanceof URL ? input : new URL(input);\n    } catch {\n      throw new ValidationError("egress blocked: malformed URL");\n    }\n    if (url.protocol !== "https:") {\n      // Non-https never egresses — blocks http:, and data:/file:/javascript: smuggling.\n      throw new AuthzError("egress blocked: non-https scheme", {\n        scheme: url.protocol,\n      });\n    }\n    const host = url.hostname.toLowerCase();\n    if (!this.#allow.has(host)) {\n      // Empty allowlist ⇒ this branch always fires ⇒ zero egress. No host is implicit.\n      throw new AuthzError(\n        "egress blocked: host not on the privacy allowlist (fail-closed-to-offline)",\n        { host, privacy: this.#policy.privacy },\n      );\n    }\n    return url;\n  }',
      annotations: [
        'url.protocol !== "https:" runs before the allowlist lookup, http:, data:, file:, and javascript: schemes are blocked outright, not just non-allowlisted hosts.',
        "this.#allow.has(host) checks a Map built once at construction from the policy's allowlist, with an empty allowlist this is always false, so every call falls through to the AuthzError (zero egress by default).",
        "The thrown AuthzError's details carry only host and privacy, never the input URL's path or query, where a token or PII could otherwise leak into a caught error.",
      ],
    },
    faq: [
      {
        question:
          "Does local-privacy make my app HIPAA or GDPR compliant on its own?",
        answer:
          "No (no module makes an organization compliant; that determination is your organization's and its auditor's to make. local-privacy ships the technical control both frameworks point at for data locality: a default-deny egress boundary and cryptographic proof, via a thrown AuthzError, that an unlisted host is unreachable) not a policy statement that data stays local.",
      },
      {
        question: "What happens if I don't configure an allowlist at all?",
        answer:
          "Every outbound host is blocked. allowlist defaults to [] in privacyPolicySchema, and ZERO_EGRESS_POLICY (local-only with an empty allowlist) is the air-gap baseline the edition installs unless a deployer explicitly opts a sanctioned sink in. There is no implicit host and no silent fallback to a hosted provider.",
      },
      {
        question:
          "Can a rented-backend API credential accidentally reach the model-download host, or vice versa?",
        answer:
          "No. assertAllowedFor and fetchAs require the host to be allowlisted for the specific kind requested, a host sanctioned only for model-fetch throws AuthzError on a rented-backend call, naming the required and actual kinds (never the full URL). Purpose-binding is enforced per call, not just per host.",
      },
      {
        question: "Does this replace fetchWithTimeout, or sit in front of it?",
        answer:
          "It wraps it. EgressGuard.fetch calls assertAllowed first and only then delegates to the kernel's fetchWithTimeout, the one audited outbound chokepoint (the native AbortSignal timeout is forbidden on Bun). A blocked request never reaches fetchWithTimeout, so no socket opens and no bytes leave the device.",
      },
    ],
  },
  {
    slug: "local-sync",
    metaTitle: "Local Sync, Deterministic Offline Merge | Caisson",
    metaDescription:
      "A per-tenant changeset log, a non-forgeable hybrid logical clock, and an order-independent last-writer-wins merge, tombstones persist across sync rounds so a stale edit can never resurrect a deleted row.",
    heroOneLiner:
      "Two replicas can merge in either order and land on the exact same result: a stale peer's edit can never resurrect a row a later delete already won.",
    definition:
      "local-sync is Caisson's two-way offline sync engine: a per-tenant changeset log captures every local mutation, a hybrid logical clock (a wall-clock hint plus a non-forgeable replica id and monotonic counter) stamps each change, and a pure last-writer-wins merge converges any set of replicas to one identical result. Tombstones persist across sync rounds, so a stale peer edit can never resurrect a row a later delete already won.",
    included: [
      {
        title: "Per-tenant changeset capture, replica-stamped",
        body: "ChangesetLog.open binds one instance to exactly one tenant's already-open SQLite file: on first use it mints a randomUUID() replica id and persists it in sync_meta; on re-open it asserts the file's stored tenant matches and throws TenancyError rather than re-pointing the file to a different tenant. recordUpsert and recordDelete mirror every local write into sync_changelog; capture(sinceSeq) packages everything past a watermark into a Changeset.",
      },
      {
        title: "Fail-closed changeset validation at the boundary",
        body: "parseChangeset runs an untrusted, peer-supplied payload through changesetSchema (a strictObject that rejects unknown keys) before anything touches local state. A superRefine cross-field check enforces that an upsert entry MUST carry values and a delete entry MUST NOT, and rejects any entry whose seq exceeds the changeset's own until watermark.",
      },
      {
        title: "A non-forgeable hybrid logical clock",
        body: "stampFromEntry derives an HlcStamp (physical (the updatedAt wall-clock hint), node (the originating replicaId), counter (the per-replica seq)) for every captured change. compareStamps is a strict total order over the three: physical first, then node, then counter, so a peer can bias the physical leg by skewing its clock but can never forge another replica's node to win a tie.",
      },
      {
        title: "Order-independent LWW merge, no resurrection by construction",
        body: "reconcileReplicas folds every changeset's entries into one winners Map keyed by (table, pk), keeping only the entry whose compareStamps result is greatest, a winning delete is simply never pushed into the returned rows, so a losing concurrent upsert can't resurrect it. The result is sorted by (table, pk), so reconcileReplicas([A, B]) and reconcileReplicas([B, A]) serialize byte-equal.",
      },
      {
        title: "Tombstones persist across sync rounds",
        body: "reconcileWithTombstones composes reconcileReplicas rather than reimplementing it: it replays a persisted Tombstone set as synthetic delete Changesets so a stale, lower-stamped upsert from a batch that no longer carries the original delete still loses. advanceTombstones folds prior tombstones and new entries into the greatest-stamped delete per key; a strictly-greater upsert legitimately re-creates the row and drops out of the set.",
      },
      {
        title: "Horizon-gated GC, and a cross-tenant merge fails closed",
        body: "gcTombstones drops a tombstone only once stamp.physical crosses a horizon the caller must set below the slowest replica's un-synced-edit lag, collect earlier and a still-pending stale upsert could resurrect the row. Both reconcileReplicas and reconcileWithTombstones throw TenancyError the moment two changesets don't share one tenantId, defense-in-depth over the file-per-tenant boundary ChangesetLog.assertApplicable already enforces at the transport edge.",
      },
    ],
    artifact: {
      label: "reconcileReplicas, the pure, order-independent LWW merge core",
      lang: "ts",
      file: "packages/local-sync/src/reconcile.ts",
      code: 'export function reconcileReplicas(\n  changesets: readonly Changeset[],\n): ReconciledRow[] {\n  // Defense-in-depth: all replicas must belong to the same tenant file (the ADR-0073 partition).\n  let tenantId: string | undefined;\n  for (const cs of changesets) {\n    if (tenantId === undefined) {\n      tenantId = cs.tenantId;\n    } else if (cs.tenantId !== tenantId) {\n      throw new TenancyError("cannot reconcile changesets across tenants", {\n        reason: "tenant-partition",\n      });\n    }\n  }\n\n  // LWW register per (table, pk): keep the change with the greatest HLC stamp.\n  const winners = new Map<string, Map<string, Winner>>();\n  for (const cs of changesets) {\n    for (const entry of cs.entries) {\n      const stamp = stampFromEntry(entry, cs.replicaId);\n      let byPk = winners.get(entry.table);\n      if (byPk === undefined) {\n        byPk = new Map<string, Winner>();\n        winners.set(entry.table, byPk);\n      }\n      const current = byPk.get(entry.pk);\n      if (current === undefined || compareStamps(stamp, current.stamp) > 0) {\n        byPk.set(entry.pk, { entry, stamp });\n      }\n    }\n  }\n\n  // Materialize the live set: a winning delete is a tombstone (excluded — no resurrection by a loser).\n  const rows: ReconciledRow[] = [];\n  for (const [table, byPk] of winners) {\n    for (const [pk, winner] of byPk) {\n      const { entry } = winner;\n      if (entry.op === "upsert" && entry.values !== null) {\n        rows.push({ table, pk, values: entry.values });\n      }\n    }\n  }\n\n  // Total-order the live set by (table, pk) so divergent replicas serialize byte-equal.\n  rows.sort((a, b) =>\n    a.table < b.table\n      ? -1\n      : a.table > b.table\n        ? 1\n        : a.pk < b.pk\n          ? -1\n          : a.pk > b.pk\n            ? 1\n            : 0,\n  );\n  return rows;\n}',
      annotations: [
        "The winners Map keeps only the entry whose compareStamps result is greatest per (table, pk), the HLC total order is the only comparator, so a skewed peer clock can't decide a tie the node/counter tiebreak already settled.",
        'A winning delete is never pushed into rows, only entry.op === "upsert" reaches the returned set, so a tombstone is excluded by construction rather than filtered out after the fact.',
        "rows.sort orders purely by table then pk with no dependency on changeset input order, which is what makes reconcileReplicas([A, B]) and reconcileReplicas([B, A]) serialize byte-identical.",
      ],
    },
    faq: [
      {
        question:
          "What happens if two offline devices edit the same row before either has synced?",
        answer:
          "Whichever edit has the greatest HLC stamp wins (physical (the updatedAt wall-clock hint) first, then the originating replicaId, then the per-replica seq) and reconcileReplicas keeps only that entry per (table, pk). The result never depends on merge order: reconcileReplicas([A, B]) and reconcileReplicas([B, A]) produce the exact same row.",
      },
      {
        question:
          "Can a row I deleted come back if an old, un-synced device finally syncs in?",
        answer:
          "No, unless that device's edit genuinely postdates the delete. reconcileWithTombstones persists the greatest-stamped delete per (table, pk) as a Tombstone and replays it as a synthetic delete on every later merge, so a stale upsert whose HLC stamp is lower than the tombstone's still loses. Only a strictly-greater-stamped upsert legitimately re-creates the row.",
      },
      {
        question:
          "Does two-way sync depend on the devices' clocks being in sync?",
        answer:
          "No. updatedAt is only an ordering hint, never the sole authority, compareStamps breaks an exact-physical tie with the non-forgeable replicaId, then the per-replica seq. A skewed or forged wall clock can bias which of two truly concurrent edits looks newer, but it can never make the merge non-deterministic or let a peer impersonate another replica's tiebreak.",
      },
      {
        question:
          "If two tenants both use this, can one tenant's sync data ever land in another tenant's local file?",
        answer:
          "No. ChangesetLog binds one instance to one already-open SQLite file and asserts the file's stored tenant id on every re-open; assertApplicable rejects an inbound changeset whose tenantId doesn't match before any entry is integrated. reconcileReplicas and reconcileWithTombstones re-check the same invariant as defense-in-depth and throw TenancyError rather than silently merging across the boundary.",
      },
    ],
  },
  {
    slug: "frameworks-pack",
    metaTitle: "Frameworks Pack, Compliance Control Crosswalks | Caisson",
    metaDescription:
      "An own-authored canonical control registry plus five regime crosswalks (SOC 2, PCI DSS, GDPR, ISO 27001, NIST 800-53) whose implements/maps-to claim is enforced by the type, not a convention.",
    heroOneLiner:
      "A canonical control library where an `implements` claim without a linkable proof pointer fails to typecheck.",
    definition:
      "frameworks-pack is Caisson's clean-room control library: defineFramework builds three own-authored packs (SOC 2 TSC, HIPAA Security, and the EU AI Act's high-risk obligations) plus four native regime crosswalks. It depends on and re-exports oscal-spine for the NIST SP 800-53 crosswalk, pinned reference catalog, and shared crosswalk contracts, preserving its existing public imports.",
    included: [
      {
        title: "Browser-safe entry points",
        body: "Import @caisson/frameworks-pack/browser inside a client bundle for the control model, the three packs, the regime crosswalks, the SoA computation, and the browser half of the OSCAL surface together, or ./registry for the model alone. The main entry keeps the complete node-capable surface, and every browser-entry export is also on it.",
      },
      {
        title: "Fail-closed control registry",
        body: "defineControl and defineFramework run every control through Zod's parseStrict at author time: canonicalControlId must match the uppercase dotted-segment pattern, crosswalk references must be unique on (framework, reference), and control ids must be unique within a Framework, an authoring mistake throws at module load, not at render time.",
      },
      {
        title:
          "Three own-authored framework packs, canonical ids shared across them",
        body: "soc2Tsc, hipaaSecurity, and euAiAct are separately exported Framework catalogs. Where a control is the same underlying requirement across frameworks (GOVERNANCE.SECURITY-RESPONSIBILITY appears in both soc2Tsc and hipaaSecurity) the pack reuses the exact canonical id verbatim instead of minting a duplicate, so one control can be crosswalked from more than one regime.",
      },
      {
        title: "Claim honesty enforced by the type, not a lint rule",
        body: "RegimeCrosswalkRow is a Zod discriminatedUnion on claim: the implementsRow branch requires a proof: ProofPointer field: an implements row with no linkable test/CI/live-verification/oscal-conformance artifact does not typecheck. Every mapsToRow, by contrast, carries no proof field to fabricate.",
      },
      {
        title: "NIST SP 800-53 rev5, vendored byte-exact and hash-pinned",
        body: "The re-exported NIST_CATALOG_PIN from oscal-spine records the upstream commit SHA, the catalog's own OSCAL version (1.2.2), and a SHA-256 of the committed JSON bytes. extractControlIds walks base controls plus nested enhancements so every nist80053Crosswalk reference is checked against a real catalog id.",
      },
      {
        title:
          "NIST IR 8278A relationship vocabulary, capped at maps-to structurally",
        body: "nist80053Crosswalk rows carry NIST's own relationship (subset-of/intersects-with/equal/superset-of/not-related-to), rationale, and strength fields (the vocabulary an OLIR mapping actually uses) while defineNist80053Crosswalk throws if any row is missing its required canonicalControlId, and no row on this crosswalk can ever carry a proof field, so it can never promote to implements.",
      },
    ],
    artifact: {
      label:
        "RegimeCrosswalkRow, the claim discriminated union that makes an unproven `implements` a type error",
      lang: "ts",
      file: "packages/oscal-spine/src/crosswalks/regime-crosswalk.ts",
      code: '/**\n * An assertive row: the mechanism implements a technical control a live repo artifact proves. `proof`\n * is REQUIRED (the discriminated union makes an `implements` row without it a type error).\n */\nconst implementsRow = strictObject({\n  claim: z.literal("implements"),\n  ...rowBase,\n  proof: ProofPointer,\n});\n\n/** A conservative row: the mechanism maps to (shares a domain with) the requirement. No proof. */\nconst mapsToRow = strictObject({\n  claim: z.literal("maps-to"),\n  ...rowBase,\n});\n\n/** One crosswalk row — assertive (`implements` + proof) or conservative (`maps-to`), by `claim`. */\nexport const RegimeCrosswalkRow = z.discriminatedUnion("claim", [\n  implementsRow,\n  mapsToRow,\n]);\nexport type RegimeCrosswalkRow = z.infer<typeof RegimeCrosswalkRow>;',
      annotations: [
        "implementsRow spreads proof: ProofPointer into the schema itself, an implements claim with no linkable test/CI/live-verification artifact fails validation, it isn't a reviewer's judgment call.",
        "mapsToRow has no proof field at all, so a conservative row literally cannot carry a fabricated pointer, the two branches of RegimeCrosswalkRow enforce honesty by omission as much as by requirement.",
        "...rowBase spreads buyerResponsibility into both branches, so every row (implements or maps-to) is required to state what Caisson does not cover.",
      ],
    },
    faq: [
      {
        question:
          "Does buying frameworks-pack make our system SOC 2 or HIPAA compliant?",
        answer:
          "No, no module makes an organization compliant; that determination is your organization's and its auditor's. frameworks-pack ships the technical-control crosswalk both frameworks point at: an own-authored canonical control mapped to the regime's requirement id, with a proof pointer wherever the claim is implements rather than maps-to.",
      },
      {
        question:
          "What's the difference between an implements row and a maps-to row?",
        answer:
          "implements is used only where a live test, CI check, live-verification harness, or OSCAL conformance artifact in this repo proves the named technical control, and the row carries a proof pointer to it, enforced by RegimeCrosswalkRow's discriminated union, not editorial judgment. Everywhere else the row is maps-to: the mechanism addresses the same domain, but nothing in this repo asserts the requirement is satisfied.",
      },
      {
        question:
          "Is vendoring the NIST SP 800-53 catalog verbatim actually legal to ship?",
        answer:
          "Yes, usnistgov/oscal-content is CC0 1.0 Universal (public domain), so the catalog JSON is committed byte-exact and hash-pinned via NIST_CATALOG_PIN. The SOC 2, HIPAA, PCI DSS, GDPR, and ISO 27001 material is different: those packs never copy the framework's own text, only bare requirement-id citations (e.g. CC6.1) pointing at Caisson's own clean-room control prose.",
      },
      {
        question:
          "Do I need @caisson/compliance-core to use this, or does it work on its own?",
        answer:
          "No. frameworks-pack works on its own with @caisson/kernel, zod, and its @caisson/oscal-spine dependency. You get the framework catalogs, five regime crosswalks, and the re-exported pinned NIST reference data. compliance-core is the separate evidence-pack engine; all three packages ship in the Compliance bundle.",
      },
    ],
  },
  {
    slug: "oscal-spine",
    metaTitle: "OSCAL Spine, Deterministic Compliance Exports | Caisson",
    metaDescription:
      "OSCAL v1.2.2 assessment, POA&M, catalog, XML, and ISO 27001 SoA exports with a hash-pinned NIST SP 800-53 rev5 reference catalog.",
    heroOneLiner:
      "One package owns every OSCAL artifact, conformance fixture, and pinned NIST reference your compliance pipeline depends on.",
    definition:
      "oscal-spine is Caisson's commercial OSCAL boundary. It turns structural evidence-pack and framework inputs into deterministic OSCAL v1.2.2 assessment plans, assessment results, POA&M fragments, catalogs, XML, and ISO 27001 SoA components. The same package owns the byte-pinned NIST SP 800-53 rev5 catalog and the own-authored OLIR relationship crosswalk checked against it.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/oscal-spine/browser inside a client bundle for the contracts, crosswalk model, catalog pin, and the pure catalog and assessment-plan exporters; its id seam defaults to the WebCrypto global crypto.randomUUID (Node 20.12 or later). The main entry keeps the full node-capable surface, and every browser-entry export is also on it.",
      },
      {
        title: "Assessment artifacts from evidence you already generated",
        body: "toOscalBundle projects an evidence-pack manifest into assessment-results and POA&M report fragments, while toOscalAssessmentPlan emits the matching plan. Inputs are structural contracts, so the exporter does not reach back into the collector or storage layers.",
      },
      {
        title: "One deterministic canonical-control catalog",
        body: "toOscalCatalog deduplicates shared canonical controls document-wide, sorts frameworks, groups, and controls before emission, and accepts injected clock and UUID seams. The same inputs and seams produce byte-identical JSON.",
      },
      {
        title: "JSON, XML, and ISO 27001 SoA targets",
        body: "The package keeps the JSON model, XML conversion path, and ISO 27001 SoA component-definition exporter together, with golden fixtures and oscal-cli conformance checks covering the public formats.",
      },
      {
        title: "NIST SP 800-53 reference bytes are pinned",
        body: "NIST_CATALOG_PIN travels as one coherent record: upstream repository and path, exact commit SHA, catalog and OSCAL versions, SHA-256, and vendored filename. A drift test hashes the committed bytes instead of trusting a moving branch.",
      },
      {
        title: "Parent imports remain source-compatible",
        body: "@caisson/compliance-core and @caisson/frameworks-pack both depend on and re-export oscal-spine. Existing buyers keep their import paths; buyers who need neither parent can purchase the OSCAL surface directly.",
      },
    ],
    artifact: {
      label:
        "NIST_CATALOG_PIN, one immutable record for the vendored reference catalog",
      lang: "ts",
      file: "packages/oscal-spine/src/vendor/nist-catalog-pin.ts",
      code: "export const NIST_CATALOG_PIN: NistCatalogPin = {\n  repo: NIST_CATALOG_REPO,\n  upstreamPath: NIST_CATALOG_UPSTREAM_PATH,\n  commitSha: NIST_CATALOG_COMMIT_SHA,\n  sourceUrl: NIST_CATALOG_SOURCE_URL,\n  catalogVersion: NIST_CATALOG_VERSION,\n  oscalVersion: NIST_CATALOG_OSCAL_VERSION,\n  sha256: NIST_CATALOG_SHA256,\n  vendoredFilename: NIST_CATALOG_VENDORED_FILENAME,\n};",
      annotations: [
        "The source URL is derived from the exact commit SHA, never from a moving main-branch URL.",
        "The SHA-256 and OSCAL version travel with the source identity, so consumers cannot accidentally mix a new catalog with an old pin.",
        "The vendored-byte test hashes the committed JSON and compares it with this record before crosswalk validation runs.",
      ],
    },
    faq: [
      {
        question: "Does an OSCAL-valid export certify our system?",
        answer:
          "No. Schema conformance proves that the artifact is machine-readable OSCAL v1.2.2. Your assessor or authorizing official still determines whether the system and its evidence satisfy the framework.",
      },
      {
        question:
          "Will existing compliance-core or frameworks-pack imports break?",
        answer:
          "No. Both parent packages depend on and re-export oscal-spine, so their existing OSCAL, NIST catalog, and crosswalk imports keep resolving. The standalone package adds a direct purchase path without removing the compatibility paths.",
      },
      {
        question:
          "Why vendor the NIST catalog instead of fetching it at runtime?",
        answer:
          "A runtime fetch would make validation depend on mutable external state. The committed catalog is pinned to one upstream commit and SHA-256, so tests and exports resolve against the same reviewed reference bytes every time.",
      },
    ],
  },
  {
    slug: "signing-primitive",
    metaTitle: "Signing Primitive, Detached Ed25519 + RFC-3161 | Caisson",
    metaDescription:
      "A detached Ed25519 signature over a canonical, chain-anchored evidence manifest, per-tenant key, optional RFC-3161 countersign, and a deployment Ed25519ph key for Rekor anchoring.",
    heroOneLiner:
      "Your evidence, signed under your own per-tenant Ed25519 key (never Caisson's) so any third party verifies it without touching your secrets.",
    definition:
      "signing-primitive produces a detached Ed25519 signature over a canonical, chain-anchored evidence manifest, bound to the WORM audit chain's tip hash and signed under a per-tenant key that is deliberately distinct from the Caisson license-issuer key. An optional RFC-3161 timestamp countersigns the signature, and a separate deployment-level Ed25519ph signer anchors receipts into Sigstore Rekor's public transparency log.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/signing-primitive/browser inside a client bundle for the verify half: the signable-payload construction, verifyEvidenceSignature over the same @noble/ed25519 primitive the server signs with, and the RFC-3161 test double (Node 20.12 or later). A relying party can check your evidence pack entirely in their own browser. The signing identity stays off that entry on purpose, a tenant seed does not belong in a bundle users download, and every browser-entry export is also on the main entry.",
      },
      {
        title: "Per-tenant Ed25519Signer, never the license key",
        body: "Ed25519Signer holds a 32-byte tenant seed in a private #secretKey field, never logged or serialized; construction throws ValidationError on an empty keyId or a wrong-length key. It is deliberately distinct from Caisson's own license-issuer key, a buyer proves provenance of their own evidence with their own identity.",
      },
      {
        title: "Detached, bound to the chain tip",
        body: "evidenceSignablePayload concatenates canonicalize(manifest) with manifest.chainAnchor.tipHash before signing; signEvidencePack signs that exact payload and returns the signature BESIDE the manifest, so the canonical body stays byte-stable and golden-fixturable. Move the WORM chain tip and the same signature no longer verifies.",
      },
      {
        title: "Fail-closed verify, never throws",
        body: "verifyEvidenceSignature returns false (never throws) on an unknown algorithm, malformed hex, a wrong-length key or signature, a tampered manifest, or a moved chain tip. A forgery, a corrupt field, and a driver error all collapse to the same denial.",
      },
      {
        title: "Optional RFC-3161 countersignature",
        body: "signEvidencePack takes an optional TimestampAuthority; StubTimestampAuthority is the network-free test double shipped for CI, and timestampCountersignsSignature recomputes sha256(signature) to confirm a token actually attests to THIS signature. The live TSA transport is a documented un-wired seam, no live network call runs in CI.",
      },
      {
        title: "Constant-time signature compare",
        body: "signaturesEqual wraps @caisson/kernel's safeEqualFixed so comparing two hex signatures never leaks how many leading bytes matched, the same timing-safe discipline the kernel's secret comparisons use elsewhere.",
      },
      {
        title: "Deployment-level Ed25519ph key for Rekor anchoring",
        body: "Ed25519PhSigner.fromEnv loads a base64 32-byte seed from CAISSON_REKOR_ANCHORING_KEY (never the per-tenant key) and signs with @noble/curves' ed25519ph, the RFC-8032 §5.1 prehash variant Rekor v2's hashedrekord endpoint requires, since a pure Ed25519 signature would be handed only a digest and re-hash it.",
      },
    ],
    artifact: {
      label:
        "signEvidencePack, the detached signature over canonicalize(manifest) ∥ chainAnchor.tipHash",
      lang: "ts",
      file: "packages/signing-primitive/src/sign.ts",
      code: "export async function signEvidencePack(\n  signer: Signer,\n  manifest: SignableManifest,\n  options?: SignEvidencePackOptions,\n): Promise<EvidenceSignature> {\n  const payload = evidenceSignablePayload(manifest);\n  const [publicKeyBytes, signatureBytes] = await Promise.all([\n    signer.publicKey(),\n    signer.sign(payload),\n  ]);\n  if (signatureBytes.length !== ED25519_SIGNATURE_BYTES) {\n    throw new ValidationError(\n      `detached signature must be ${String(ED25519_SIGNATURE_BYTES)} bytes, got ${String(signatureBytes.length)}`,\n    );\n  }\n  if (publicKeyBytes.length !== ED25519_PUBLIC_BYTES) {\n    throw new ValidationError(\n      `ed25519 public key must be ${String(ED25519_PUBLIC_BYTES)} bytes, got ${String(publicKeyBytes.length)}`,\n    );\n  }\n  const base: EvidenceSignature = {\n    algorithm: signer.algorithm,\n    keyId: signer.keyId,\n    publicKey: toHex(publicKeyBytes),\n    signature: toHex(signatureBytes),\n  };\n  if (options?.timestampAuthority === undefined) return base;\n  const timestamp =\n    await options.timestampAuthority.countersign(signatureBytes);\n  return { ...base, timestamp };\n}",
      annotations: [
        "Promise.all runs signer.publicKey() and signer.sign(payload) concurrently, the key and the signature are two independent async calls, not a serial round-trip.",
        "signatureBytes and publicKeyBytes are length-checked against ED25519_SIGNATURE_BYTES/ED25519_PUBLIC_BYTES before either is hex-encoded, a malformed signer output throws instead of shipping a corrupt EvidenceSignature.",
        "options?.timestampAuthority?.countersign only runs when a TSA was supplied, the base EvidenceSignature with no timestamp field is already a complete, valid return.",
      ],
    },
    faq: [
      {
        question: "Does the signature prove we're SOC 2 or HIPAA compliant?",
        answer:
          "No, no module makes an organization compliant; that determination is your organization's and its auditor's to make. signing-primitive ships the technical control an auditor checks for provenance: a detached Ed25519 signature under your own tenant key, bound to the WORM chain's tip hash, and generates the evidence a third party can verify without ever holding your secret.",
      },
      {
        question: "Does this use the same key as the Caisson license?",
        answer:
          "No, by design. Ed25519Signer holds a per-tenant seed that's distinct from Caisson's own license-issuer key, a buyer proves provenance of their own evidence with their own identity, never Caisson's. The two keys sign for different trust models and are never interchangeable.",
      },
      {
        question:
          "What happens if someone tampers with the evidence pack after signing?",
        answer:
          "verifyEvidenceSignature fails closed (it returns false, never throws) the moment the manifest body or the bound chain tip changes, because evidenceSignablePayload hashes both into the exact bytes the signature covers. A tampered manifest, a moved chain tip, or a forged public key all fail verification the same way.",
      },
      {
        question:
          "Is this the same signature Sigstore Rekor accepts for external anchoring?",
        answer:
          "Not the per-tenant one. Rekor v2's hashedrekord endpoint rejects a pure Ed25519 signature, it's handed only a digest and would re-hash it. Ed25519PhSigner is a separate deployment-level key using ed25519ph (the RFC-8032 prehash variant) specifically for that anchoring path; the per-tenant Ed25519Signer stays the evidence-signing identity.",
      },
    ],
  },
  {
    slug: "credits",
    metaTitle: "Credits, Integer Wallet, FIFO Ledger, 402 Gate | Caisson",
    metaDescription:
      "An integer credit wallet with an append-only ledger: FOR UPDATE row locking, FIFO grant consumption, idempotent grant/debit, and a 402 gate on an empty balance.",
    heroOneLiner:
      "debit() locks the wallet row, drains unexpired grants oldest-first, and 402s before a cent of paid work runs, the ledger only ever writes what actually happened.",
    definition:
      "Credits is Caisson's integer credit wallet: grant() appends to an append-only credit_event ledger and upserts the wallet, while debit() takes a FOR UPDATE wallet-row lock and drains unexpired grants oldest-first through grant_consumption. A short balance throws InsufficientCreditsError (402) before the debit lands, the transaction rolls back with nothing recorded. Idempotent on a caller key or provider event id; grants expire on a schedule with a T-30d notice sweep.",
    included: [
      {
        title: "Browser-safe entry point",
        body: "Import @caisson/credits/browser inside a client bundle for the grant/debit event vocabulary and planFifoDebit, the FIFO waterfall debit() itself walks: hand it grant remainders and an amount and it returns the per-grant draws plus the covered and shortfall split. It reads and writes no wallet; grant(), debit(), clawback(), the balance reads, the sweeps, and the schema SQL stay on the main entry, which is unchanged, and every browser-entry export is also on it.",
      },
      {
        title: "FOR UPDATE row lock, then FIFO",
        body: "debit() locks the credit_wallet row FOR UPDATE before it ever reads a grant, so two concurrent debits for the same account serialize instead of racing to consume the same grant remainder, the same lock clawback() and sweepExpiredGrants() take before they touch the wallet.",
      },
      {
        title: "FIFO grant consumption via grant_consumption",
        body: "unexpiredGrantsFifo() walks a tenant's unexpired grants oldest-first (created_at ASC, expires_at ASC, id ASC) and debit() splits one charge across as many grants as it needs, writing one grant_consumption row per grant it draws from, a grant's remaining balance is always amount minus the sum of its consumption rows, never a mutated column.",
      },
      {
        title: "Idempotent by construction",
        body: "idemColumns() requires exactly one of sourceEventId or idempotencyKey on every grant/debit/clawback call, and insertEvent() writes through ON CONFLICT DO NOTHING RETURNING, a retried call returns { idempotent: true } off the existing row instead of raising a conflict that would poison the surrounding transaction.",
      },
      {
        title: "402 fail-closed on either floor",
        body: "debit() checks two floors and 402s on the tighter one (the FIFO-derived unexpired remaining and the raw credit_wallet.balance aggregate) throwing InsufficientCreditsError and rolling back the whole transaction with nothing recorded. spendableBalance() reads the same min() of both floors, so a displayed balance never promises more than a debit will actually cover.",
      },
      {
        title: "Clawback and expiry, both bounded to the live balance",
        body: "clawback() reclaims min(amount, currentBalance) of a refunded purchase's unspent credits (never pushing the wallet negative) and sweepExpiredGrants() burns each expired grant's residue as an explicit expiry_debit event bounded the same way, so expired value is consumed by a ledger row, never silently excluded from a read.",
      },
      {
        title: "A generic feature-meter envelope, registry-validated",
        body: "feature_grant and feature_debit carry a feature tag that featureColumn() validates against FeatureTagSchema before the ledger insert, an unregistered or misspelled tag throws with no row written, so a new metered action never mints a silent, unvalidated meter.",
      },
    ],
    artifact: {
      label: "debit(), lock, walk FIFO, 402 before a cent moves",
      lang: "ts",
      file: "packages/credits/src/credits.ts",
      code: "export async function debit(\n  tx: TenantExecutor,\n  input: DebitInput,\n): Promise<CreditResult> {\n  assertPositiveInt(input.amount);\n  const idem = idemColumns(input);\n  const feature = featureColumn(input.eventType, input.feature);\n  const fresh = await insertEvent(tx, {\n    accountId: input.accountId,\n    eventType: input.eventType,\n    amount: -input.amount,\n    feature,\n    rounding: input.rounding,\n    ...idem,\n  });\n  if (fresh === null)\n    return { balance: await balance(tx, input.accountId), idempotent: true };\n\n  // Per-account debit serialization — must precede the FIFO read (see the function comment).\n  // A missing wallet row (never granted) locks nothing and falls through to the 402 below.\n  await tx.query(\n    `SELECT balance FROM credit_wallet WHERE account_id = $1 FOR UPDATE`,\n    [input.accountId],\n  );\n\n  const grants = await unexpiredGrantsFifo(tx, input.accountId);\n  const plan = planFifoDebit(grants, input.amount);\n  for (const draw of plan.draws) {\n    await insertConsumption(tx, {\n      accountId: input.accountId,\n      grantEventId: draw.grantId,\n      debitEventId: fresh,\n      amount: draw.taken,\n    });\n  }\n  if (!(plan.shortfall <= 0)) {\n    // Unexpired remaining can't cover it — 402 with the SPENDABLE total (not the raw wallet\n    // aggregate, which may still carry not-yet-swept expired residue). Throwing rolls back the\n    // event + consumption inserts above — a failed debit leaves no trace.\n    throw new InsufficientCreditsError(input.amount, plan.covered);\n  }\n\n  const updated = await tx.query<{ balance: number }>(\n    `UPDATE credit_wallet SET balance = balance - $2\n     WHERE account_id = $1 AND balance >= $2\n     RETURNING balance`,\n    [input.accountId, input.amount],\n  );\n  if (updated.rows.length === 0) {\n    // Insufficient wallet aggregate (e.g. a clawback outran the per-grant remainders): same\n    // rollback semantics — nothing recorded.\n    throw new InsufficientCreditsError(\n      input.amount,\n      await balance(tx, input.accountId),\n    );\n  }\n  return { balance: updated.rows[0]?.balance ?? 0, idempotent: false };\n}",
      annotations: [
        "The `SELECT ... FOR UPDATE` on `credit_wallet` runs before the FIFO read, it serializes concurrent debits per account so two calls can never consume the same grant remainder.",
        "`unexpiredGrantsFifo` returns grants oldest-first and `planFifoDebit` walks them until the charge is covered, splitting one debit across multiple grants when a single grant's remainder falls short. The waterfall is pure and lives in one module, so the browser entry computes the identical draws.",
        "A plan that is not provably covered in full (`!(shortfall <= 0)`) throws `InsufficientCreditsError` and the whole transaction rolls back, the `insertEvent` and `insertConsumption` calls above never survive to be visible.",
      ],
    },
    faq: [
      {
        question: "What happens when a debit would overdraw the balance?",
        answer:
          "debit() throws InsufficientCreditsError (HTTP 402) and nothing is recorded, the FOR UPDATE lock and the ledger insert both run inside the same transaction, so a failed debit rolls back cleanly with no orphaned event or partial grant_consumption row.",
      },
      {
        question:
          "Can two concurrent requests both spend the same last credit?",
        answer:
          "No. debit() locks the credit_wallet row FOR UPDATE before it reads the account's unexpired grants, so a second concurrent debit for the same account blocks until the first commits or rolls back, it can never observe stale grant remainders.",
      },
      {
        question:
          "Does a retried network request double-charge a debit or double-grant a purchase?",
        answer:
          "No. Every grant/debit/clawback call supplies exactly one of sourceEventId or idempotencyKey (idemColumns enforces this), and insertEvent writes through ON CONFLICT DO NOTHING RETURNING, a retried call returns the already-applied result (idempotent: true) instead of inserting a second ledger row.",
      },
      {
        question: "What happens to unspent credits when a grant expires?",
        answer:
          "sweepExpiredGrants() burns each expired grant's residue as an explicit expiry_debit ledger event (not a silent exclusion from balance) bounded to the live wallet balance the same way clawback() is. sweepExpiryNotices() emails a T-30d warning first, gated by a one-row-per-grant credit_expiry_notice marker so the notice only ever fires once.",
      },
    ],
  },
];

/** Whether a module has a standalone depth page (`/marketplace/modules/<id>`) — the ONE gate a
 *  bundle/persona page must check before rendering a member card as a clickable link. A module can
 *  be priced (`MODULES`) with no depth page yet; gating a `<Link>` on price truthiness instead
 *  of this renders a card that 404s (G5) — `provenance/page.tsx`'s `MEMBER_DETAIL` set was the
 *  original hand-rolled instance of this same check. */
export function hasModulePage(id: string): boolean {
  return MODULE_PAGES.some((r) => r.slug === id);
}
