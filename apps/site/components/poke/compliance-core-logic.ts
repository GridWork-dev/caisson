// Pure, deterministic mirror of @caisson/compliance-core's evidence engine (ADR-0378 lock 2): the
// six named collectors under packages/compliance-core/src/evidence/collectors/ (rls-force,
// chain-verify, worm-retention, field-crypto-policy, ai-risk-register, impersonation) plus
// generateEvidencePack's two load-bearing phases from packages/compliance-core/src/evidence/generate.ts
// (flag-never-guess blocking, then readiness/summary/posture derivation).
//
// WHY MIRRORED, NOT IMPORTED: @caisson/compliance-core's package.json `exports` map has only "."
// (packages/compliance-core/package.json), which resolves to src/index.ts - a barrel that re-exports
// generate.ts (`node:zlib` deflateRawSync + `node:crypto` createHash) in the SAME module graph as the
// six collectors, so importing even one collector taints the whole browser bundle. No subpath exists
// to reach a collector alone (the exact ai-meter-logic.ts precedent). apps/site does not even list
// @caisson/compliance-core as a dependency (it lists @caisson/kernel and @caisson/field-crypto,
// which the six collectors themselves depend on) - editing package.json is out of this poke's file
// ownership, which settles the question independent of browser-safety analysis.
//
// TWO EXCEPTIONS run the REAL primitive, not a mirror:
//   - `hashChainLinkAsync` is imported DIRECTLY from the browser-safe `@caisson/kernel/audit-verify`
//     subpath (packages/kernel/src/audit-verify.ts) - the SHA-256-over-canonical-bytes WebCrypto twin
//     of the kernel's sync `hashChainLink`, the same primitive packages/audit-worm/src/ui/use-row-verify.ts
//     already composes for its own client-side chain proof. `@caisson/kernel` IS a site dependency, and
//     this subpath imports nothing but the node-free canonical.ts, so it is genuinely real, not mirrored.
//   - field-crypto's envelope FORMAT (not its crypto) is a pure byte-layout check (format-version byte,
//     alg-id byte, min length) - no AEAD operation runs, so no crypto import is needed either way; it is
//     ported by hand below because @caisson/field-crypto's package.json also exports only "." (its
//     barrel pulls `node:crypto`/`node:async_hooks` via cipher.ts/derive.ts/column.ts), and is
//     byte-parity-pinned against the real `serializeEnvelope`/`parseEnvelope` in the test file.
//
// No Date.now(), no Math.random(), no argless `new Date()`: every sample fact below is a fixed,
// labeled-sample constant: the same board state always evaluates to the same six statuses.
import { hashChainLinkAsync } from "@caisson/kernel/audit-verify";

// --- Shared shapes (mirrors packages/compliance-core/src/evidence/collector.ts) -----------------

/** Mirrors EvidenceStatus, collector.ts. */
export type EvidenceStatus = "pass" | "flagged" | "unresolved";

/** Mirrors kernel's JsonValue shape (canonical.ts) - the only thing a collector's `facts` may hold. */
export type FactValue =
  | string
  | number
  | boolean
  | null
  | readonly FactValue[]
  | { readonly [key: string]: FactValue };

/** Mirrors EvidenceItem, collector.ts (manualSlots omitted - this poke does not model manual attachment
 *  slots, a simplification noted in the PLAN). */
export interface EvidenceItemLike {
  readonly collectorId: string;
  readonly controlId: string;
  readonly title: string;
  readonly summary: string;
  readonly facts: Readonly<Record<string, FactValue>>;
}

/** Mirrors CollectorResult, collector.ts. */
export interface CollectorResultLike {
  readonly item: EvidenceItemLike;
  readonly status: EvidenceStatus;
  readonly reason?: string;
}

/** Mirrors passResult(), collector.ts. */
function passResultMirror(item: EvidenceItemLike): CollectorResultLike {
  return { item, status: "pass" };
}

/** Mirrors flaggedResult(), collector.ts - the reason is mandatory (flag-never-guess). */
function flaggedResultMirror(
  item: EvidenceItemLike,
  reason: string,
): CollectorResultLike {
  if (reason.trim().length === 0) {
    throw new Error("a flagged evidence item requires a recorded reason");
  }
  return { item, status: "flagged", reason };
}

/** Mirrors unresolvedResult(), collector.ts - the reason is mandatory (flag-never-guess). */
function unresolvedResultMirror(
  item: EvidenceItemLike,
  reason: string,
): CollectorResultLike {
  if (reason.trim().length === 0) {
    throw new Error("an unresolved evidence item requires a recorded reason");
  }
  return { item, status: "unresolved", reason };
}

