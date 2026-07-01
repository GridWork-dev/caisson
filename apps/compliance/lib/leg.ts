// lib/leg.ts — the Compliance edition leg (P2-19a, ADR-0044). The thin wiring shell that runs the
// P2 hero end to end over the test-doubled substrate (`createLegHarness`), composing the green
// Wave-0/P2 primitives — it adds NO new compliance logic, it WIRES them (ADR-0003 composition):
//
//   1. SEED + ENCRYPT  — write a SEC/HIPAA field under `withTenantCrypto` (T16): crypto nested
//      INSIDE the RLS tenant scope (boundary == boundary, ADR-0005). Prove it round-trips and that a
//      cross-row relocate fails AEAD authentication (row-bound AAD, ADR-0055 / TM-E).
//   2. LOCK → WORM      — append an `artifact.locked` event to the append-only audit chain, minting a
//      length-keyed write-once WORM anchor (T3, ADR-0052), record an append-only locked version
//      (T4, ADR-0053), and store the artifact bytes under a tenant-scoped WORM key with a 7-yr
//      retention term. Prove `verifyChain` passes against the trusted anchor.
//   3. EMIT + VALIDATE  — gather REAL substrate facts (chain integrity, FORCE-RLS posture, WORM
//      retention) through the T11 collectors, generate the deterministic control→evidence pack (T13,
//      ADR-0058) for TWO frameworks (SOC2-TSC + HIPAA-Security, ADR-0057 — the same 3 collector
//      results cited against each framework's own control ids), validate each against the canonical
//      format contract (T12), sign each per-tenant (Ed25519, T14, ADR-0056), and mirror an
//      `evidence.generated` ops event through the base `EventSink` (ADR-0075) per pack. The SOC2 pack
//      is also mapped (never pushed, T15) to an OSCAL v1.1.3 SAR+POA&M bundle. Both byte-stable
//      manifests are golden-pinned by `leg.test.ts`.
//   4. BLOCK            — prove flag-never-guess: one control with UNRESOLVED evidence makes the
//      generator throw `EvidencePackBlockedError` with NO partial pack written (TM-K).
//
// Deterministic by construction: `tenantId` + `now` are injected, and every value entering the
// manifest (chain payload, artifact bytes, retention dates, RLS posture) is fixed for a fixed
// (tenantId, now) — so the manifest is byte-stable and reproducible. The only non-deterministic
// output is the AES-GCM ciphertext (random nonce), which never enters the manifest.
import { createHash, randomUUID } from "node:crypto";
import {
  AuditChainStore,
  LockedVersionStore,
  buildArtifactKey,
  retainUntilFrom,
  DEFAULT_RETENTION_YEARS,
  MIN_RETENTION_YEARS,
} from "@caisson/audit-worm";
import {
  currentFieldCryptoContext,
  decryptField,
  encryptField,
  parseEnvelope,
} from "@caisson/field-crypto";
import {
  Ed25519Signer,
  EvidencePackBlockedError,
  chainVerifyCollector,
  emitEvidenceGenerated,
  generateEvidencePack,
  hipaaSecurity,
  parseEvidencePackManifest,
  rlsForceCollector,
  signEvidencePack,
  soc2Tsc,
  toOscalBundle,
  verifyEvidenceSignature,
  withTenantCrypto,
  wormRetentionCollector,
  type CollectorResult,
  type EvidenceControlPlan,
  type EvidencePackChainAnchor,
  type EvidencePackFramework,
  type EvidencePackManifest,
  type Framework,
  type GenerateEvidencePackInput,
  type OscalExportBundle,
  type RlsTableFact,
} from "@caisson/compliance";
import { type LegHarness, PHI_TABLE, TENANT_TABLES } from "./harness";

// --- Fixed, deterministic leg inputs (a fixed (tenantId, now) → a byte-stable manifest) ----------

/** A fixed demo tenant id. UUID-shaped: the WORM key prefix (`{account_id}/…`) requires a UUID. */
export const DEMO_TENANT_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
/** A fixed generation instant — injected at the edge so the pack's dates are reproducible. */
export const DEMO_NOW = new Date("2026-06-27T12:00:00.000Z");

