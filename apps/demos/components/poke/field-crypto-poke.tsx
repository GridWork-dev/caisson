"use client";

// Flagship F1 — the @caisson-sh/field-crypto "envelope bench" poke (ADR-0378 lock 2, kimi spec F1).
// A self-contained, in-browser run of the SHIPPED field-crypto primitive: HKDF-SHA256
// per-tenant key derivation feeding AES-256-GCM with the real row-bound AAD 4-tuple, rendered as the
// real self-describing envelope byte layout. Seal a value as one tenant; every other tenant fails to
// open it (the cross-tenant isolation claim, proven under the cursor).
//
// The crypto is the PACKAGE'S OWN, imported from @caisson-sh/field-crypto/browser (ADR-0396) — the
// hand-ported mirror this file used to drive (field-crypto-logic.ts) is deleted, and the package's
// browser entry now ships those WebCrypto twins as supported surface, byte-parity-pinned against the
// node path and the __golden__ fixtures in packages/field-crypto/src/browser-parity.test.ts.
// What stays here is what SHOULD be local to a demo: sample key material, the tenant list, the
// seal/open composition, and the byte-strip presentation. Nothing here fetches, persists, or
// measures. Loaded via next/dynamic({ ssr: false }) by the carousel.
import { useEffect, useId, useRef, useState } from "react";
import {
  ALG_AES_256_GCM,
  MAX_KEY_VERSION,
  NONCE_BYTES,
  TAG_BYTES,
  TENANT_KEY_BYTES,
  aesGcmOpenAsync,
  aesGcmSealAsync,
  buildAadBytes,
  deriveTenantKeyAsync,
  nextKeyVersion,
  parseEnvelopeBytes,
  serializeEnvelopeBytes,
} from "@caisson-sh/field-crypto/browser";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";

import styles from "./field-crypto-poke.module.css";

// --- sample inputs (labeled as samples in the UI). The master/salt are the SAME non-secret KAT
//     vectors the package's own tests use (derive.test.ts), so the derived keys equal the shipped
//     golden vectors in packages/field-crypto/src/__golden__/derive-kat.json. Never real key material.
export const DEMO_MASTER_KEY: Uint8Array = new Uint8Array(
  TENANT_KEY_BYTES,
).fill(0x11);
export const DEMO_SALT: Uint8Array = new Uint8Array(TENANT_KEY_BYTES).fill(
  0x22,
);
/** A sample column identity (bound into AAD so a ciphertext cannot move to another column). */
export const DEMO_COLUMN_CONTEXT = "patient.ssn";
/** A sample stable row PK — the row-bound 4-tuple AAD path (encrypt-field.ts). */
export const DEMO_ROW_ID = "00000000-0000-4000-8000-000000000001";
export const TENANTS = ["tenant-a", "tenant-b"] as const;
export type TenantId = (typeof TENANTS)[number];

// A sample value (a formatted SSN — the kind of SEC/HIPAA field the row-bound path guards). Labeled
// as a sample in the UI; kept short so the rendered ciphertext hex stays legible.
const SAMPLE_PLAINTEXT = "123-45-6789";
const MAX_PLAINTEXT = 48;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Display-only byte formatting for the strip readout. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export interface SealResult {
  readonly wire: string;
  readonly sealedBy: TenantId;
  readonly keyVersion: number;
}

export type OpenFailReason = "malformed" | "auth";

export type OpenResult =
  | {
      readonly ok: true;
      readonly plaintext: string;
      readonly keyVersion: number;
    }
  | { readonly ok: false; readonly reason: OpenFailReason };

/**
 * Seal `plaintext` for `tenant` under `keyVersion` as a row-bound envelope — the same four package
 * calls `encryptField` makes on the server (derive → 4-tuple AAD → AES-256-GCM → envelope).
 * The package draws a fresh CSPRNG nonce per seal, exactly like the shipped node cipher. Callers do
 * not get a nonce override: the demo models the safe production surface rather than a KAT seam.
 */
export async function sealEnvelope(input: {
  tenant: TenantId;
  keyVersion: number;
  plaintext: string;
}): Promise<SealResult> {
  const key = await deriveTenantKeyAsync(
    DEMO_MASTER_KEY,
    DEMO_SALT,
    input.keyVersion,
    input.tenant,
  );
  const aad = buildAadBytes(
    input.tenant,
    input.keyVersion,
    DEMO_COLUMN_CONTEXT,
    DEMO_ROW_ID,
  );
  const sealed = await aesGcmSealAsync(
    key,
    textEncoder.encode(input.plaintext),
    aad,
  );
  const wire = serializeEnvelopeBytes({
    algId: ALG_AES_256_GCM,
    keyVersion: input.keyVersion,
    ...sealed,
  });
  return { wire, sealedBy: input.tenant, keyVersion: input.keyVersion };
}

