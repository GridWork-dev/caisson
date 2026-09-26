"use client";

// Client-side per-row re-verification hook (T-U1, M3/L4). Runs the pure kernel checks against the
// proof bundle the server SHIPPED — never trusting the receipt's `checks` block. The chip enum this
// returns is the CLIENT's own recompute (M3): `checks`/`verifiedAt` on the receipt are display-only
// and never feed the state decision. Any failure to recompute (WebCrypto absent in a non-secure
// context, a canonicalization/digest exception) resolves AWAY from "verified" — to `unverifiable`,
// never into a false pass (L4).
import { useEffect, useState } from "react";
import {
  classifyRowState,
  verifyEntryAgainstAnchor,
  type PinnedAnchorKey,
  type RowReceipt,
  type RowState,
  type VerifyLegs,
} from "@caisson-sh/kernel/audit-verify";

export interface RowVerifyResult {
  /** The client-recomputed state (never read off the receipt's server-supplied `checks`). */
  readonly state: RowState;
  /** The two legs from the client recompute, or null while pending / on a recompute failure. */
  readonly legs: VerifyLegs | null;
}

/**
 * Re-run the per-row legs from a receipt's RAW material, client-side. Returns `pending` until the
 * async WebCrypto recompute resolves. `null` receipt (not yet fetched) stays `pending`.
 *
 * `pinnedKey` is the anchor-signing public key, supplied OUT-OF-BAND (the app's
 * injected config — never the proof response). When present and matching the anchor's `keyId`, the
 * signature leg runs; the "(signature-checked)" seal is earned ONLY when that leg passes. Absent → the
 * signature leg is `na` and the panel shows the honest base seal, never the strong one.
 */
export function useRowVerify(
  receipt: RowReceipt | null,
  pinnedKey?: PinnedAnchorKey,
  expectedAccountId?: string,
): RowVerifyResult {
  const [result, setResult] = useState<RowVerifyResult>({
    state: "pending",
    legs: null,
  });

  useEffect(() => {
    if (receipt === null) {
      setResult({ state: "pending", legs: null });
      return;
    }
    let live = true;
    void (async () => {
      try {
        // Rebuild the anchor from the receipt's public provenance so the signature leg can reconstruct
        // the exact signed core bytes (exact-optional discipline — only carry a field that is present).
        const anchor: {
          length: number;
          tipHash: string;
          genesisHash?: string;
          sig?: string;
          keyId?: string;
          sigV?: 2;
          sigAccountId?: string;
        } = { length: receipt.anchor.length, tipHash: receipt.anchor.tipHash };
        if (receipt.anchor.genesisHash !== undefined) {
          anchor.genesisHash = receipt.anchor.genesisHash;
        }
        if (receipt.anchor.sig !== undefined) anchor.sig = receipt.anchor.sig;
        if (receipt.anchor.keyId !== undefined) {
          anchor.keyId = receipt.anchor.keyId;
        }
        if (receipt.anchor.sigV !== undefined) {
          anchor.sigV = receipt.anchor.sigV;
        }
        if (receipt.anchor.sigAccountId !== undefined) {
          anchor.sigAccountId = receipt.anchor.sigAccountId;
        }
        const opts: {
          redacted?: boolean;
          pinnedKey?: PinnedAnchorKey;
          expectedAccountId?: string;
        } = {
          redacted: receipt.redacted,
        };
        if (pinnedKey !== undefined) opts.pinnedKey = pinnedKey;
        if (expectedAccountId !== undefined) {
          opts.expectedAccountId = expectedAccountId;
        }
        const legs = await verifyEntryAgainstAnchor(
          {
            seq: receipt.seq,
            prevHash: receipt.raw.prevHash,
            payload: receipt.raw.payload,
            hash: receipt.hash,
          },
          anchor,
          opts,
        );
        const state = classifyRowState(legs, {
          redacted: receipt.redacted,
          isGenesis: receipt.seq === 0,
          requireSignature: pinnedKey !== undefined,
        });
        if (live) setResult({ state, legs });
      } catch {
        // L4 — WebCrypto unavailable or a digest/canonicalization threw: fail to `unverifiable`, never
        // swallow into a pass. Encoded in the state machine so a refactor can't collapse it to default.
        if (live) setResult({ state: "unverifiable", legs: null });
      }
    })();
    return () => {
      live = false;
    };
  }, [receipt, pinnedKey, expectedAccountId]);

  return result;
}