/** The encrypted SEC/HIPAA column context (`table.column`) and a representative PHI value. */
const PHI_COLUMN = `${PHI_TABLE}.ssn`;
const DEMO_SSN = "078-05-1120";

/** The locked artifact: a fixed compliance-policy document body (fixed bytes → a stable content hash). */
const ARTIFACT_ID = "compliance-policy";
const ARTIFACT_BODY = JSON.stringify({
  document: "Information Security & Privacy Policy",
  artifactId: ARTIFACT_ID,
  version: 1,
});

// --- Result shape (the four exit checks, surfaced for the app route + the integration test) -------

export interface EncryptedFieldCheck {
  readonly columnContext: string;
  /** The stored cell is a versioned envelope, never the plaintext. */
  readonly storedIsEnvelope: boolean;
  readonly keyVersion: number;
  /** Decrypt under the SAME composed (RLS + crypto) scope returns the plaintext. */
  readonly roundTrips: boolean;
  /** Decrypt the same ciphertext bound to a DIFFERENT row fails AEAD authentication (TM-E). */
  readonly crossRowRelocateRejected: boolean;
}

export interface WormLockCheck {
  readonly artifactKey: string;
  readonly artifactSha256: string;
  readonly retainUntil: string;
  readonly requiredUntil: string;
  readonly meetsRetentionFloor: boolean;
  readonly lockedVersionId: string;
  readonly chainAnchor: EvidencePackChainAnchor;
  /** `verifyChain(entries, anchor)` passes against the trusted WORM anchor. */
  readonly chainVerified: boolean;
}

export interface EvidenceCheck {
  readonly framework: string;
  readonly sha256: string;
  /** A second generation yields byte-identical archive + canonical body (clock-independent). */
  readonly deterministic: boolean;
  /** The canonical body re-parses through the format contract (T12). */
  readonly validatedAgainstFormat: boolean;
  readonly controlCount: number;
  readonly controlsReady: number;
  readonly controlsWithGaps: number;
  readonly totalEvidenceItems: number;
  readonly posture: string;
  /** The detached per-tenant Ed25519 signature verifies (T14 / TM-L). */
  readonly signatureValid: boolean;
  readonly generatedAt: string;
}

export interface BlockedCheck {
  /** Generation threw `EvidencePackBlockedError` (an unresolved control). */
  readonly blocked: boolean;
  readonly unresolvedCount: number;
  /** No pack was produced — the throw precedes all assembly (no partial pack). */
  readonly noPartialPack: boolean;
}

export interface LegResult {
  readonly tenantId: string;
  readonly encryptedField: EncryptedFieldCheck;
  readonly wormLock: WormLockCheck;
  /** The SOC2-TSC evidence pack (framework `soc2-tsc`). */
  readonly evidence: EvidenceCheck;
  /** The HIPAA-Security evidence pack (framework `hipaa-security`) — the SAME 3 collector results,
   *  cited against HIPAA's own control ids (ADR-0057). */
  readonly hipaaEvidence: EvidenceCheck;
  readonly blocked: BlockedCheck;
  /** Operational event names mirrored through the `EventSink` (e.g. `evidence.generated`). */
  readonly emittedEvents: readonly string[];
  /** The SOC2-TSC byte-stable canonical manifest — golden-pinned by `leg.test.ts`. */
  readonly manifest: EvidencePackManifest;
  /** The HIPAA-Security byte-stable canonical manifest — golden-pinned by `leg.test.ts`. */
  readonly hipaaManifest: EvidencePackManifest;
  /** The SOC2 pack mapped (not pushed, T15) to an OSCAL v1.1.3 SAR+POA&M bundle. Deterministic under
   *  the same injected `now` + a fixed `newId` counter. */
  readonly oscal: OscalExportBundle;
  /** True iff every exit check passed (the app route's single health signal). */
  readonly allChecksPassed: boolean;
}

