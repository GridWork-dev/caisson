"use client";

// The @caisson-sh/signing-primitive "verify workbench" poke (ADR-0378 lock 2). A self-contained,
// deterministic, in-browser run of the SHIPPED detached-Ed25519 verify path: a per-tenant signature
// over a canonical, chain-anchored evidence manifest, plus its RFC-3161 countersign receipt. Verify
// the good sample (ok verdict), then flip one payload byte or swap the verifying key and watch the
// verdict flip to fail.
//
// The crypto is the PACKAGE'S OWN, imported from @caisson-sh/signing-primitive/browser (ADR-0396) — the
// hand-ported mirror this file used to drive (signing-primitive-logic.ts) is deleted. The mirror's
// premise (that the verify path was node-bound) was only ever true of the MODULE: `@noble/ed25519` is
// dependency-free pure JS, so the package's browser entry now ships the same primitive the server
// runs, with no second implementation of it anywhere.
//
// What stays here is what SHOULD be local to a demo: the sample manifest and signature (byte-pinned
// to the package's __golden__ fixtures in signing-primitive-poke.test.ts), the tamper affordances,
// and the readout composition. Nothing here fetches, persists, or measures. Loaded via
// next/dynamic({ ssr: false }) by the carousel.
import { useEffect, useId, useState } from "react";
import {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  StubTimestampAuthority,
  type EvidenceSignature,
  type SignableManifest,
  type TimestampToken,
  evidenceSignablePayload,
  hexToBytes,
  timestampCountersignsSignatureAsync,
  verifyEvidenceSignature,
} from "@caisson-sh/signing-primitive/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";

import styles from "./signing-primitive-poke.module.css";

// --- sample data (labeled as samples in the UI; byte-pinned to the package's shipped goldens in the
//     test). Never real key material — the signing seed behind it is a fixed non-secret KAT vector.

/** The rendered slice of the sample manifest shape (the rest is opaque JSON the signature still covers). */
export interface EvidenceManifestSample extends SignableManifest {
  readonly formatVersion: string;
  readonly tenantId: string;
  readonly framework: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
  };
  readonly chainAnchor: {
    readonly length: number;
    readonly tipHash: string;
    readonly genesisHash: string;
  };
  readonly summary: {
    readonly totalControls: number;
    readonly controlsReady: number;
    readonly controlsWithGaps: number;
    readonly totalEvidenceItems: number;
    readonly posture: string;
  };
}

