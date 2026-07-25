"use client";

// The @caisson/signing-primitive "verify workbench" poke (ADR-0378 lock 2). A self-contained,
// deterministic, in-browser run of the SHIPPED detached-Ed25519 verify path: a per-tenant signature
// over a canonical, chain-anchored evidence manifest, plus its RFC-3161 countersign receipt. Verify
// the good sample (ok verdict), then flip one payload byte or swap the verifying key and watch the
// verdict flip to fail. The crypto is mirrored from the package's node:crypto path via WebCrypto and
// pinned boolean/byte-identical in signing-primitive-logic.test.ts. Nothing here fetches, persists, or
// measures. Loaded via next/dynamic({ ssr: false }) by the carousel.
import { useEffect, useId, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  FOREIGN_PUBLIC_KEY,
  SAMPLE_MANIFEST,
  SAMPLE_SIGNATURE,
  SAMPLE_TSA_AUTHORITY,
  type TimestampToken,
  evidenceSignablePayload,
  flipTipByte,
  sampleCountersign,
  timestampCountersignsSignature,
  verifyEvidenceSignature,
  withTamperedTip,
} from "./signing-primitive-logic";

import styles from "./signing-primitive-poke.module.css";

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
      const holds = await timestampCountersignsSignature(t, SAMPLE_SIGNATURE);
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
      label="@caisson/signing-primitive"
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
