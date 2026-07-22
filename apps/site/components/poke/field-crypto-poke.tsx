"use client";

// Flagship F1 — the @caisson/field-crypto "envelope bench" poke (ADR-0378 lock 2, kimi spec F1).
// A self-contained, deterministic, in-browser run of the SHIPPED field-crypto primitive: HKDF-SHA256
// per-tenant key derivation feeding AES-256-GCM with the real row-bound AAD 4-tuple, rendered as the
// real self-describing envelope byte layout. Seal a value as one tenant; every other tenant fails to
// open it (the cross-tenant isolation claim, proven under the cursor). The crypto is mirrored from the
// package's node:crypto path via WebCrypto and pinned byte-identical in field-crypto-logic.test.ts —
// nothing here fetches, persists, or measures. Loaded via next/dynamic({ ssr: false }) by the carousel.
import { useEffect, useId, useRef, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  MAX_KEY_VERSION,
  type OpenResult,
  type SealResult,
  type TenantId,
  TENANTS,
  envelopeSegments,
  openEnvelope,
  rotateKeyVersion,
  sealEnvelope,
} from "./field-crypto-logic";

import styles from "./field-crypto-poke.module.css";

// A sample value (a formatted SSN — the kind of SEC/HIPAA field the row-bound path guards). Labeled
// as a sample in the UI; kept short so the rendered ciphertext hex stays legible.
const SAMPLE_PLAINTEXT = "123-45-6789";
const MAX_PLAINTEXT = 48;

function SegmentedTenant({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: TenantId;
  onChange: (t: TenantId) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={legend}>
      {TENANTS.map((t) => (
        <button
          key={t}
          type="button"
          className={styles.segment}
          aria-pressed={value === t}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export default function FieldCryptoPoke() {
  const [sealTenant, setSealTenant] = useState<TenantId>("tenant-a");
  const [keyVersion, setKeyVersion] = useState(1);
  const [plaintext, setPlaintext] = useState(SAMPLE_PLAINTEXT);
  const [goldenReplay, setGoldenReplay] = useState(true);
  const [sealed, setSealed] = useState<SealResult | null>(null);
  const [openAs, setOpenAs] = useState<TenantId>("tenant-a");
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);

  const plaintextId = useId();
  const replayId = useId();

  // The registry's CURRENT version drives the NEXT write's key version, but rotating it must NOT
  // rewrite the standing envelope (lazy re-encrypt: rotation is a version bump for new writes only,
  // registry.ts / provider.ts). So the reseal effect reads the version through a ref and does not list
  // it as a dependency — a rotate leaves `sealed` untouched; the next WRITE (a tenant/value/mode edit)
  // picks up the new version.
  const keyVersionRef = useRef(keyVersion);
  keyVersionRef.current = keyVersion;

  // Seal reactively when who/what/how changes (a "write"). Deterministic in golden-replay mode.
  useEffect(() => {
    let ignore = false;
    void sealEnvelope({
      tenant: sealTenant,
      keyVersion: keyVersionRef.current,
      plaintext,
      goldenReplay,
    }).then((result) => {
      if (!ignore) setSealed(result);
    });
    return () => {
      ignore = true;
    };
  }, [sealTenant, plaintext, goldenReplay]);

  // Open reactively whenever the envelope or the opening identity changes (the tamper affordance:
  // opening as the other tenant derives a different key and the GCM tag fails).
  useEffect(() => {
    if (sealed === null) return;
    let ignore = false;
    void openEnvelope({ wire: sealed.wire, asTenant: openAs }).then(
      (result) => {
        if (!ignore) setOpenResult(result);
      },
    );
    return () => {
      ignore = true;
    };
  }, [sealed, openAs]);

  const segments = sealed ? envelopeSegments(sealed.wire) : [];
  const versionGap = sealed !== null && keyVersion > sealed.keyVersion;

  let verdictState: VerdictState = "neutral";
  let verdictText = "Seal a value, then choose who tries to open it.";
  if (sealed && openResult) {
    if (openResult.ok) {
      verdictState = "ok";
      verdictText = `${openAs} opens it under key v${openResult.keyVersion}. Recovered: ${openResult.plaintext}`;
    } else if (openResult.reason === "auth") {
      verdictState = "fail";
      verdictText = `${openAs} derives a different key. The GCM tag fails. No plaintext.`;
    } else {
      verdictState = "fail";
      verdictText = "Malformed envelope. Nothing to open.";
    }
  }

  return (
    <PokeShell
      label="@caisson/field-crypto"
      title="Seal a value as one tenant. Watch every other tenant fail to open it."
    >
      <div className={styles.zones}>
        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Inputs</p>
          <div className={styles.row}>
            <span className={styles.controlLabel}>Seal as</span>
            <SegmentedTenant
              legend="Seal as tenant"
              value={sealTenant}
              onChange={setSealTenant}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.controlLabel}>Key version</span>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => setKeyVersion((v) => Math.max(1, v - 1))}
                disabled={keyVersion <= 1}
                aria-label="Lower key version"
              >
                -
              </button>
              <span className={styles.stepValue} aria-live="polite">
                v{keyVersion}
              </span>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => setKeyVersion((v) => rotateKeyVersion(v))}
                disabled={keyVersion >= MAX_KEY_VERSION}
                aria-label="Rotate to the next key version"
              >
                +
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.controlLabel} htmlFor={plaintextId}>
              Plaintext
            </label>
            <div className={styles.inputWrap}>
              <input
                id={plaintextId}
                className={styles.input}
                type="text"
                value={plaintext}
                maxLength={MAX_PLAINTEXT}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setPlaintext(e.target.value)}
              />
              <span className={styles.sampleTag}>sample</span>
            </div>
          </div>
          <label className={styles.toggle} htmlFor={replayId}>
            <input
              id={replayId}
              type="checkbox"
              checked={goldenReplay}
              onChange={(e) => setGoldenReplay(e.target.checked)}
            />
            Golden replay (fixed nonce). Off draws a fresh CSPRNG nonce per
            seal.
          </label>
        </div>

        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Envelope</p>
          <div className={styles.strip}>
            {segments.map((seg) => (
              <div key={seg.label} className={styles.cell}>
                <span className={styles.cellLabel}>{seg.label}</span>
                <span className={styles.cellHex}>{seg.hex}</span>
                <span className={styles.cellNote}>
                  {seg.byteLength}B{seg.note ? ` ${seg.note}` : ""}
                </span>
              </div>
            ))}
          </div>
          {versionGap && sealed ? (
            <p className={styles.rotateNote}>
              Registry rotated to v{keyVersion}. This envelope stays v
              {sealed.keyVersion} and still opens: the version travels in the
              bytes, so rotation never rewrites existing rows.
            </p>
          ) : null}
        </div>

        <div className={styles.zone}>
          <p className={styles.zoneLabel}>Open</p>
          <div className={styles.row}>
            <span className={styles.controlLabel}>Open as</span>
            <SegmentedTenant
              legend="Open as tenant"
              value={openAs}
              onChange={setOpenAs}
            />
          </div>
          <Verdict state={verdictState}>{verdictText}</Verdict>
        </div>
      </div>
    </PokeShell>
  );
}