/** Locale-independent lexicographic comparator (mirrors generate.ts / crosswalk-rollup.ts). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type PresetKind = "pass" | "flagged" | "unresolved";

// --- Collector 1: substrate.tenant-isolation-force-rls (rls-force.ts) ---------------------------

const RLS_FORCE_COLLECTOR_ID = "substrate.tenant-isolation-force-rls";
const RLS_FORCE_CONTROL_ID = "ACCESS-CONTROL.LOGICAL";
const RLS_FORCE_TITLE = "Tenant isolation enforced by FORCE row-level security";

export interface RlsTableFactLike {
  readonly table: string;
  readonly rowSecurityEnabled: boolean;
  readonly rowSecurityForced: boolean;
  readonly tenantPolicyPresent: boolean;
}
export interface RlsForceFactLike {
  readonly tables: readonly RlsTableFactLike[];
}

function isForcedMirror(t: RlsTableFactLike): boolean {
  return t.rowSecurityEnabled && t.rowSecurityForced && t.tenantPolicyPresent;
}

/** Mirrors rlsForceCollector().collect(). */
export function rlsForceCollectMirror(
  fact: RlsForceFactLike,
): CollectorResultLike {
  const tableCount = fact.tables.length;
  if (tableCount === 0) {
    return unresolvedResultMirror(
      {
        collectorId: RLS_FORCE_COLLECTOR_ID,
        controlId: RLS_FORCE_CONTROL_ID,
        title: RLS_FORCE_TITLE,
        summary: "no tenant-scoped tables were inspected for RLS posture",
        facts: { tableCount: 0, forcedCount: 0, deficientTables: [] },
      },
      "no RLS posture was gathered; tenant isolation cannot be attested",
    );
  }
  const deficientTables = fact.tables
    .filter((t) => !isForcedMirror(t))
    .map((t) => t.table);
  const forcedCount = tableCount - deficientTables.length;
  const facts = { tableCount, forcedCount, deficientTables };
  if (deficientTables.length === 0) {
    return passResultMirror({
      collectorId: RLS_FORCE_COLLECTOR_ID,
      controlId: RLS_FORCE_CONTROL_ID,
      title: RLS_FORCE_TITLE,
      summary: `all ${String(tableCount)} tenant tables enforce FORCE row-level security`,
      facts,
    });
  }
  return flaggedResultMirror(
    {
      collectorId: RLS_FORCE_COLLECTOR_ID,
      controlId: RLS_FORCE_CONTROL_ID,
      title: RLS_FORCE_TITLE,
      summary: `${String(deficientTables.length)} of ${String(tableCount)} tenant tables do not enforce FORCE RLS`,
      facts,
    },
    `tables missing enabled+forced RLS or a tenant policy: ${deficientTables.join(", ")}`,
  );
}

export const RLS_FORCE_PRESETS: Readonly<Record<PresetKind, RlsForceFactLike>> =
  {
    unresolved: { tables: [] },
    flagged: {
      tables: [
        {
          table: "legacy_export",
          rowSecurityEnabled: true,
          rowSecurityForced: false,
          tenantPolicyPresent: true,
        },
        {
          table: "invoices",
          rowSecurityEnabled: true,
          rowSecurityForced: true,
          tenantPolicyPresent: true,
        },
      ],
    },
    pass: {
      tables: [
        {
          table: "invoices",
          rowSecurityEnabled: true,
          rowSecurityForced: true,
          tenantPolicyPresent: true,
        },
        {
          table: "accounts",
          rowSecurityEnabled: true,
          rowSecurityForced: true,
          tenantPolicyPresent: true,
        },
      ],
    },
  };

// --- Collector 2: substrate.audit-chain-integrity (chain-verify.ts) -----------------------------

const CHAIN_VERIFY_COLLECTOR_ID = "substrate.audit-chain-integrity";
const CHAIN_VERIFY_CONTROL_ID = "AUDIT.IMMUTABLE-LOG";
const CHAIN_VERIFY_TITLE = "Append-only audit chain integrity (WORM-anchored)";

export interface ChainEntryLike {
  readonly seq: number;
  readonly prevHash: string | null;
  readonly payload: FactValue;
  readonly hash: string;
}
export interface ChainAnchorLike {
  readonly length: number;
  readonly tipHash: string;
  readonly genesisHash?: string;
}
export interface ChainVerifyFactLike {
  readonly entries: readonly ChainEntryLike[];
  readonly anchor: ChainAnchorLike | null;
}
interface ChainVerificationLike {
  readonly valid: boolean;
  readonly brokenAt: number | null;
}

/** The poke's fixed 3-payload sample chain, labeled sample - never real audit data. */
export const SAMPLE_CHAIN_PAYLOADS: readonly FactValue[] = [
  { event: "tenant.onboarded", actor: "system" },
  { event: "policy.locked", actor: "op-jamie" },
  { event: "evidence.exported", actor: "op-jamie" },
];

let sampleChainPromise: Promise<readonly ChainEntryLike[]> | null = null;

/** Builds the fixed sample chain with the REAL hashChainLinkAsync (WebCrypto SHA-256) - memoized,
 *  since the payloads are fixed the chain only needs to be built once per page load. */
export function buildSampleChain(): Promise<readonly ChainEntryLike[]> {
  sampleChainPromise ??= (async () => {
    const entries: ChainEntryLike[] = [];
    let prevHash: string | null = null;
    for (let i = 0; i < SAMPLE_CHAIN_PAYLOADS.length; i++) {
      const payload = SAMPLE_CHAIN_PAYLOADS[i] as FactValue;
      const hash = await hashChainLinkAsync(prevHash, payload);
      entries.push({ seq: i, prevHash, payload, hash });
      prevHash = hash;
    }
    return entries;
  })();
  return sampleChainPromise;
}

/** Mirrors verifyChain()'s control flow (packages/kernel/src/canonical.ts types +
 *  packages/kernel/src/audit-chain.ts logic), recomputing each link with the REAL hashChainLinkAsync. */
