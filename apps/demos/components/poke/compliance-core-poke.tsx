"use client";

// The compliance-core module's flagship "poke" (ADR-0378 lock 2), now driven by the REAL package
// (ADR-0396) — the hand-ported mirror `compliance-core-logic.ts` is deleted.
//
// WHAT IS REAL HERE. Four of the six cards run the actual `@caisson-sh/compliance-core` collectors
// (`rlsForceCollector`, `wormRetentionCollector`, `aiRiskRegisterCollector`,
// `impersonationCollector`) over a sample fact, through the package's browser entry. "Generate the
// evidence pack" runs the REAL `assembleEvidenceManifest` — the same flag-never-guess refusal and
// derived-readiness assembly `generateEvidencePack` itself composes — so a blocked run throws the
// real `EvidencePackBlockedError` with a Zod-validated report, and a clean run returns a manifest
// the real `pack-format` schema accepted. Control metadata, the crosswalk rollup, and the risk
// entries come from the real `@caisson-sh/frameworks-pack` and `@caisson-sh/risk-register` models; the
// chain hashes are the real `hashChainLinkAsync` (WebCrypto SHA-256) from `@caisson-sh/kernel`.
//
// WHAT IS POKE-LOCAL, AND WHY. Two collectors cannot enter a browser bundle and are excluded from
// the package's `./browser` entry (see `packages/compliance-core/src/browser.ts` for the full
// reasoning): `chain-verify` composes the kernel's SYNC `node:crypto` `verifyChain` while the
// browser twin of that hash is async, and `field-crypto-policy` composes `@caisson-sh/field-crypto`,
// whose envelope module is written against the node `Buffer` global. Their two cards are therefore
// composed HERE from real primitives — the real WebCrypto link hash, the real
// `passResult`/`flaggedResult`/`unresolvedResult` constructors (so flag-never-guess is still
// enforced by the package, not by this file) — with the card wording as poke presentation. The
// field-crypto sample envelope and this file's header check are pinned against the REAL
// `parseEnvelope` in `compliance-core-poke.test.ts`, which runs where node is available.
//
// Sample facts are fixed, labeled samples: no `Date.now()`, no `Math.random()`, no argless
// `new Date()`, so the same board state always evaluates to the same six statuses.
import { useEffect, useMemo, useState } from "react";
import { hashChainLinkAsync } from "@caisson-sh/kernel/audit-verify";
import {
  regimeCrosswalks,
  soc2Tsc,
  type CanonicalControl,
} from "@caisson-sh/frameworks-pack/browser";
import { defineRiskEntry, type RiskEntry } from "@caisson-sh/risk-register";
import {
  EVIDENCE_PACK_FORMAT_VERSION,
  EvidencePackBlockedError,
  aiRiskRegisterCollector,
  assembleEvidenceManifest,
  computeCrosswalkRollup,
  controlStatusFromEvidence,
  flaggedResult,
  impersonationCollector,
  passResult,
  rlsForceCollector,
  unresolvedResult,
  wormRetentionCollector,
  type AiRiskRegisterFact,
  type CollectorResult,
  type ControlStatus,
  type EvidenceControlPlan,
  type EvidencePackChainAnchor,
  type EvidencePackManifest,
  type ImpersonationDualTrailFact,
  type RlsForceFact,
  type WormRetentionFact,
} from "@caisson-sh/compliance-core/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./compliance-core-poke.module.css";

export type PresetKind = "pass" | "flagged" | "unresolved";

export const PRESET_ORDER: readonly PresetKind[] = [
  "pass",
  "flagged",
  "unresolved",
];
const PRESET_LABEL: Readonly<Record<PresetKind, string>> = {
  pass: "Pass",
  flagged: "Flagged",
  unresolved: "Unresolved",
};

export const SAMPLE_TENANT_ID = "tenant-poke-demo";

/** The real SOC 2 pack is this demo's framework, and every card below evidences one of ITS real
 *  controls — so the assembled manifest carries genuine `defineControl` metadata, never a
 *  fabricated title/family/statement triple. */