// The VERBATIM golden evidence pack (packages/signing-primitive/src/__golden__/evidence-pack.manifest.json).
// Embedded as a byte-parity fixture because a client bundle cannot read a package's fixture file off
// disk; deep-equality against the real golden file is pinned in the test. The lone em dash in a
// framework/statement string is written - so no raw em dash byte lands in this file (ADR-0375)
// while the runtime string stays byte-identical to the golden the signature was taken over.
// ponytail: a JSON.parse of the verbatim fixture, not a hand-typed literal - one source of truth, and
// a transcription error would fail the golden test loudly.
const SAMPLE_MANIFEST_JSON = `{
  "formatVersion": "2",
  "tenantId": "tenant-acme-prod",
  "framework": {
    "id": "soc2-tsc",
    "title": "SOC 2 \u2014 Trust Services Criteria",
    "version": "2024.1"
  },
  "chainAnchor": {
    "length": 128,
    "tipHash": "0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d",
    "genesisHash": "9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c9f8e7d6c"
  },
  "controls": [
    {
      "controlId": "AUDIT.IMMUTABLE-LOG",
      "title": "Immutable audit log",
      "family": "Audit & Accountability",
      "statement": "Security-relevant events are written to an append-only, hash-chained log that cannot be altered or deleted after the fact, and the chain is anchored in WORM storage.",
      "crosswalk": [
        {
          "framework": "SOC2-TSC",
          "reference": "CC7.2",
          "note": "System monitoring"
        },
        {
          "framework": "HIPAA-Security",
          "reference": "164.312(b)"
        }
      ],
      "evidence": [
        {
          "collectorId": "substrate.audit-chain-integrity",
          "title": "Append-only audit chain integrity (WORM-anchored)",
          "summary": "audit chain verified against its anchor (128 entries)",
          "status": "pass",
          "facts": {
            "entryCount": 128,
            "anchorPresent": true,
            "anchorLength": 128,
            "valid": true,
            "brokenAt": null
          },
          "manualSlots": []
        },
        {
          "collectorId": "substrate.worm-retention",
          "title": "WORM retention floor met for the locked artifact",
          "summary": "locked artifact retained beyond the legal floor",
          "status": "pass",
          "facts": {
            "mode": "GOVERNANCE",
            "retainUntil": "2032-06-27T00:00:00.000Z",
            "requiredUntil": "2031-06-27T00:00:00.000Z",
            "meetsFloor": true
          },
          "manualSlots": [
            {
              "id": "retention-policy-pdf",
              "label": "Signed records-retention policy (PDF)",
              "required": false,
              "filled": false
            }
          ]
        }
      ],
      "readiness": "ready"
    },
    {
      "controlId": "DATA-PROTECTION.TENANT-ISOLATION",
      "title": "Row-level tenant isolation",
      "family": "Access Control",
      "statement": "Every tenant-scoped table enforces FORCE row-level security so that no role \u2014 including the table owner \u2014 can read or write another tenant's rows.",
      "crosswalk": [
        {
          "framework": "SOC2-TSC",
          "reference": "CC6.1"
        }
      ],
      "evidence": [
        {
          "collectorId": "substrate.rls-force",
          "title": "FORCE row-level security posture",
          "summary": "one tenant table is missing a FORCE RLS policy",
          "status": "flagged",
          "reason": "table \\"legacy_export\\" has RLS enabled but not FORCEd; a table owner could bypass the policy",
          "facts": {
            "tablesChecked": 6,
            "tablesForced": 5,
            "tablesMissingForce": 1,
            "missing": [
              "legacy_export"
            ]
          },
          "manualSlots": []
        }
      ],
      "readiness": "gap"
    }
  ],
  "summary": {
    "totalControls": 2,
    "controlsReady": 1,
    "controlsWithGaps": 1,
    "totalEvidenceItems": 3,
    "posture": "1 of 2 controls evidence-ready; 1 gap recorded as a remediation item."
  },
  "crosswalkRollup": {
    "cells": [
      {
        "framework": "HIPAA-Security",
        "reference": "164.312(b)",
        "canonicalControlIds": [
          "AUDIT.IMMUTABLE-LOG"
        ],
        "status": "ready",
        "claim": "maps-to",
        "evidencePointers": [
          "AUDIT.IMMUTABLE-LOG"
        ]
      },
      {
        "framework": "SOC2-TSC",
        "reference": "CC6.1",
        "canonicalControlIds": [
          "DATA-PROTECTION.TENANT-ISOLATION"
        ],
        "status": "gap",
        "claim": "maps-to",
        "evidencePointers": [
          "DATA-PROTECTION.TENANT-ISOLATION"
        ]
      },
      {
        "framework": "SOC2-TSC",
        "reference": "CC7.2",
        "canonicalControlIds": [
          "AUDIT.IMMUTABLE-LOG"
        ],
        "status": "ready",
        "claim": "maps-to",
        "evidencePointers": [
          "AUDIT.IMMUTABLE-LOG"
        ]
      }
    ]
  }
}`;

export const SAMPLE_MANIFEST = JSON.parse(
  SAMPLE_MANIFEST_JSON,
) as EvidenceManifestSample;

/**
 * The sample detached signature - the byte-pinned golden. `signature` is __golden__/signed-manifest.sig
 * verbatim; `publicKey` + `keyId` are the fixed per-tenant test identity that produced it (sign.test.ts
 * TENANT_PUBLIC_KEY / TENANT_KEY_ID). Every field is re-derived and pinned in the test. Never real key
 * material - a fixed non-secret KAT seed.
 */