async function verifyChainAsyncMirror(
  entries: readonly ChainEntryLike[],
  anchor: ChainAnchorLike,
): Promise<ChainVerificationLike> {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as ChainEntryLike;
    const expectedPrev =
      i === 0 ? null : (entries[i - 1] as ChainEntryLike).hash;
    if (entry.seq !== i) return { valid: false, brokenAt: i };
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    const recomputed = await hashChainLinkAsync(entry.prevHash, entry.payload);
    if (entry.hash !== recomputed) return { valid: false, brokenAt: i };
  }
  if (anchor.genesisHash !== undefined) {
    if (
      entries.length === 0 ||
      (entries[0] as ChainEntryLike).hash !== anchor.genesisHash
    ) {
      return { valid: false, brokenAt: 0 };
    }
  }
  if (entries.length !== anchor.length) {
    return { valid: false, brokenAt: Math.min(entries.length, anchor.length) };
  }
  const tip = entries[entries.length - 1] as ChainEntryLike;
  if (tip.hash !== anchor.tipHash) {
    return { valid: false, brokenAt: entries.length - 1 };
  }
  return { valid: true, brokenAt: null };
}

/** Mirrors chainVerifyCollector().collect() - async because the real hash recompute is WebCrypto. */
export async function chainVerifyCollectMirror(
  fact: ChainVerifyFactLike,
): Promise<CollectorResultLike> {
  const entryCount = fact.entries.length;
  if (fact.anchor === null) {
    return unresolvedResultMirror(
      {
        collectorId: CHAIN_VERIFY_COLLECTOR_ID,
        controlId: CHAIN_VERIFY_CONTROL_ID,
        title: CHAIN_VERIFY_TITLE,
        summary: "no trusted WORM anchor was supplied for the audit chain",
        facts: { entryCount, anchorPresent: false },
      },
      "audit chain has no trusted anchor; integrity cannot be attested",
    );
  }
  const verification = await verifyChainAsyncMirror(fact.entries, fact.anchor);
  const facts = {
    entryCount,
    anchorPresent: true,
    anchorLength: fact.anchor.length,
    valid: verification.valid,
    brokenAt: verification.brokenAt,
  };
  if (verification.valid) {
    return passResultMirror({
      collectorId: CHAIN_VERIFY_COLLECTOR_ID,
      controlId: CHAIN_VERIFY_CONTROL_ID,
      title: CHAIN_VERIFY_TITLE,
      summary: `audit chain verified against its anchor (${String(entryCount)} entries)`,
      facts,
    });
  }
  return flaggedResultMirror(
    {
      collectorId: CHAIN_VERIFY_COLLECTOR_ID,
      controlId: CHAIN_VERIFY_CONTROL_ID,
      title: CHAIN_VERIFY_TITLE,
      summary: "audit chain failed verification against its trusted anchor",
      facts,
    },
    `chain verification failed at index ${String(verification.brokenAt)}`,
  );
}

/** Sample-chain anchor presets. `flagged` deliberately pins a wrong tip (a stale/forged anchor); the
 *  entries themselves are always the real, internally-consistent sample chain. */
export async function chainVerifyPreset(
  kind: PresetKind,
): Promise<ChainVerifyFactLike> {
  const entries = await buildSampleChain();
  if (kind === "unresolved") return { entries, anchor: null };
  if (kind === "flagged") {
    return {
      entries,
      anchor: { length: entries.length, tipHash: "f".repeat(64) },
    };
  }
  const genesis = entries[0] as ChainEntryLike;
  const tip = entries[entries.length - 1] as ChainEntryLike;
  return {
    entries,
    anchor: {
      length: entries.length,
      tipHash: tip.hash,
      genesisHash: genesis.hash,
    },
  };
}

// --- Collector 3: substrate.worm-retention-floor (worm-retention.ts) ----------------------------

const WORM_RETENTION_COLLECTOR_ID = "substrate.worm-retention-floor";
const WORM_RETENTION_CONTROL_ID = "DATA-PROTECTION.DISPOSAL";
const WORM_RETENTION_TITLE = "WORM retention meets the legal floor";

export interface WormRetentionFactLike {
  readonly key: string;
  readonly retainUntil: Date | null;
  readonly requiredUntil: Date;
}

/** Mirrors wormRetentionCollector().collect(). */
export function wormRetentionCollectMirror(
  fact: WormRetentionFactLike,
): CollectorResultLike {
  const requiredIso = fact.requiredUntil.toISOString();
  if (fact.retainUntil === null) {
    return unresolvedResultMirror(
      {
        collectorId: WORM_RETENTION_COLLECTOR_ID,
        controlId: WORM_RETENTION_CONTROL_ID,
        title: WORM_RETENTION_TITLE,
        summary: "no WORM retention term was found for the artifact",
        facts: { key: fact.key, retainUntil: null, requiredUntil: requiredIso },
      },
      `no retain_until on ${fact.key}; WORM retention cannot be attested`,
    );
  }
  const retainIso = fact.retainUntil.toISOString();
  const facts = {
    key: fact.key,
    retainUntil: retainIso,
    requiredUntil: requiredIso,
  };
  if (fact.retainUntil.getTime() >= fact.requiredUntil.getTime()) {
    return passResultMirror({
      collectorId: WORM_RETENTION_COLLECTOR_ID,
      controlId: WORM_RETENTION_CONTROL_ID,
      title: WORM_RETENTION_TITLE,
      summary: `WORM retention until ${retainIso} meets the floor (${requiredIso})`,
      facts,
    });
  }
  return flaggedResultMirror(
    {
      collectorId: WORM_RETENTION_COLLECTOR_ID,
      controlId: WORM_RETENTION_CONTROL_ID,
      title: WORM_RETENTION_TITLE,
      summary: `WORM retention until ${retainIso} is short of the floor (${requiredIso})`,
      facts,
    },
    `retain_until ${retainIso} is earlier than the required floor ${requiredIso} for ${fact.key}`,
  );
}