export interface RunLegOptions {
  /** The seed tenant id (UUID — WORM keys are `{account_id}/…`). Default: the fixed demo tenant. */
  readonly tenantId?: string;
  /** The injected generation clock. Default: the fixed demo instant. */
  readonly now?: Date;
}

// --- helpers -------------------------------------------------------------------------------------

/** Read a tenant table's FORCE-RLS posture from the catalog (superuser ground truth) for one table. */
async function readRlsPosture(
  harness: LegHarness,
  tables: readonly string[],
): Promise<RlsTableFact[]> {
  const facts: RlsTableFact[] = [];
  for (const table of tables) {
    const sec = await harness.db.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1`,
      [table],
    );
    const pol = await harness.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1`,
      [table],
    );
    const s = sec.rows[0];
    const p = pol.rows[0];
    facts.push({
      table,
      rowSecurityEnabled: s?.relrowsecurity ?? false,
      rowSecurityForced: s?.relforcerowsecurity ?? false,
      tenantPolicyPresent: (p?.n ?? 0) > 0,
    });
  }
  return facts;
}

/** Build an `EvidenceControlPlan` from an own-authored control (any framework catalog) + its
 *  gathered evidence — the 3 substrate collectors are framework-agnostic, so the same
 *  `CollectorResult` can back a control in more than one framework's plan. */
function controlPlan(
  framework: Framework,
  controlId: string,
  evidence: readonly CollectorResult[],
): EvidenceControlPlan {
  const control = framework.controls.find((c) => c.id === controlId);
  if (control === undefined) {
    throw new Error(`leg: unknown ${framework.id} control id "${controlId}"`);
  }
  return {
    controlId: control.id,
    title: control.title,
    family: control.family,
    statement: control.statement,
    crosswalk: control.crosswalk,
    evidence,
  };
}

/** A deterministic OSCAL UUID source (a counter) — makes the OSCAL bundle byte-stable for the
 *  golden fixture (mirrors `oscal-export.test.ts`'s own `counterIds()` pattern). */
function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

// --- the leg -------------------------------------------------------------------------------------

/**
 * Run the full Compliance leg against an already-provisioned `LegHarness`. Returns a structured
 * report of the four exit checks plus the byte-stable evidence manifest. Pure of any live cloud —
 * the harness is PGlite + a local WORM dir + derived keys + an in-memory sink.
 */
