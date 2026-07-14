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
  type RowReceipt,
  type RowState,
  type VerifyLegs,
} from "@caisson/kernel/audit-verify";

export interface RowVerifyResult {
  /** The client-recomputed state (never read off the receipt's server-supplied `checks`). */
  readonly state: RowState;
  /** The two legs from the client recompute, or null while pending / on a recompute failure. */
  readonly legs: VerifyLegs | null;
}

/**
 * Re-run the two per-row legs from a receipt's RAW material, client-side. Returns `pending` until the
 * async WebCrypto recompute resolves. `null` receipt (not yet fetched) stays `pending`.
 */
export function useRowVerify(receipt: RowReceipt | null): RowVerifyResult {
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
        const legs = await verifyEntryAgainstAnchor(
          {
            seq: receipt.seq,
            prevHash: receipt.raw.prevHash,
            payload: receipt.raw.payload,
            hash: receipt.hash,
          },
          { length: receipt.anchor.length, tipHash: receipt.anchor.tipHash },
          { redacted: receipt.redacted },
        );
        const state = classifyRowState(legs, {
          redacted: receipt.redacted,
          isGenesis: receipt.seq === 0,
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
  }, [receipt]);

  return result;
}