const SAMPLE_WORM_KEY = "tenant-poke-demo/exports/2026-06";
const SAMPLE_REQUIRED_UNTIL = new Date("2031-06-27T00:00:00.000Z");

export const WORM_RETENTION_PRESETS: Readonly<
  Record<PresetKind, WormRetentionFactLike>
> = {
  unresolved: {
    key: SAMPLE_WORM_KEY,
    retainUntil: null,
    requiredUntil: SAMPLE_REQUIRED_UNTIL,
  },
  flagged: {
    key: SAMPLE_WORM_KEY,
    retainUntil: new Date("2030-01-01T00:00:00.000Z"),
    requiredUntil: SAMPLE_REQUIRED_UNTIL,
  },
  // Same retainUntil/requiredUntil pair as packages/compliance-core/src/__golden__/evidence-pack.manifest.json.
  pass: {
    key: SAMPLE_WORM_KEY,
    retainUntil: new Date("2032-06-27T00:00:00.000Z"),
    requiredUntil: SAMPLE_REQUIRED_UNTIL,
  },
};

// --- Collector 4: substrate.field-crypto-policy (field-crypto-policy.ts) ------------------------

const FIELD_CRYPTO_POLICY_COLLECTOR_ID = "substrate.field-crypto-policy";
const FIELD_CRYPTO_POLICY_CONTROL_ID = "DATA-PROTECTION.PHI-ENCRYPTION";
const FIELD_CRYPTO_POLICY_TITLE =
  "PHI fields encrypted at rest (per-tenant field-crypto)";

// Mirrors the envelope header layout, packages/field-crypto/src/envelope.ts: format-version(1) +
// alg-id(1) + key_version(2) + nonce(12) + ciphertext + tag(16). No decryption ever runs - only the
// header bytes are inspected, so no crypto import (WebCrypto or otherwise) is needed for this mirror.
const FIELD_CRYPTO_FORMAT_VERSION = 0x01;
const FIELD_CRYPTO_ALG_AES_256_GCM = 0x01;
const FIELD_CRYPTO_NONCE_BYTES = 12;
const FIELD_CRYPTO_TAG_BYTES = 16;
const FIELD_CRYPTO_HEADER_BYTES = 4;
const FIELD_CRYPTO_MIN_ENVELOPE_BYTES =
  FIELD_CRYPTO_HEADER_BYTES + FIELD_CRYPTO_NONCE_BYTES + FIELD_CRYPTO_TAG_BYTES;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Builds one well-formed sample envelope (fixed bytes - not a real key, not real ciphertext). */
function buildSampleEnvelopeBase64(): string {
  const header = new Uint8Array([
    FIELD_CRYPTO_FORMAT_VERSION,
    FIELD_CRYPTO_ALG_AES_256_GCM,
    0x00,
    0x01,
  ]);
  const nonce = new Uint8Array(FIELD_CRYPTO_NONCE_BYTES).fill(0x11);
  const ciphertext = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  const tag = new Uint8Array(FIELD_CRYPTO_TAG_BYTES).fill(0x22);
  const all = new Uint8Array(
    header.length + nonce.length + ciphertext.length + tag.length,
  );
  all.set(header, 0);
  all.set(nonce, header.length);
  all.set(ciphertext, header.length + nonce.length);
  all.set(tag, header.length + nonce.length + ciphertext.length);
  return bytesToBase64(all);
}

/** A fixed, labeled-sample AES-256-GCM field-crypto envelope - byte-parity-pinned against the real
 *  serializeEnvelope() in compliance-core-logic.test.ts. */
export const SAMPLE_ENCRYPTED_ENVELOPE = buildSampleEnvelopeBase64();

/** Mirrors the format check inside fieldCryptoPolicyCollector's isEncryptedAtRest(). */
function isEncryptedAtRestMirror(storedValue: string): boolean {
  try {
    const bytes = base64ToBytes(storedValue);
    if (bytes.length < FIELD_CRYPTO_MIN_ENVELOPE_BYTES) return false;
    if (bytes[0] !== FIELD_CRYPTO_FORMAT_VERSION) return false;
    return bytes[1] === FIELD_CRYPTO_ALG_AES_256_GCM;
  } catch {
    return false;
  }
}

export interface PhiFieldFactLike {
  readonly field: string;
  readonly storedValue: string | null;
}
export interface FieldCryptoPolicyFactLike {
  readonly fields: readonly PhiFieldFactLike[];
}