export const SAMPLE_SIGNATURE: EvidenceSignature = {
  algorithm: "ed25519",
  keyId: "tenant-acme-prod/evidence-signing/v1",
  publicKey: "2152f8d19b791d24453242e15f2eab6cb7cffa7b6a5ed30097960e069881db12",
  signature:
    "df3ffdd47e9eb76bdd8c785eece809c4ddf6854e025d1f0879d4eb24c65364e0b6c8fd90ad44f36532b20d2ad173c6ca0d209143e8b014cc7fcce8a4abba4c09",
};

/** The foreign key for the swap-the-key tamper - the exact one the package's own test forges with. */
export const FOREIGN_PUBLIC_KEY = "00".repeat(32);

/** The stub authority's identity (the package default, restated so the UI label cites a real value). */
export const SAMPLE_TSA_AUTHORITY = "urn:caisson:test-tsa";
/** A fixed sample instant (the date the package's own countersign test stamps). No clock read. */
export const SAMPLE_TIMESTAMPED_AT = "2026-06-27T12:00:00.000Z";

/** The REAL test-doubled TSA from the package, on a fixed clock so the receipt is deterministic. */
const SAMPLE_TSA = new StubTimestampAuthority({
  authority: SAMPLE_TSA_AUTHORITY,
  now: new Date(SAMPLE_TIMESTAMPED_AT),
});

export function sampleCountersign(
  signature: EvidenceSignature,
): Promise<TimestampToken> {
  return SAMPLE_TSA.countersign(hexToBytes(signature.signature));
}

/** Flip one byte of a hex string (XOR the first byte's low bit) - the flip-one-payload-byte tamper. */
export function flipTipByte(tipHash: string): string {
  const firstByte = Number.parseInt(tipHash.slice(0, 2), 16) ^ 0x01;
  return firstByte.toString(16).padStart(2, "0") + tipHash.slice(2);
}

/** Build the tampered manifest: one flipped chain-tip byte, everything else intact (the anchor is signed). */
export function withTamperedTip(
  manifest: EvidenceManifestSample,
): EvidenceManifestSample {
  return {
    ...manifest,
    chainAnchor: {
      ...manifest.chainAnchor,
      tipHash: flipTipByte(manifest.chainAnchor.tipHash),
    },
  };
}

function TamperToggle({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.toggle} htmlFor={id} data-active={checked}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.readout}>
      <span className={styles.readoutLabel}>{label}</span>
      <span className={styles.readoutValue}>{value}</span>
    </div>
  );
}