export async function runComplianceLeg(
  harness: LegHarness,
  options: RunLegOptions = {},
): Promise<LegResult> {
  const tenantId = options.tenantId ?? DEMO_TENANT_ID;
  const now = options.now ?? DEMO_NOW;
  const { db, store, provider, sink } = harness;

  const chainStore = new AuditChainStore({ db, store, now: () => now });
  const versionStore = new LockedVersionStore({ db });

  // 1 — SEED + ENCRYPT a SEC/HIPAA field under withTenantCrypto (crypto INSIDE the RLS scope).
  const rowId = randomUUID();
  await withTenantCrypto(db, tenantId, provider, async (tx) => {
    const sealed = encryptField(
      currentFieldCryptoContext(),
      PHI_COLUMN,
      rowId,
      DEMO_SSN,
    );
    await tx.query(
      `INSERT INTO ${PHI_TABLE} (id, account_id, ssn) VALUES ($1, $2, $3)`,
      [rowId, tenantId, sealed],
    );
  });

  // Ground truth (superuser, RLS bypassed): the stored cell is an envelope, never the plaintext.
  const groundTruth = await db.query<{ ssn: string }>(
    `SELECT ssn FROM ${PHI_TABLE} WHERE id = $1`,
    [rowId],
  );
  const storedCell = groundTruth.rows[0]?.ssn ?? "";
  const storedIsEnvelope = storedCell !== DEMO_SSN && storedCell.length > 0;
  const keyVersion = storedIsEnvelope
    ? parseEnvelope(storedCell).keyVersion
    : 0;

  // Read back under the SAME composed scope → decrypts (row-bound AAD authenticates).
  const decrypted = await withTenantCrypto(
    db,
    tenantId,
    provider,
    async (tx) => {
      const r = await tx.query<{ ssn: string }>(
        `SELECT ssn FROM ${PHI_TABLE} WHERE id = $1`,
        [rowId],
      );
      const cell = r.rows[0];
      if (cell === undefined) return null;
      return decryptField(
        currentFieldCryptoContext(),
        PHI_COLUMN,
        rowId,
        cell.ssn,
      );
    },
  );
  const roundTrips = decrypted === DEMO_SSN;

  // Cross-row relocate (same tenant/column/kv, different row) → AEAD authentication failure (TM-E).
  let crossRowRelocateRejected = false;
  try {
    await withTenantCrypto(db, tenantId, provider, () =>
      Promise.resolve(
        decryptField(
          currentFieldCryptoContext(),
          PHI_COLUMN,
          randomUUID(),
          storedCell,
        ),
      ),
    );
  } catch {
    crossRowRelocateRejected = true;
  }

  // 2 — LOCK an append-only versioned artifact into WORM with a SHA-256 chain anchor.
  const artifactBytes = new TextEncoder().encode(ARTIFACT_BODY);
  const artifactSha256 = createHash("sha256")
    .update(artifactBytes)
    .digest("hex");
  const artifactKey = buildArtifactKey(
    tenantId,
    "artifacts",
    "compliance-policy-v1.json",
  );
  const retainUntil = retainUntilFrom(now, DEFAULT_RETENTION_YEARS);
  await store.put(artifactKey, artifactBytes, {
    retainUntil,
    contentType: "application/json",
  });
  const head = await store.head(artifactKey);
  const requiredUntil = retainUntilFrom(now, MIN_RETENTION_YEARS);

  const lockedVersion = await versionStore.insertVersion(tenantId, {
    artifactId: ARTIFACT_ID,
    provenance: {
      artifactHash: artifactSha256,
      lockedBy: `tenant:${tenantId}`,
      reason:
        "Initial WORM lock of the compliance policy artifact (P2 reference leg).",
    },
  });

  // The chain payload is FIXED (no surrogate ids/clocks) → a deterministic, byte-stable anchor.
  const append = await chainStore.append(tenantId, {
    kind: "artifact.locked",
    artifactId: ARTIFACT_ID,
    artifactHash: artifactSha256,
  });
  const chainVerification = await chainStore.verify(tenantId);
  const chainEntries = await chainStore.load(tenantId);
  const anchor = append.anchor;
  const chainAnchor: EvidencePackChainAnchor =
    anchor.genesisHash === undefined
      ? { length: anchor.length, tipHash: anchor.tipHash }
      : {
          length: anchor.length,
          tipHash: anchor.tipHash,
          genesisHash: anchor.genesisHash,
        };

  // 3 — GATHER real substrate facts → generate + validate + sign + emit the evidence pack.
  const framework: EvidencePackFramework = {
    id: soc2Tsc.id,
    title: soc2Tsc.title,
    version: soc2Tsc.version,
  };

  const chainResult = chainVerifyCollector().collect({
    entries: chainEntries,
    anchor,
  });
  const wormResult = wormRetentionCollector().collect({
    key: artifactKey,
    retainUntil: head?.retainUntil ?? null,
    requiredUntil,
  });
  const rlsResult = rlsForceCollector().collect({
    tables: await readRlsPosture(harness, TENANT_TABLES),
  });

  const controls = [
    controlPlan(soc2Tsc, "AUDIT.IMMUTABLE-LOG", [chainResult]),
    controlPlan(soc2Tsc, "DATA-PROTECTION.DISPOSAL", [wormResult]),
    controlPlan(soc2Tsc, "ACCESS-CONTROL.LOGICAL", [rlsResult]),
  ];
  const generateInput: GenerateEvidencePackInput = {
    tenantId,
    framework,
    chainAnchor,
    controls,
    now,
  };

  const pack = generateEvidencePack(generateInput);
  const repeat = generateEvidencePack(generateInput);
  const deterministic =
    pack.sha256 === repeat.sha256 &&
    pack.canonicalManifest === repeat.canonicalManifest;

  let validatedAgainstFormat = false;
  try {
    parseEvidencePackManifest(JSON.parse(pack.canonicalManifest));
    validatedAgainstFormat = true;
  } catch {
    validatedAgainstFormat = false;
  }

  // Per-tenant Ed25519 signing (distinct from any license key) over canonical body ∥ anchor tip.
  const signerSeed = createHash("sha256")
    .update(`${tenantId}|evidence-signing`)
    .digest();
  const signer = new Ed25519Signer(
    `tenant:${tenantId}:evidence`,
    new Uint8Array(signerSeed),
  );
  const signature = await signEvidencePack(signer, pack.manifest);
  const signatureValid = await verifyEvidenceSignature(
    pack.manifest,
    signature,
  );

  await emitEvidenceGenerated(sink, {
    tenantId,
    framework: pack.manifest.framework.id,
    sha256: pack.sha256,
    controlCount: pack.manifest.summary.totalControls,
    flaggedCount: pack.manifest.summary.controlsWithGaps,
    generatedAt: pack.generatedAt,
  });

  // OSCAL EXPORT (T15 seam, MAP not PUSH): map the already-generated, already-validated SOC2 pack
  // into an OSCAL v1.1.3 SAR+POA&M bundle. A fixed counter `newId` keeps the bundle byte-stable
  // alongside the injected `now`. The live transport (`OscalExportTransport.deliver`) is out of
  // scope (P7) — this call never reaches a network.
  const oscal: OscalExportBundle = toOscalBundle(pack.manifest, {
    now,
    newId: counterIds(),
    packSha256: pack.sha256,
  });

  // HIPAA-SECURITY LEG: the SAME 3 collector results (chain / WORM / RLS) cited against HIPAA's own
  // control ids (ADR-0057) — the substrate facts don't care which framework cites them.
  const hipaaFramework: EvidencePackFramework = {
    id: hipaaSecurity.id,
    title: hipaaSecurity.title,
    version: hipaaSecurity.version,
  };
  const hipaaControls = [
    controlPlan(hipaaSecurity, "AUDIT.CONTROLS", [chainResult]),
    controlPlan(hipaaSecurity, "GOVERNANCE.DOCUMENTATION", [wormResult]),
    controlPlan(hipaaSecurity, "ACCESS-CONTROL.WORKFORCE", [rlsResult]),
  ];
  const hipaaGenerateInput: GenerateEvidencePackInput = {
    tenantId,
    framework: hipaaFramework,
    chainAnchor,
    controls: hipaaControls,
    now,
  };

  const hipaaPack = generateEvidencePack(hipaaGenerateInput);
  const hipaaRepeat = generateEvidencePack(hipaaGenerateInput);
  const hipaaDeterministic =
    hipaaPack.sha256 === hipaaRepeat.sha256 &&
    hipaaPack.canonicalManifest === hipaaRepeat.canonicalManifest;

  let hipaaValidatedAgainstFormat = false;
  try {
    parseEvidencePackManifest(JSON.parse(hipaaPack.canonicalManifest));
    hipaaValidatedAgainstFormat = true;
  } catch {
    hipaaValidatedAgainstFormat = false;
  }

  // Same per-tenant signer as the SOC2 pack — one Ed25519 identity signs every framework's pack
  // for a given tenant.
  const hipaaSignature = await signEvidencePack(signer, hipaaPack.manifest);
  const hipaaSignatureValid = await verifyEvidenceSignature(
    hipaaPack.manifest,
    hipaaSignature,
  );

  await emitEvidenceGenerated(sink, {
    tenantId,
    framework: hipaaPack.manifest.framework.id,
    sha256: hipaaPack.sha256,
    controlCount: hipaaPack.manifest.summary.totalControls,
    flaggedCount: hipaaPack.manifest.summary.controlsWithGaps,
    generatedAt: hipaaPack.generatedAt,
  });

  // 4 — BLOCK: one UNRESOLVED control refuses the whole pack (flag-never-guess, no partial pack).
  const blockedControls = [
    ...controls,
    controlPlan(soc2Tsc, "AVAILABILITY.BACKUP-RECOVERY", [
      wormRetentionCollector().collect({
        key: `${tenantId}/backups/2026-06`,
        retainUntil: null,
        requiredUntil,
      }),
    ]),
  ];
  let blocked = false;
  let unresolvedCount = 0;
  let noPartialPack = true;
  try {
    generateEvidencePack({ ...generateInput, controls: blockedControls });
    noPartialPack = false; // unreachable on a correct generator
  } catch (err) {
    if (err instanceof EvidencePackBlockedError) {
      blocked = true;
      unresolvedCount = err.report.unresolved.length;
    } else {
      throw err;
    }
  }

  const encryptedField: EncryptedFieldCheck = {
    columnContext: PHI_COLUMN,
    storedIsEnvelope,
    keyVersion,
    roundTrips,
    crossRowRelocateRejected,
  };
  const meetsRetentionFloor =
    head?.retainUntil !== undefined &&
    head.retainUntil.getTime() >= requiredUntil.getTime();
  const wormLock: WormLockCheck = {
    artifactKey,
    artifactSha256,
    retainUntil: (head?.retainUntil ?? retainUntil).toISOString(),
    requiredUntil: requiredUntil.toISOString(),
    meetsRetentionFloor,
    lockedVersionId: lockedVersion.id,
    chainAnchor,
    chainVerified: chainVerification.valid,
  };
  const evidence: EvidenceCheck = {
    framework: pack.manifest.framework.id,
    sha256: pack.sha256,
    deterministic,
    validatedAgainstFormat,
    controlCount: pack.manifest.summary.totalControls,
    controlsReady: pack.manifest.summary.controlsReady,
    controlsWithGaps: pack.manifest.summary.controlsWithGaps,
    totalEvidenceItems: pack.manifest.summary.totalEvidenceItems,
    posture: pack.manifest.summary.posture,
    signatureValid,
    generatedAt: pack.generatedAt,
  };
  const hipaaEvidence: EvidenceCheck = {
    framework: hipaaPack.manifest.framework.id,
    sha256: hipaaPack.sha256,
    deterministic: hipaaDeterministic,
    validatedAgainstFormat: hipaaValidatedAgainstFormat,
    controlCount: hipaaPack.manifest.summary.totalControls,
    controlsReady: hipaaPack.manifest.summary.controlsReady,
    controlsWithGaps: hipaaPack.manifest.summary.controlsWithGaps,
    totalEvidenceItems: hipaaPack.manifest.summary.totalEvidenceItems,
    posture: hipaaPack.manifest.summary.posture,
    signatureValid: hipaaSignatureValid,
    generatedAt: hipaaPack.generatedAt,
  };
  const emittedEvents = sink.events.map((e) => e.name);

  const allChecksPassed =
    encryptedField.storedIsEnvelope &&
    encryptedField.roundTrips &&
    encryptedField.crossRowRelocateRejected &&
    wormLock.chainVerified &&
    wormLock.meetsRetentionFloor &&
    wormLock.lockedVersionId.length > 0 &&
    evidence.deterministic &&
    evidence.validatedAgainstFormat &&
    evidence.signatureValid &&
    evidence.controlsWithGaps === 0 &&
    hipaaEvidence.deterministic &&
    hipaaEvidence.validatedAgainstFormat &&
    hipaaEvidence.signatureValid &&
    hipaaEvidence.controlsWithGaps === 0 &&
    blocked &&
    noPartialPack &&
    emittedEvents.includes("evidence.generated");

  return {
    tenantId,
    encryptedField,
    wormLock,
    evidence,
    hipaaEvidence,
    blocked: { blocked, unresolvedCount, noPartialPack },
    emittedEvents,
    manifest: pack.manifest,
    hipaaManifest: hipaaPack.manifest,
    oscal,
    allChecksPassed,
  };
}