/** Mirrors fieldCryptoPolicyCollector().collect(). */
export function fieldCryptoPolicyCollectMirror(
  fact: FieldCryptoPolicyFactLike,
): CollectorResultLike {
  const fieldCount = fact.fields.length;
  if (fieldCount === 0) {
    return unresolvedResultMirror(
      {
        collectorId: FIELD_CRYPTO_POLICY_COLLECTOR_ID,
        controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
        title: FIELD_CRYPTO_POLICY_TITLE,
        summary: "no PHI-bearing fields were inspected for at-rest encryption",
        facts: {
          fieldCount: 0,
          encryptedCount: 0,
          plaintextFields: [],
          unsampledFields: [],
        },
      },
      "no PHI encryption posture was gathered; at-rest encryption cannot be attested",
    );
  }
  const plaintextFieldsRaw: string[] = [];
  const unsampledFieldsRaw: string[] = [];
  for (const f of fact.fields) {
    if (f.storedValue === null) unsampledFieldsRaw.push(f.field);
    else if (!isEncryptedAtRestMirror(f.storedValue))
      plaintextFieldsRaw.push(f.field);
  }
  const plaintextFields = [...plaintextFieldsRaw].sort(cmp);
  const unsampledFields = [...unsampledFieldsRaw].sort(cmp);
  const encryptedCount =
    fieldCount - plaintextFields.length - unsampledFields.length;
  const facts = {
    fieldCount,
    encryptedCount,
    plaintextFields,
    unsampledFields,
  };

  if (plaintextFields.length > 0) {
    return flaggedResultMirror(
      {
        collectorId: FIELD_CRYPTO_POLICY_COLLECTOR_ID,
        controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
        title: FIELD_CRYPTO_POLICY_TITLE,
        summary: `${String(plaintextFields.length)} of ${String(fieldCount)} PHI fields are not encrypted at rest`,
        facts,
      },
      `PHI fields not encrypted with an AES-256-GCM field-crypto envelope: ${plaintextFields.join(", ")}`,
    );
  }
  if (unsampledFields.length > 0) {
    return unresolvedResultMirror(
      {
        collectorId: FIELD_CRYPTO_POLICY_COLLECTOR_ID,
        controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
        title: FIELD_CRYPTO_POLICY_TITLE,
        summary: `${String(unsampledFields.length)} of ${String(fieldCount)} PHI fields had no stored value to inspect`,
        facts,
      },
      `no at-rest sample for PHI fields: ${unsampledFields.join(", ")}; encryption cannot be attested`,
    );
  }
  return passResultMirror({
    collectorId: FIELD_CRYPTO_POLICY_COLLECTOR_ID,
    controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
    title: FIELD_CRYPTO_POLICY_TITLE,
    summary: `all ${String(fieldCount)} PHI fields are encrypted at rest (AES-256-GCM field-crypto envelope)`,
    facts,
  });
}

const PHI_FIELDS = [
  "patient.diagnosis_notes",
  "patient.insurance_id",
  "patient.ssn",
] as const;

export const FIELD_CRYPTO_POLICY_PRESETS: Readonly<
  Record<PresetKind, FieldCryptoPolicyFactLike>