export default function SigningPrimitivePoke() {
  const [tamperTip, setTamperTip] = useState(false);
  const [swapKey, setSwapKey] = useState(false);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [token, setToken] = useState<TimestampToken | null>(null);
  const [countersigns, setCountersigns] = useState<boolean | null>(null);

  const tipId = useId();
  const keyId = useId();

  // Verify reactively whenever a tamper toggles. Both branches build from the fixed sample, so the run
  // is fully deterministic: pristine inputs verify, either tamper fails the shared Ed25519 primitive.
  useEffect(() => {
    const manifest = tamperTip
      ? withTamperedTip(SAMPLE_MANIFEST)
      : SAMPLE_MANIFEST;
    const signature = swapKey
      ? { ...SAMPLE_SIGNATURE, publicKey: FOREIGN_PUBLIC_KEY }
      : SAMPLE_SIGNATURE;
    let ignore = false;
    void verifyEvidenceSignature(manifest, signature).then((result) => {
      if (!ignore) setVerifyResult(result);
    });
    return () => {
      ignore = true;
    };
  }, [tamperTip, swapKey]);

  // The RFC-3161 receipt attests to the SIGNATURE bytes, which no tamper here changes, so compute it
  // once from the genuine sample signature (the countersign is additive, independent of verification).
  useEffect(() => {
    let ignore = false;
    void sampleCountersign(SAMPLE_SIGNATURE).then(async (t) => {
      if (ignore) return;
      setToken(t);
      const holds = await timestampCountersignsSignatureAsync(
        t,
        SAMPLE_SIGNATURE,
      );
      if (!ignore) setCountersigns(holds);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const displayTip = tamperTip
    ? flipTipByte(SAMPLE_MANIFEST.chainAnchor.tipHash)
    : SAMPLE_MANIFEST.chainAnchor.tipHash;
  const displayKey = swapKey ? FOREIGN_PUBLIC_KEY : SAMPLE_SIGNATURE.publicKey;
  const payloadBytes = evidenceSignablePayload(
    tamperTip ? withTamperedTip(SAMPLE_MANIFEST) : SAMPLE_MANIFEST,
  ).length;

  let verdictState: VerdictState = "neutral";
  let verdictText = "Verifying the sample signature.";
  if (verifyResult !== null) {
    if (verifyResult) {
      verdictState = "ok";
      verdictText = `Signature verifies. ${SAMPLE_MANIFEST.tenantId} sealed this evidence pack.`;
    } else if (swapKey && !tamperTip) {
      verdictState = "fail";
      verdictText =
        "Verification failed. This public key never signed these bytes.";
    } else if (tamperTip && !swapKey) {
      verdictState = "fail";
      verdictText =
        "Verification failed. One flipped byte, the signed bytes no longer match.";
    } else {
      verdictState = "fail";
      verdictText =
        "Verification failed. Neither the bytes nor the key match the signature.";
    }
  }

  return (
    <PokeShell
      label="@caisson-sh/signing-primitive"
      title="Verify a detached signature. Break it and watch the verdict flip."
    >
      <div className={styles.zones}>
        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Signed body</p>
          <Readout label="tenant" value={SAMPLE_MANIFEST.tenantId} />
          <Readout
            label="framework"
            value={`${SAMPLE_MANIFEST.framework.id} v${SAMPLE_MANIFEST.framework.version}`}
          />
          <div className={styles.hexRow}>
            <span className={styles.readoutLabel}>chain tip</span>
            <code className={styles.hex} data-tampered={tamperTip}>
              {displayTip}
            </code>
          </div>
          <p className={styles.note}>
            Signed bytes = canonical manifest then chain tip. {payloadBytes}{" "}
            bytes over Ed25519. <span className={styles.sampleTag}>sample</span>
          </p>
        </div>

        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Detached signature</p>
          <Readout label="algorithm" value={SAMPLE_SIGNATURE.algorithm} />
          <Readout label="key id" value={SAMPLE_SIGNATURE.keyId} />
          <div className={styles.hexRow}>
            <span className={styles.readoutLabel}>
              public key ({ED25519_PUBLIC_BYTES}B)
            </span>
            <code className={styles.hex} data-tampered={swapKey}>
              {displayKey}
            </code>
          </div>
          <div className={styles.hexRow}>
            <span className={styles.readoutLabel}>
              signature ({ED25519_SIGNATURE_BYTES}B)
            </span>
            <code className={styles.hex}>{SAMPLE_SIGNATURE.signature}</code>
          </div>
        </div>

        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Break it</p>
          <div className={styles.toggles}>
            <TamperToggle
              id={tipId}
              checked={tamperTip}
              onChange={setTamperTip}
            >
              Flip one payload byte (chain tip)
            </TamperToggle>
            <TamperToggle id={keyId} checked={swapKey} onChange={setSwapKey}>
              Swap the verifying key
            </TamperToggle>
          </div>
          <Verdict state={verdictState}>{verdictText}</Verdict>
        </div>

        <div className={styles.zone}>
          <p className={styles.zoneLabel}>RFC-3161 receipt</p>
          <Readout label="authority" value={SAMPLE_TSA_AUTHORITY} />
          <Readout
            label="hash"
            value={token ? token.hashAlgorithm : "sha256"}
          />
          <Readout
            label="stamped at"
            value={token ? token.timestampedAt : ""}
          />
          {token ? (
            <div className={styles.hexRow}>
              <span className={styles.readoutLabel}>message imprint</span>
              <code className={styles.hex}>{token.messageImprint}</code>
            </div>
          ) : null}
          <p className={styles.receiptNote}>
            {countersigns === null
              ? "Reading the countersign."
              : countersigns
                ? "Countersigns this signature. The test-doubled TSA attests it existed at the stamped time. No live network call."
                : "Countersign does not bind this signature."}
          </p>
        </div>
      </div>
    </PokeShell>
  );
}