const CONTROL_BY_ID: ReadonlyMap<string, CanonicalControl> = new Map(
  soc2Tsc.controls.map((c) => [c.id, c]),
);

function realControl(id: string): CanonicalControl {
  const control = CONTROL_BY_ID.get(id);
  if (control === undefined) {
    throw new Error(
      `compliance poke: ${id} is not a control of the SOC 2 pack`,
    );
  }
  return control;
}

// --- The four REAL collectors ------------------------------------------------------------------
// Two are pointed at a different canonical control through the collector's own `controlId` option —
// the seam a buyer uses to bind a collector to their catalog's control id. Here it keeps every card
// on a real SOC 2 control (the AI-lifecycle and PHI-encryption defaults live in other packs).

const rlsForce = rlsForceCollector();
const wormRetention = wormRetentionCollector();
const aiRiskRegister = aiRiskRegisterCollector({
  controlId: "RISK-MANAGEMENT.ASSESSMENT",
});
const impersonation = impersonationCollector();

const RLS_FORCE_PRESETS: Readonly<Record<PresetKind, RlsForceFact>> = {
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

const SAMPLE_WORM_KEY = "tenant-poke-demo/exports/2026-06";
const SAMPLE_REQUIRED_UNTIL = new Date("2031-06-27T00:00:00.000Z");

const WORM_RETENTION_PRESETS: Readonly<Record<PresetKind, WormRetentionFact>> =
  {
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
    // Same retainUntil/requiredUntil pair as the package's evidence-pack golden fixture.
    pass: {
      key: SAMPLE_WORM_KEY,
      retainUntil: new Date("2032-06-27T00:00:00.000Z"),
      requiredUntil: SAMPLE_REQUIRED_UNTIL,
    },
  };

/** Sample register rows authored through the REAL `defineRiskEntry` — so likelihood/impact are
 *  validated and the residual is computed by the package, never asserted here. */
const SAMPLE_DIGEST = "5".repeat(64);
const HALLUCINATION_RISK: RiskEntry = defineRiskEntry({
  riskId: "R-support-bot-hallucination",
  subject: "Support bot answers a billing question from stale documentation.",
  likelihood: "possible",
  impact: "moderate",
  treatmentPlan: "Rate-limited with a human-review fallback.",
  owner: "op-jamie",
  evidenceDigest: SAMPLE_DIGEST,
});
const DRIFT_RISK_FIELDS = {
  riskId: "R-pricing-model-drift",
  subject: "Pricing model drifts away from the published price book.",
  likelihood: "unlikely",
  impact: "major",
  owner: "op-jamie",
  evidenceDigest: SAMPLE_DIGEST,
} as const;
const DRIFT_RISK_UNTREATED: RiskEntry = defineRiskEntry({
  ...DRIFT_RISK_FIELDS,
  treatmentPlan: null,
});
const DRIFT_RISK_TREATED: RiskEntry = defineRiskEntry({
  ...DRIFT_RISK_FIELDS,
  treatmentPlan: "Weekly drift report reviewed by the pricing owner.",
});

const AI_RISK_PRESETS: Readonly<Record<PresetKind, AiRiskRegisterFact>> = {
  unresolved: { entries: [] },
  flagged: { entries: [HALLUCINATION_RISK, DRIFT_RISK_UNTREATED] },
  pass: { entries: [HALLUCINATION_RISK, DRIFT_RISK_TREATED] },
};

const IMPERSONATION_BASE_SESSION = {
  id: "imp-2026-07-15-01",
  operatorId: "op-jamie",
  reason: "Support case CAISSON-9042: investigating a stuck webhook retry.",
  startedAt: "2026-07-15T09:00:00.000Z",
  expiresAt: "2026-07-15T09:30:00.000Z",
  endedAt: "2026-07-15T09:22:00.000Z",
  operatorRecordSeq: 40,
  tenantRecordSeq: 41,
  endOperatorRecordSeq: 44,
  endTenantRecordSeq: 45,
  operatorRecordCount: 2,
  tenantRecordCount: 2,
} as const;

const IMPERSONATION_PRESETS: Readonly<
  Record<PresetKind, ImpersonationDualTrailFact>
> = {
  unresolved: { chainValid: null, sessions: [IMPERSONATION_BASE_SESSION] },
  flagged: {
    chainValid: true,
    // A torn end: the acting-as-tenant `session.end` record never landed on the chain.
    sessions: [{ ...IMPERSONATION_BASE_SESSION, endTenantRecordSeq: null }],
  },
  pass: { chainValid: true, sessions: [IMPERSONATION_BASE_SESSION] },
};

// --- Card 2: audit-chain integrity (poke-local composition over the REAL WebCrypto link hash) ----
// `chainVerifyCollector` is excluded from the package's browser entry (its recompute is the sync
// `node:crypto` `verifyChain`), so the verdict is computed here with `hashChainLinkAsync` and turned
// into evidence through the package's REAL result constructors.

const CHAIN_VERIFY_ID = "substrate.audit-chain-integrity";
const CHAIN_VERIFY_CONTROL_ID = "AUDIT.IMMUTABLE-LOG";
const CHAIN_VERIFY_TITLE = "Append-only audit chain integrity (WORM-anchored)";

interface SampleChainEntry {
  readonly seq: number;
  readonly prevHash: string | null;
  readonly payload: Record<string, string>;
  readonly hash: string;
}

/** The poke's fixed 3-payload sample chain, labeled sample - never real audit data. */
const SAMPLE_CHAIN_PAYLOADS: readonly Record<string, string>[] = [
  { event: "tenant.onboarded", actor: "system" },
  { event: "policy.locked", actor: "op-jamie" },
  { event: "evidence.exported", actor: "op-jamie" },
];

let sampleChainPromise: Promise<readonly SampleChainEntry[]> | null = null;

/** Build the fixed sample chain with the REAL `hashChainLinkAsync` - memoized, since the payloads
 *  are fixed the chain only needs to be built once per page load. */
export function buildSampleChain(): Promise<readonly SampleChainEntry[]> {
  sampleChainPromise ??= (async () => {
    const entries: SampleChainEntry[] = [];
    let prevHash: string | null = null;
    for (const [seq, payload] of SAMPLE_CHAIN_PAYLOADS.entries()) {
      const hash = await hashChainLinkAsync(prevHash, payload);
      entries.push({ seq, prevHash, payload, hash });
      prevHash = hash;
    }
    return entries;
  })();
  return sampleChainPromise;
}

interface SampleAnchor {
  readonly length: number;
  readonly tipHash: string;
  readonly genesisHash?: string;
}

function chainTip(entries: readonly SampleChainEntry[]): SampleChainEntry {
  const tip = entries[entries.length - 1];
  if (tip === undefined) throw new Error("compliance poke: empty sample chain");
  return tip;
}

/** The trusted anchor the sample chain is verified against. `flagged` deliberately pins a wrong tip
 *  (a stale or forged anchor); the entries themselves are always the real, consistent sample chain.
 *  Exported so the test can feed the SAME fact to the real `chainVerifyCollector`. */
export async function chainAnchorFor(
  preset: PresetKind,
): Promise<SampleAnchor | null> {
  const entries = await buildSampleChain();
  if (preset === "unresolved") return null;
  if (preset === "flagged") {
    return { length: entries.length, tipHash: "f".repeat(64) };
  }
  const genesis = entries[0];
  if (genesis === undefined) throw new Error("compliance poke: empty chain");
  return {
    length: entries.length,
    tipHash: chainTip(entries).hash,
    genesisHash: genesis.hash,
  };
}

/** The anchor the assembled manifest is bound to: always the sample chain's real, consistent
 *  triple, independent of the card's preset (a blocked run never reaches assembly anyway). */
export async function manifestChainAnchor(): Promise<EvidencePackChainAnchor> {
  const entries = await buildSampleChain();
  const genesis = entries[0];
  if (genesis === undefined) throw new Error("compliance poke: empty chain");
  return {
    length: entries.length,
    tipHash: chainTip(entries).hash,
    genesisHash: genesis.hash,
  };
}

/** Recompute every link with the REAL WebCrypto hash, then check the chain against its anchor. */
async function verifySampleChain(
  entries: readonly SampleChainEntry[],
  anchor: SampleAnchor,
): Promise<{ valid: boolean; brokenAt: number | null }> {
  for (const [i, entry] of entries.entries()) {
    const expectedPrev = i === 0 ? null : (entries[i - 1]?.hash ?? null);
    if (entry.seq !== i) return { valid: false, brokenAt: i };
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    const recomputed = await hashChainLinkAsync(entry.prevHash, entry.payload);
    if (entry.hash !== recomputed) return { valid: false, brokenAt: i };
  }
  const genesis = entries[0];
  if (
    anchor.genesisHash !== undefined &&
    genesis?.hash !== anchor.genesisHash
  ) {
    return { valid: false, brokenAt: 0 };
  }
  if (entries.length !== anchor.length) {
    return { valid: false, brokenAt: Math.min(entries.length, anchor.length) };
  }
  if (chainTip(entries).hash !== anchor.tipHash) {
    return { valid: false, brokenAt: entries.length - 1 };
  }
  return { valid: true, brokenAt: null };
}

export async function collectChainVerify(
  preset: PresetKind,
): Promise<CollectorResult> {
  const entries = await buildSampleChain();
  const anchor = await chainAnchorFor(preset);
  const head = {
    collectorId: CHAIN_VERIFY_ID,
    controlId: CHAIN_VERIFY_CONTROL_ID,
    title: CHAIN_VERIFY_TITLE,
    manualSlots: [],
  };
  if (anchor === null) {
    return unresolvedResult(
      {
        ...head,
        summary: "no trusted WORM anchor was supplied for the audit chain",
        facts: { entryCount: entries.length, anchorPresent: false },
      },
      "audit chain has no trusted anchor; integrity cannot be attested",
    );
  }
  const verification = await verifySampleChain(entries, anchor);
  const facts = {
    entryCount: entries.length,
    anchorPresent: true,
    anchorLength: anchor.length,
    valid: verification.valid,
    brokenAt: verification.brokenAt,
  };
  if (verification.valid) {
    return passResult({
      ...head,
      summary: `audit chain verified against its anchor (${String(entries.length)} entries)`,
      facts,
    });
  }
  return flaggedResult(
    {
      ...head,
      summary: "audit chain failed verification against its trusted anchor",
      facts,
    },
    `chain verification failed at index ${String(verification.brokenAt)}`,
  );
}

// --- Card 4: PHI encryption at rest (poke-local composition) ------------------------------------
// `fieldCryptoPolicyCollector` is excluded from the package's browser entry (its `parseEnvelope`
// import reaches `@caisson-sh/field-crypto`, whose envelope module uses the node `Buffer` global). No
// decryption ever runs in this card either way — only the envelope's header bytes are inspected, so
// the check below is a pure byte-layout read, pinned against the REAL `parseEnvelope` in the test.

const FIELD_CRYPTO_POLICY_ID = "substrate.field-crypto-policy";
const FIELD_CRYPTO_POLICY_CONTROL_ID = "DATA-PROTECTION.ENCRYPTION";
const FIELD_CRYPTO_POLICY_TITLE =
  "PHI fields encrypted at rest (per-tenant field-crypto)";
/** The real collector invites a manual key-management attestation on every item; the card carries the
 *  same slot, so what this feeds into the assembly is the real collector's output. Pinned in the test. */
const FIELD_CRYPTO_POLICY_MANUAL_SLOTS = [
  {
    id: "encryption-key-management-policy",
    label: "Encryption key-management / HSM custody policy",
    required: false,
  },
];

/** Envelope header layout: format-version(1) + alg-id(1) + key_version(2) + nonce(12) + ct + tag(16). */
const ENVELOPE_FORMAT_VERSION = 0x01;
const ENVELOPE_ALG_AES_256_GCM = 0x01;
const ENVELOPE_MIN_BYTES = 4 + 12 + 16;

/** One fixed, labeled-sample AES-256-GCM envelope: key_version 1, a 0x11-filled nonce, six bytes of
 *  stand-in ciphertext, a 0x22-filled tag. Not a real key and not real ciphertext; its byte layout
 *  is pinned against `serializeEnvelope`/`parseEnvelope` in the test. */
export const SAMPLE_ENCRYPTED_ENVELOPE =
  "AQEAAREREREREREREREREaq7zN3u/yIiIiIiIiIiIiIiIiIiIiI=";

/** True iff the stored value is a well-formed AES-256-GCM field-crypto envelope. */
export function looksEncryptedAtRest(storedValue: string): boolean {
  try {
    const bin = atob(storedValue);
    if (bin.length < ENVELOPE_MIN_BYTES) return false;
    if (bin.charCodeAt(0) !== ENVELOPE_FORMAT_VERSION) return false;
    return bin.charCodeAt(1) === ENVELOPE_ALG_AES_256_GCM;
  } catch {
    return false;
  }
}

const PHI_FIELDS = [
  "patient.diagnosis_notes",
  "patient.insurance_id",
  "patient.ssn",
] as const;

/** Exported so the test can feed the SAME fact to the real `fieldCryptoPolicyCollector`. */
export const FIELD_CRYPTO_PRESETS: Readonly<
  Record<PresetKind, readonly { field: string; storedValue: string | null }[]>
> = {
  unresolved: [
    { field: PHI_FIELDS[0], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
    { field: PHI_FIELDS[1], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
    { field: PHI_FIELDS[2], storedValue: null },
  ],
  flagged: [
    { field: PHI_FIELDS[0], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
    { field: PHI_FIELDS[1], storedValue: SAMPLE_ENCRYPTED_ENVELOPE },
    { field: PHI_FIELDS[2], storedValue: "555-12-3456" },
  ],
  pass: PHI_FIELDS.map((field) => ({
    field,
    storedValue: SAMPLE_ENCRYPTED_ENVELOPE,
  })),
};

export function collectFieldCryptoPolicy(preset: PresetKind): CollectorResult {
  const fields = FIELD_CRYPTO_PRESETS[preset];
  const head = {
    collectorId: FIELD_CRYPTO_POLICY_ID,
    controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
    title: FIELD_CRYPTO_POLICY_TITLE,
    manualSlots: FIELD_CRYPTO_POLICY_MANUAL_SLOTS,
  };
  const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const plaintextFields = fields
    .filter(
      (f) => f.storedValue !== null && !looksEncryptedAtRest(f.storedValue),
    )
    .map((f) => f.field)
    .sort(byName);
  const unsampledFields = fields
    .filter((f) => f.storedValue === null)
    .map((f) => f.field)
    .sort(byName);
  const facts = {
    fieldCount: fields.length,
    encryptedCount:
      fields.length - plaintextFields.length - unsampledFields.length,
    plaintextFields,
    unsampledFields,
  };

  if (plaintextFields.length > 0) {
    return flaggedResult(
      {
        ...head,
        summary: `${String(plaintextFields.length)} of ${String(fields.length)} PHI fields are not encrypted at rest`,
        facts,
      },
      `PHI fields not encrypted with an AES-256-GCM field-crypto envelope: ${plaintextFields.join(", ")}`,
    );
  }
  if (unsampledFields.length > 0) {
    return unresolvedResult(
      {
        ...head,
        summary: `${String(unsampledFields.length)} of ${String(fields.length)} PHI fields had no stored value to inspect`,
        facts,
      },
      `no at-rest sample for PHI fields: ${unsampledFields.join(", ")}; encryption cannot be attested`,
    );
  }
  return passResult({
    ...head,
    summary: `all ${String(fields.length)} PHI fields are encrypted at rest (AES-256-GCM field-crypto envelope)`,
    facts,
  });
}

// --- The board ---------------------------------------------------------------------------------

export type SyncCardKey =
  | "rlsForce"
  | "wormRetention"
  | "fieldCryptoPolicy"
  | "aiRiskRegister"
  | "impersonation";

/** Run one of the five synchronous cards against its preset. Four of them ARE the real collector. */
export function collectSync(
  key: SyncCardKey,
  preset: PresetKind,
): CollectorResult {
  switch (key) {
    case "rlsForce":
      return rlsForce.collect(RLS_FORCE_PRESETS[preset]);
    case "wormRetention":
      return wormRetention.collect(WORM_RETENTION_PRESETS[preset]);
    case "fieldCryptoPolicy":
      return collectFieldCryptoPolicy(preset);
    case "aiRiskRegister":
      return aiRiskRegister.collect(AI_RISK_PRESETS[preset]);
    case "impersonation":
      return impersonation.collect(IMPERSONATION_PRESETS[preset]);
  }
}

export interface CardMeta {
  readonly key: string;
  readonly id: string;
  readonly controlId: string;
  readonly title: string;
}

/** Card identity read straight off each real collector; the two composed cards declare their own. */
export const CARDS: Readonly<Record<SyncCardKey | "chainVerify", CardMeta>> = {
  rlsForce: { key: "rlsForce", ...metaOf(rlsForce) },
  chainVerify: {
    key: "chainVerify",
    id: CHAIN_VERIFY_ID,
    controlId: CHAIN_VERIFY_CONTROL_ID,
    title: CHAIN_VERIFY_TITLE,
  },
  wormRetention: { key: "wormRetention", ...metaOf(wormRetention) },
  fieldCryptoPolicy: {
    key: "fieldCryptoPolicy",
    id: FIELD_CRYPTO_POLICY_ID,
    controlId: FIELD_CRYPTO_POLICY_CONTROL_ID,
    title: FIELD_CRYPTO_POLICY_TITLE,
  },
  aiRiskRegister: { key: "aiRiskRegister", ...metaOf(aiRiskRegister) },
  impersonation: { key: "impersonation", ...metaOf(impersonation) },
};

function metaOf(collector: {
  readonly id: string;
  readonly controlId: string;
  readonly title: string;
}): Omit<CardMeta, "key"> {
  return {
    id: collector.id,
    controlId: collector.controlId,
    title: collector.title,
  };
}

/** Group the gathered results by control and attach the REAL control metadata — the edge-side
 *  input preparation `assembleEvidenceManifest` expects, not a second assembly. */
export function buildControlPlans(
  results: readonly CollectorResult[],
): EvidenceControlPlan[] {
  const byControl = new Map<string, CollectorResult[]>();
  for (const r of results) {
    const list = byControl.get(r.item.controlId);
    if (list === undefined) byControl.set(r.item.controlId, [r]);
    else list.push(r);
  }
  return [...byControl.entries()].map(([controlId, evidence]) => {
    const control = realControl(controlId);
    return {
      controlId,
      title: control.title,
      family: control.family,
      statement: control.statement,
      crosswalk: control.crosswalk,
      evidence,
    };
  });
}

/**
 * The real thing: refuse the pack outright if any collector is still unresolved (throwing the real
 * `EvidencePackBlockedError`), else assemble and Zod-validate the canonical manifest body — readiness
 * derived per control, summary counts cross-checked, posture copy re-refined by the package.
 */
export async function buildEvidencePack(
  results: readonly CollectorResult[],
): Promise<EvidencePackManifest> {
  const plans = buildControlPlans(results);
  const controlStatuses = new Map<string, ControlStatus>(
    plans.map((p) => [p.controlId, controlStatusFromEvidence(p.evidence)]),
  );
  return assembleEvidenceManifest({
    tenantId: SAMPLE_TENANT_ID,
    framework: {
      id: soc2Tsc.id,
      title: soc2Tsc.title,
      version: soc2Tsc.version,
    },
    chainAnchor: await manifestChainAnchor(),
    controls: plans,
    crosswalkRollup: computeCrosswalkRollup({
      catalogs: [soc2Tsc],
      controlStatuses,
      regimeCrosswalks,
    }),
  });
}

// --- The component -----------------------------------------------------------------------------

type BoardState = Record<SyncCardKey | "chainVerify", PresetKind>;

// Nothing evidenced yet - every collector starts unresolved, matching a freshly onboarded tenant.
const INITIAL_BOARD: BoardState = {
  rlsForce: "unresolved",
  chainVerify: "unresolved",
  wormRetention: "unresolved",
  fieldCryptoPolicy: "unresolved",
  aiRiskRegister: "unresolved",
  impersonation: "unresolved",
};

interface GenerateOutcome {
  readonly state: VerdictState;
  readonly pack: EvidencePackManifest | null;
  readonly blocked: EvidencePackBlockedError | null;
}

/** Convert every rejected assembly into UI state. Unexpected details stay out of buyer-facing copy. */
export function generateFailureOutcome(error: unknown): GenerateOutcome {
  if (error instanceof EvidencePackBlockedError) {
    return { state: "fail", pack: null, blocked: error };
  }
  return { state: "fail", pack: null, blocked: null };
}

function statusDotClass(status: CollectorResult["status"] | "loading"): string {
  if (status === "pass") return styles.dotPass ?? "";
  if (status === "flagged") return styles.dotFlagged ?? "";
  if (status === "unresolved") return styles.dotUnresolved ?? "";
  return styles.dotLoading ?? "";
}

export default function ComplianceCorePoke() {
  const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);

  const rlsResult = useMemo(
    () => collectSync("rlsForce", board.rlsForce),
    [board.rlsForce],
  );
  const wormResult = useMemo(
    () => collectSync("wormRetention", board.wormRetention),
    [board.wormRetention],
  );
  const fieldResult = useMemo(
    () => collectSync("fieldCryptoPolicy", board.fieldCryptoPolicy),
    [board.fieldCryptoPolicy],
  );
  const riskResult = useMemo(
    () => collectSync("aiRiskRegister", board.aiRiskRegister),
    [board.aiRiskRegister],
  );
  const impersonationResult = useMemo(
    () => collectSync("impersonation", board.impersonation),
    [board.impersonation],
  );

  // The one async card: chain-verify recomputes the hash chain with the REAL WebCrypto primitive.
  const [chainResult, setChainResult] = useState<CollectorResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    void collectChainVerify(board.chainVerify).then((result) => {
      if (!cancelled) setChainResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [board.chainVerify]);

  const cards = [
    {
      meta: CARDS.rlsForce,
      preset: board.rlsForce,
      result: rlsResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, rlsForce: p })),
    },
    {
      meta: CARDS.chainVerify,
      preset: board.chainVerify,
      result: chainResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, chainVerify: p })),
    },
    {
      meta: CARDS.wormRetention,
      preset: board.wormRetention,
      result: wormResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, wormRetention: p })),
    },
    {
      meta: CARDS.fieldCryptoPolicy,
      preset: board.fieldCryptoPolicy,
      result: fieldResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, fieldCryptoPolicy: p })),
    },
    {
      meta: CARDS.aiRiskRegister,
      preset: board.aiRiskRegister,
      result: riskResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, aiRiskRegister: p })),
    },
    {
      meta: CARDS.impersonation,
      preset: board.impersonation,
      result: impersonationResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, impersonation: p })),
    },
  ];

  const handleGenerate = () => {
    if (chainResult === null) return;
    const results: CollectorResult[] = [
      rlsResult,
      chainResult,
      wormResult,
      fieldResult,
      riskResult,
      impersonationResult,
    ];
    void buildEvidencePack(results)
      .then((pack) => {
        setOutcome({ state: "ok", pack, blocked: null });
      })
      .catch((err: unknown) => {
        setOutcome(generateFailureOutcome(err));
      });
  };

  const verdict: { state: VerdictState; message: string } =
    outcome === null
      ? {
          state: "neutral",
          message: "Set every collector, then generate the pack.",
        }
      : outcome.state === "ok" && outcome.pack !== null
        ? {
            state: "ok",
            message: `Pack generated. ${outcome.pack.summary.posture}`,
          }
        : outcome.blocked !== null
          ? { state: "fail", message: `Blocked. ${outcome.blocked.message}` }
          : {
              state: "fail",
              message: "Could not generate the pack. Try again.",
            };

  return (
    <PokeShell
      label={`@caisson-sh/compliance-core · evidence pack v${EVIDENCE_PACK_FORMAT_VERSION}`}
      title="Clear every collector, then generate the evidence pack."
    >
      <div className={styles.grid}>
        {cards.map(({ meta, preset, result, set }) => (
          <div key={meta.key} className={styles.card}>
            <p className={styles.cardId}>{meta.id}</p>
            <p className={styles.cardTitle}>{meta.title}</p>
            <div
              className={styles.segmented}
              role="group"
              aria-label={`${meta.title} status`}
            >
              {PRESET_ORDER.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.segButton}
                  aria-pressed={preset === kind}
                  data-active={preset === kind}
                  onClick={() => set(kind)}
                >
                  {PRESET_LABEL[kind]}
                </button>
              ))}
            </div>
            <p
              className={styles.cardStatus}
              data-status={result?.status ?? "loading"}
            >
              <span
                className={`${styles.dot} ${statusDotClass(result?.status ?? "loading")}`}
                aria-hidden="true"
              />
              {result === null
                ? "computing…"
                : result.status === "pass"
                  ? result.item.summary
                  : (result.reason ?? result.item.summary)}
            </p>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.generateButton}
          onClick={handleGenerate}
          disabled={chainResult === null}
        >
          Generate evidence pack
        </button>
      </div>

      {outcome?.blocked !== null && outcome?.blocked !== undefined ? (
        <div className={styles.report} data-kind="blocked">
          {/* The label is written out rather than read off `err.name`: a class name is not stable
              under a minified production bundle, while `code`/`httpStatus` are real fields. */}
          <p className={styles.reportHead}>
            Evidence pack blocked ({outcome.blocked.code} · HTTP{" "}
            {outcome.blocked.httpStatus})
          </p>
          <ul className={styles.unresolvedList}>
            {outcome.blocked.report.unresolved.map((u) => (
              <li key={`${u.controlId}:${u.collectorId}`}>
                <span className={styles.mono}>{u.controlId}</span> /{" "}
                <span className={styles.mono}>{u.collectorId}</span>: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome?.pack !== null && outcome?.pack !== undefined ? (
        <div className={styles.report} data-kind="pack">
          <p className={styles.reportHead}>
            formatVersion {outcome.pack.formatVersion} · tenant{" "}
            {outcome.pack.tenantId} · framework {outcome.pack.framework.id} v
            {outcome.pack.framework.version}
          </p>
          <table className={styles.controlsTable}>
            <tbody>
              {outcome.pack.controls.map((c) => (
                <tr key={c.controlId} data-readiness={c.readiness}>
                  <td className={styles.mono}>{c.controlId}</td>
                  <td>{c.readiness}</td>
                  <td>
                    {c.evidence.length} evidence item
                    {c.evidence.length === 1 ? "" : "s"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.summaryLine}>
            {outcome.pack.summary.totalControls} controls ·{" "}
            {outcome.pack.summary.controlsReady} ready ·{" "}
            {outcome.pack.summary.controlsWithGaps} with gaps ·{" "}
            {outcome.pack.summary.totalEvidenceItems} evidence items
          </p>
        </div>
      ) : null}

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}