> = {
  unresolved: {
    fields: [
      { field: PHI_FIELDS[0], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
      { field: PHI_FIELDS[1], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
      { field: PHI_FIELDS[2], storedValue: null },
    ],
  },
  flagged: {
    fields: [
      { field: PHI_FIELDS[0], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
      { field: PHI_FIELDS[1], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
      { field: PHI_FIELDS[2], storedValue: "555-12-3456" },
    ],
  },
  pass: {
    fields: PHI_FIELDS.map((field) => ({
      field,
      storedValue: SAMPLE_ENCRYPTED_ENVELOPE,
    })),
  },
};

// --- Collector 5: substrate.ai-risk-register (ai-risk-register.ts) ------------------------------

const AI_RISK_REGISTER_COLLECTOR_ID = "substrate.ai-risk-register";
const AI_RISK_REGISTER_CONTROL_ID = "RISK-MANAGEMENT.AI-LIFECYCLE";
const AI_RISK_REGISTER_TITLE =
  "AI risk register assessed with treatment plans on record (EU AI Act Art. 9)";

export interface AiRiskEntryFactLike {
  readonly riskId: string;
  readonly treatmentPlan: string | null;
}
export interface AiRiskRegisterFactLike {
  readonly entries: readonly AiRiskEntryFactLike[];
}

function isManagedMirror(e: AiRiskEntryFactLike): boolean {
  return e.treatmentPlan !== null;
}

/** Mirrors aiRiskRegisterCollector().collect(). */
export function aiRiskRegisterCollectMirror(
  fact: AiRiskRegisterFactLike,
): CollectorResultLike {
  const entryCount = fact.entries.length;
  if (entryCount === 0) {
    return unresolvedResultMirror(
      {
        collectorId: AI_RISK_REGISTER_COLLECTOR_ID,
        controlId: AI_RISK_REGISTER_CONTROL_ID,
        title: AI_RISK_REGISTER_TITLE,
        summary:
          "the AI risk register is empty; no risk-management system was traversed",
        facts: { entryCount: 0, managedCount: 0, deficientRisks: [] },
      },
      "no AI risk-register entries; a risk-management system cannot be attested",
    );
  }
  const deficientRisks = fact.entries
    .filter((e) => !isManagedMirror(e))
    .map((e) => e.riskId)
    .sort(cmp);
  const managedCount = entryCount - deficientRisks.length;
  const facts = { entryCount, managedCount, deficientRisks };
  if (deficientRisks.length === 0) {
    return passResultMirror({
      collectorId: AI_RISK_REGISTER_COLLECTOR_ID,
      controlId: AI_RISK_REGISTER_CONTROL_ID,
      title: AI_RISK_REGISTER_TITLE,
      summary: `all ${String(entryCount)} AI risks are assessed with a treatment plan on record`,
      facts,
    });
  }
  return flaggedResultMirror(
    {
      collectorId: AI_RISK_REGISTER_COLLECTOR_ID,
      controlId: AI_RISK_REGISTER_CONTROL_ID,
      title: AI_RISK_REGISTER_TITLE,
      summary: `${String(deficientRisks.length)} of ${String(entryCount)} AI risks have no treatment plan on record`,
      facts,
    },
    `AI risks with no treatment plan on record: ${deficientRisks.join(", ")}`,
  );
}

export const AI_RISK_REGISTER_PRESETS: Readonly<
  Record<PresetKind, AiRiskRegisterFactLike>
> = {
  unresolved: { entries: [] },
  flagged: {
    entries: [
      {
        riskId: "R-support-bot-hallucination",
        treatmentPlan: "Rate-limited with a human-review fallback.",
      },
      { riskId: "R-pricing-model-drift", treatmentPlan: null },
    ],
  },
  pass: {
    entries: [
      {
        riskId: "R-support-bot-hallucination",
        treatmentPlan: "Rate-limited with a human-review fallback.",
      },
      {
        riskId: "R-pricing-model-drift",
        treatmentPlan: "Weekly drift report reviewed by the pricing owner.",
      },
    ],
  },
};

// --- Collector 6: substrate.impersonation-dual-trail (impersonation.ts) -------------------------

const IMPERSONATION_COLLECTOR_ID = "substrate.impersonation-dual-trail";
const IMPERSONATION_CONTROL_ID = "ACCESS-CONTROL.LOGICAL";
const IMPERSONATION_TITLE =
  "Support impersonation carries a chain-verified dual audit trail";

export interface ImpersonationSessionFactLike {
  readonly id: string;
  readonly operatorId: string;
  readonly reason: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly endedAt: string | null;
  readonly operatorRecordSeq: number | null;
  readonly tenantRecordSeq: number | null;
  readonly endOperatorRecordSeq: number | null;
  readonly endTenantRecordSeq: number | null;
  readonly operatorRecordCount: number;
  readonly tenantRecordCount: number;
}
export interface ImpersonationDualTrailFactLike {
  readonly sessions: readonly ImpersonationSessionFactLike[];
  readonly chainValid: boolean | null;
}

/** Mirrors sessionDeficiencies(), impersonation.ts. */
function sessionDeficienciesMirror(s: ImpersonationSessionFactLike): string[] {
  const problems: string[] = [];
  if (s.operatorRecordSeq === null) {
    problems.push(
      `session ${s.id}: operator-identity record missing from the audit chain`,
    );
  }
  if (s.tenantRecordSeq === null) {
    problems.push(
      `session ${s.id}: acting-as-tenant record missing from the audit chain`,
    );
  }
  if (s.endedAt !== null && s.endOperatorRecordSeq === null) {
    problems.push(
      `session ${s.id}: ended but the operator-identity session.end record is missing from the audit chain`,
    );
  }
  if (s.endedAt !== null && s.endTenantRecordSeq === null) {
    problems.push(
      `session ${s.id}: ended but the acting-as-tenant session.end record is missing from the audit chain`,
    );
  }
  if (s.operatorRecordCount !== s.tenantRecordCount) {
    problems.push(
      `session ${s.id}: dual-trail asymmetry, ${String(s.operatorRecordCount)} operator-identity vs ${String(s.tenantRecordCount)} acting-as-tenant record(s) (a torn dual append)`,
    );
  }
  if (s.reason.trim().length === 0) {
    problems.push(`session ${s.id}: no recorded justification`);
  }
  if (!(new Date(s.expiresAt).getTime() > new Date(s.startedAt).getTime())) {
    problems.push(
      `session ${s.id}: expiry ${s.expiresAt} is not after start ${s.startedAt} (unbounded or invalid lifetime)`,
    );
  }
  return problems;
}

function sessionsAsFactValue(
  sessions: readonly ImpersonationSessionFactLike[],
): FactValue {
  return sessions.map((s) => ({ ...s }));
}

/** Mirrors impersonationCollector().collect(). */
export function impersonationCollectMirror(
  fact: ImpersonationDualTrailFactLike,
): CollectorResultLike {
  const sessionCount = fact.sessions.length;
  const facts = {
    sessionCount,
    chainValid: fact.chainValid,
    sessions: sessionsAsFactValue(fact.sessions),
  };

  if (fact.chainValid === null) {
    return unresolvedResultMirror(
      {
        collectorId: IMPERSONATION_COLLECTOR_ID,
        controlId: IMPERSONATION_CONTROL_ID,
        title: IMPERSONATION_TITLE,
        summary:
          "the target tenant's audit chain could not be verified; impersonation sessions are unauditable",
        facts,
      },
      "chain verification did not run; the impersonation dual trail cannot be attested",
    );
  }

  const problems = fact.sessions.flatMap(sessionDeficienciesMirror);
  if (!fact.chainValid) {
    problems.unshift(
      "the target tenant's audit chain failed verification against its trusted anchor",
    );
  }

  if (problems.length > 0) {
    return flaggedResultMirror(
      {
        collectorId: IMPERSONATION_COLLECTOR_ID,
        controlId: IMPERSONATION_CONTROL_ID,
        title: IMPERSONATION_TITLE,
        summary: `impersonation dual-trail deficiencies found across ${String(sessionCount)} session(s)`,
        facts,
      },
      problems.join("; "),
    );
  }

  return passResultMirror({
    collectorId: IMPERSONATION_COLLECTOR_ID,
    controlId: IMPERSONATION_CONTROL_ID,
    title: IMPERSONATION_TITLE,
    summary: `${String(sessionCount)} impersonation session(s) fully dual-recorded on a verified chain`,
    facts,
  });
}

const IMPERSONATION_BASE_SESSION = {
  id: "imp-2026-07-15-01",
  operatorId: "op-jamie",
  reason: "Support case CAISSON-9042: investigating a stuck webhook retry.",
  startedAt: "2026-07-15T09:00:00.000Z",
  expiresAt: "2026-07-15T09:30:00.000Z",
  endedAt: "2026-07-15T09:22:00.000Z",
} as const;

export const IMPERSONATION_PRESETS: Readonly<
  Record<PresetKind, ImpersonationDualTrailFactLike>
> = {
  unresolved: {
    chainValid: null,
    sessions: [
      {
        ...IMPERSONATION_BASE_SESSION,
        operatorRecordSeq: 40,
        tenantRecordSeq: 41,
        endOperatorRecordSeq: 44,
        endTenantRecordSeq: 45,
        operatorRecordCount: 2,
        tenantRecordCount: 2,
      },
    ],
  },
  flagged: {
    chainValid: true,
    sessions: [
      {
        ...IMPERSONATION_BASE_SESSION,
        operatorRecordSeq: 40,
        tenantRecordSeq: 41,
        endOperatorRecordSeq: 44,
        endTenantRecordSeq: null,
        operatorRecordCount: 2,
        tenantRecordCount: 2,
      },
    ],
  },
  pass: {
    chainValid: true,
    sessions: [
      {
        ...IMPERSONATION_BASE_SESSION,
        operatorRecordSeq: 40,
        tenantRecordSeq: 41,
        endOperatorRecordSeq: 44,
        endTenantRecordSeq: 45,
        operatorRecordCount: 2,
        tenantRecordCount: 2,
      },
    ],
  },
};

// --- The board: one entry per synchronous collector, for a uniform render loop ------------------

export type SyncCollectorKey =
  | "rlsForce"
  | "wormRetention"
  | "fieldCryptoPolicy"
  | "aiRiskRegister"
  | "impersonation";

export interface CollectorCardMeta {
  readonly key: SyncCollectorKey;
  readonly id: string;
  readonly controlId: string;
  readonly title: string;
}

/** Keyed (not indexed) so consumers never hit noUncheckedIndexedAccess `| undefined` on a static,
 *  always-present row. */
export const SYNC_COLLECTOR_CARDS: Readonly<
  Record<SyncCollectorKey, CollectorCardMeta>
> = {
  rlsForce: {
    key: "rlsForce",
    id: RLS_FORCE_COLLECTOR_ID,
    controlId: RLS_FORCE_CONTROL_ID,
    title: RLS_FORCE_TITLE,
  },
  wormRetention: {
    key: "wormRetention",
    id: WORM_RETENTION_COLLECTOR_ID,
    controlId: WORM_RETENTION_CONTROL_ID,
    title: WORM_RETENTION_TITLE,
  },
  fieldCryptoPolicy: {
    key: "fieldCryptoPolicy",
    id: FIELD_CRYPTO_POLICY_COLLECTOR_ID,
    controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
    title: FIELD_CRYPTO_POLICY_TITLE,
  },
  aiRiskRegister: {
    key: "aiRiskRegister",
    id: AI_RISK_REGISTER_COLLECTOR_ID,
    controlId: AI_RISK_REGISTER_CONTROL_ID,
    title: AI_RISK_REGISTER_TITLE,
  },
  impersonation: {
    key: "impersonation",
    id: IMPERSONATION_COLLECTOR_ID,
    controlId: IMPERSONATION_CONTROL_ID,
    title: IMPERSONATION_TITLE,
  },
};

export const CHAIN_VERIFY_CARD: CollectorCardMeta = {
  key: "chainVerify" as SyncCollectorKey,
  id: CHAIN_VERIFY_COLLECTOR_ID,
  controlId: CHAIN_VERIFY_CONTROL_ID,
  title: CHAIN_VERIFY_TITLE,
};

/** Runs one of the five synchronous collectors' mirror against its preset for `preset`. */
export function collectSync(
  key: SyncCollectorKey,
  preset: PresetKind,
): CollectorResultLike {
  switch (key) {
    case "rlsForce":
      return rlsForceCollectMirror(RLS_FORCE_PRESETS[preset]);
    case "wormRetention":
      return wormRetentionCollectMirror(WORM_RETENTION_PRESETS[preset]);
    case "fieldCryptoPolicy":
      return fieldCryptoPolicyCollectMirror(
        FIELD_CRYPTO_POLICY_PRESETS[preset],
      );
    case "aiRiskRegister":
      return aiRiskRegisterCollectMirror(AI_RISK_REGISTER_PRESETS[preset]);
    case "impersonation":
      return impersonationCollectMirror(IMPERSONATION_PRESETS[preset]);
  }
}

// --- generateEvidencePack mirror (generate.ts phases 1 + 2) --------------------------------------

/** Mirrors EVIDENCE_PACK_FORMAT_VERSION, pack-format.ts. */
export const EVIDENCE_PACK_FORMAT_VERSION = "2" as const;

/** The framework identity this poke's sample pack targets - real values (matches
 *  packages/compliance-core/src/__golden__/evidence-pack.manifest.json's `framework.id`/`version`).
 *  The real framework also carries a `title` ("SOC 2 [em dash] Trust Services Criteria") that is
 *  never rendered here (ADR-0375 forbids the em dash character in this file). */
export interface EvidencePackFrameworkLike {
  readonly id: string;
  readonly version: string;
}
export const SAMPLE_TENANT_ID = "tenant-poke-demo";
export const SAMPLE_FRAMEWORK: EvidencePackFrameworkLike = {
  id: "soc2-tsc",
  version: "2024.1",
};

export interface UnresolvedItemLike {
  readonly controlId: string;
  readonly collectorId: string;
  readonly reason: string;
}
export interface EvidencePackBlockedLike {
  readonly formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  readonly tenantId: string;
  readonly framework: EvidencePackFrameworkLike;
  readonly blocked: true;
  readonly unresolved: readonly UnresolvedItemLike[];
}

/** Mirrors EvidencePackBlockedError, generate.ts: same code/httpStatus/message shape as the real
 *  CaissonError subclass (parity-pinned in the test file). Extends plain Error, not the real
 *  CaissonError base, since @caisson/kernel's "." barrel is node-tainted (see file header). */
export class EvidencePackBlockedErrorMirror extends Error {
  readonly code = "evidence_pack_blocked";
  readonly httpStatus = 422;
  readonly report: EvidencePackBlockedLike;
  constructor(report: EvidencePackBlockedLike) {
    super("evidence pack blocked: unresolved evidence (flag-never-guess)");
    this.name = "EvidencePackBlockedError";
    this.report = report;
  }
}

export interface ManifestControlLike {
  readonly controlId: string;
  readonly evidence: readonly CollectorResultLike[];
  readonly readiness: "ready" | "gap";
}
export interface ManifestSummaryLike {
  readonly totalControls: number;
  readonly controlsReady: number;
  readonly controlsWithGaps: number;
  readonly totalEvidenceItems: number;
  readonly posture: string;
}
export interface GeneratedPackLike {
  readonly formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  readonly tenantId: string;
  readonly framework: EvidencePackFrameworkLike;
  readonly controls: readonly ManifestControlLike[];
  readonly summary: ManifestSummaryLike;
}

/** Mirrors posturePhrase(), generate.ts - readiness language only, never "compliant"/"certified". */
function posturePhraseMirror(
  total: number,
  ready: number,
  gaps: number,
): string {
  const head = `${String(ready)} of ${String(total)} controls evidence-ready`;
  if (gaps === 0) return `${head}; no gaps recorded.`;
  const gapWord = gaps === 1 ? "gap" : "gaps";
  const tail = gaps === 1 ? "a remediation item" : "remediation items";
  return `${head}; ${String(gaps)} ${gapWord} recorded as ${tail}.`;
}

/**
 * Mirrors generateEvidencePack()'s two load-bearing phases (generate.ts): PHASE 1 flag-never-guess
 * (any unresolved result blocks the WHOLE pack, throwing EvidencePackBlockedErrorMirror with the
 * sorted unresolved report, before any assembly runs); PHASE 2 groups the (now pass|flagged-only)
 * results by controlId and DERIVES each control's readiness (gap iff any item flagged, never
 * asserted) plus the summary counts + posture line.
 *
 * Deliberately narrower than the real generator: no deterministic ZIP archive / SHA-256 digest
 * (node:zlib is not browser-safe), no crosswalkRollup, and no control title/family/statement
 * (registry metadata this poke's six collectors don't carry - one of them,
 * field-crypto-policy's DATA-PROTECTION.PHI-ENCRYPTION, is not even a `resolved: true` control id
 * yet per the real packages/compliance-core/src/__golden__/binding-table.json fixture).
 */
export function generateEvidencePackMirror(
  results: readonly CollectorResultLike[],
  tenantId: string,
  framework: EvidencePackFrameworkLike,
): GeneratedPackLike {
  const unresolved: UnresolvedItemLike[] = results
    .filter((r) => r.status === "unresolved" && r.reason !== undefined)
    .map((r) => ({
      controlId: r.item.controlId,
      collectorId: r.item.collectorId,
      reason: r.reason as string,
    }))
    .sort(
      (a, b) =>
        cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),
    );

  if (unresolved.length > 0) {
    throw new EvidencePackBlockedErrorMirror({
      formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
      tenantId,
      framework,
      blocked: true,
      unresolved,
    });
  }

  const byControl = new Map<string, CollectorResultLike[]>();
  for (const r of results) {
    const list = byControl.get(r.item.controlId);
    if (list === undefined) byControl.set(r.item.controlId, [r]);
    else list.push(r);
  }
  const controls: ManifestControlLike[] = [...byControl.entries()]
    .map(([controlId, evidence]) => ({
      controlId,
      evidence: [...evidence].sort((a, b) =>
        cmp(a.item.collectorId, b.item.collectorId),
      ),
      readiness: (evidence.some((e) => e.status === "flagged")
        ? "gap"
        : "ready") as "ready" | "gap",
    }))
    .sort((a, b) => cmp(a.controlId, b.controlId));

  const controlsReady = controls.filter((c) => c.readiness === "ready").length;
  const controlsWithGaps = controls.filter((c) => c.readiness === "gap").length;
  const totalEvidenceItems = controls.reduce(
    (n, c) => n + c.evidence.length,
    0,
  );

  return {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    tenantId,
    framework,
    controls,
    summary: {
      totalControls: controls.length,
      controlsReady,
      controlsWithGaps,
      totalEvidenceItems,
      posture: posturePhraseMirror(
        controls.length,
        controlsReady,
        controlsWithGaps,
      ),
    },
  };
}