/**
 * Open `wire` as `asTenant`. The key version comes FROM the envelope (self-describing), so a value
 * sealed under an older version still opens after rotation. Opening as the wrong tenant derives a
 * different key and the GCM tag fails to authenticate → { ok: false, reason: "auth" }: the shipped
 * cross-tenant isolation claim, proven under the cursor. Fail-closed, never a wrong-plaintext read.
 */
export async function openEnvelope(input: {
  wire: string;
  asTenant: TenantId;
}): Promise<OpenResult> {
  let env: ReturnType<typeof parseEnvelopeBytes>;
  try {
    env = parseEnvelopeBytes(input.wire);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  try {
    const key = await deriveTenantKeyAsync(
      DEMO_MASTER_KEY,
      DEMO_SALT,
      env.keyVersion,
      input.asTenant,
    );
    const aad = buildAadBytes(
      input.asTenant,
      env.keyVersion,
      DEMO_COLUMN_CONTEXT,
      DEMO_ROW_ID,
    );
    const plain = await aesGcmOpenAsync(key, env, aad);
    return {
      ok: true,
      plaintext: textDecoder.decode(plain),
      keyVersion: env.keyVersion,
    };
  } catch {
    return { ok: false, reason: "auth" };
  }
}

export interface EnvelopeSegment {
  readonly label: string;
  readonly hex: string;
  readonly byteLength: number;
  readonly note?: string;
}

/**
 * Break an envelope into its labeled byte segments for the ByteStrip readout — the real on-disk
 * layout from envelope.ts: [ver 1B | alg 1B | key_version u16 BE | nonce 12B | ciphertext | tag 16B].
 */
export function envelopeSegments(wire: string): EnvelopeSegment[] {
  const env = parseEnvelopeBytes(wire);
  return [
    {
      label: "ver",
      hex: env.formatVersion.toString(16).padStart(2, "0"),
      byteLength: 1,
      note: "FORMAT_VERSION 0x01",
    },
    {
      label: "alg",
      hex: env.algId.toString(16).padStart(2, "0"),
      byteLength: 1,
      note: "ALG_AES_256_GCM 0x01",
    },
    {
      label: "key_version",
      hex: env.keyVersion.toString(16).padStart(4, "0"),
      byteLength: 2,
      note: `u16 BE = ${env.keyVersion}`,
    },
    {
      label: "nonce",
      hex: bytesToHex(env.nonce),
      byteLength: NONCE_BYTES,
      note: "NONCE_BYTES 12",
    },
    {
      label: "ciphertext",
      hex: bytesToHex(env.ciphertext),
      byteLength: env.ciphertext.length,
    },
    {
      label: "tag",
      hex: bytesToHex(env.tag),
      byteLength: TAG_BYTES,
      note: "TAG_BYTES 16",
    },
  ];
}

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
  const [sealed, setSealed] = useState<SealResult | null>(null);
  const [openAs, setOpenAs] = useState<TenantId>("tenant-a");
  const [openResult, setOpenResult] = useState<OpenResult | null>(null);

  const plaintextId = useId();

  // The registry's CURRENT version drives the NEXT write's key version, but rotating it must NOT
  // rewrite the standing envelope (lazy re-encrypt: rotation is a version bump for new writes only,
  // registry.ts / provider.ts). So the reseal effect reads the version through a ref and does not list
  // it as a dependency — a rotate leaves `sealed` untouched; the next WRITE (a tenant/value/mode edit)
  // picks up the new version.
  const keyVersionRef = useRef(keyVersion);
  keyVersionRef.current = keyVersion;

  // Seal reactively when who/what changes (a "write"), always with a fresh package-generated nonce.
  useEffect(() => {
    let ignore = false;
    void sealEnvelope({
      tenant: sealTenant,
      keyVersion: keyVersionRef.current,
      plaintext,
    }).then((result) => {
      if (!ignore) setSealed(result);
    });
    return () => {
      ignore = true;
    };
  }, [sealTenant, plaintext]);

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
      label="@caisson-sh/field-crypto"
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
                onClick={() => setKeyVersion((v) => nextKeyVersion(v))}
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
          <p className={styles.toggle}>
            Every seal draws a fresh CSPRNG nonce inside the package; callers
            cannot supply or reuse one.
          </p>
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
