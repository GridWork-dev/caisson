// T-U1 — the client verify hook + ProofPanel. Mounts a real client tree (effects run) so the async
// WebCrypto recompute (useRowVerify) and the fetch-on-open (ProofPanel) resolve. Asserts the chip enum
// comes from the CLIENT recompute (M3), that a WebCrypto failure resolves to `unverifiable` not
// `verified` (L4), and that a redacted row's link leg reads "not applicable" (CR-06).
import { act } from "react";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { renderIntoJsdom } from "@caisson-sh/testing";
import { afterEach, describe, expect, test } from "bun:test";
import { anchorChain, chainEntry } from "@caisson-sh/kernel/node";
import {
  buildRowReceipt,
  anchorSignatureEnvelopeBytes,
  type PinnedAnchorKey,
  type RowReceipt,
  type VerifyLegs,
} from "@caisson-sh/kernel/audit-verify";
import { ProofPanel, type ProofBundleResponse } from "./proof-panel.tsx";
import { useRowVerify } from "./use-row-verify.ts";

// A 2-entry chain: e1 (seq 1) is non-genesis, so a clean row classifies `verified` (not `genesis`).
const e0 = chainEntry(null, { event: "created" });
const e1 = chainEntry(e0, { event: "locked", password: "hunter2" });
const anchor2 = anchorChain([e0, e1]);
const ANCHOR_ACCOUNT = "11111111-1111-4111-8111-111111111111";
const PASS: VerifyLegs = { linkRecompute: "pass", anchorEquality: "pass" };

/** A receipt whose anchor is signed with an ephemeral Ed25519 key + its matching pinned public key —
 *  the client's WebCrypto signature leg verifies the exact core the server signed. */
function signedReceiptAndKey(): {
  receipt: RowReceipt;
  pinnedKey: PinnedAnchorKey;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signatureAnchor = {
    ...anchor2,
    sigV: 2 as const,
    sigAccountId: ANCHOR_ACCOUNT,
  };
  const sig = nodeSign(
    null,
    Buffer.from(anchorSignatureEnvelopeBytes(signatureAnchor, ANCHOR_ACCOUNT)),
    privateKey,
  ).toString("base64");
  const r = buildRowReceipt({
    entry: e1,
    anchorForRow: { ...signatureAnchor, sig, keyId: "test-anchor-key" },
    redacted: false,
    checks: PASS,
    verifiedAt: "2026-07-13T00:00:00.000Z",
    includeAnchorProvenance: true,
  });
  return {
    receipt: r,
    pinnedKey: {
      keyId: "test-anchor-key",
      publicKeySpkiBase64: publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64"),
    },
  };
}

function receipt(
  over: Partial<Parameters<typeof buildRowReceipt>[0]> = {},
): RowReceipt {
  return buildRowReceipt({
    entry: e1,
    anchorForRow: anchor2,
    redacted: false,
    checks: PASS,
    verifiedAt: "2026-07-13T00:00:00.000Z",
    ...over,
  });
}

/**
 * Flush the pending fetch + async recompute microtasks/macrotasks so React settles. An `until`
 * predicate exits early once it holds; without one, every pass runs.
 *
 * The bound is the same either way, deliberately. This used to flush a fixed 3 passes when no
 * predicate was given, which measured as exactly one pass of headroom — 2 passes suffice on an idle
 * box, 1 fails — so under the full-graph build load the WebCrypto verify chain (SPKI import +
 * subtle.verify) needed one more macrotask turn than it got and this file flaked in CI while
 * passing standalone. Flushing unconditionally costs ~2.5s across the file and cannot turn a
 * passing assertion into a failing one, since every call site asserts after `settle` returns.
 *
 * ponytail: brute-force flush, not settlement detection. Detecting "the DOM stopped changing" would
 * exit sooner but stops early in exactly the mid-chain macrotask gap that caused the flake. Swap
 * only if the 2.5s starts mattering.
 */
async function settle(until?: () => boolean): Promise<void> {
  const maxPasses = 200;
  for (let i = 0; i < maxPasses; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    if (until !== undefined && until()) return;
  }
}

function Probe({ r }: { r: RowReceipt | null }) {
  const { state } = useRowVerify(r);
  return <span data-testid="state">{state}</span>;
}

afterEach(() => {
  // Nothing global to reset here; renderIntoJsdom.unmount() restores globals per test.
});

describe("useRowVerify (M3/L4)", () => {
  test("a clean non-genesis row recomputes to `verified` (from the client, not the receipt)", async () => {
    const h = renderIntoJsdom(<Probe r={receipt()} />);
    try {
      await settle();
      expect(h.container.textContent).toBe("verified");
    } finally {
      h.unmount();
    }
  });

  test("a redacted row is `anchor-confirmed-original-not-disclosed`, never `verified`", async () => {
    const masked = receipt({
      entry: { ...e1, payload: { event: "locked", password: "[redacted]" } },
      redacted: true,
      checks: { linkRecompute: "na", anchorEquality: "pass" },
    });
    const h = renderIntoJsdom(<Probe r={masked} />);
    try {
      await settle();
      expect(h.container.textContent).toBe(
        "anchor-confirmed-original-not-disclosed",
      );
    } finally {
      h.unmount();
    }
  });

  test("a wrong anchor tip -> `tampered` (the client catches what a trusted `checks` would hide)", async () => {
    const bad = receipt({
      anchorForRow: { length: 2, tipHash: "0".repeat(64) },
    });
    const h = renderIntoJsdom(<Probe r={bad} />);
    try {
      await settle();
      expect(h.container.textContent).toBe("tampered");
    } finally {
      h.unmount();
    }
  });

  test("WebCrypto failure -> `unverifiable`, never `verified` (L4 fail-closed)", async () => {
    const subtle = crypto.subtle as unknown as {
      digest: (...a: unknown[]) => Promise<ArrayBuffer>;
    };
    const orig = subtle.digest;
    subtle.digest = () => Promise.reject(new Error("no secure context"));
    const h = renderIntoJsdom(<Probe r={receipt()} />);
    try {
      await settle();
      expect(h.container.textContent).toBe("unverifiable");
    } finally {
      subtle.digest = orig;
      h.unmount();
    }
  });
});

describe("ProofPanel (T-U1)", () => {
  test("a redacted bundle renders the link leg as 'not applicable', never a pass", async () => {
    const masked = receipt({
      entry: { ...e1, payload: { event: "locked", password: "[redacted]" } },
      redacted: true,
      checks: { linkRecompute: "na", anchorEquality: "pass" },
    });
    const fetchProof = async (): Promise<ProofBundleResponse> => ({
      receipt: masked,
      redacted: true,
      redactedPaths: ["password"],
      chainLength: 2,
    });
    const h = renderIntoJsdom(<ProofPanel seq={1} fetchProof={fetchProof} />);
    try {
      await settle();
      const text = h.container.textContent ?? "";
      expect(text).toContain("Not applicable — payload redacted");
      expect(text).toContain("Anchor confirmed");
      expect(text).toContain("1 field redacted");
    } finally {
      h.unmount();
    }
  });

  test("a server `unverifiable` verdict renders a distinct server-asserted chip", async () => {
    const fetchProof = async (): Promise<ProofBundleResponse> => ({
      state: "unverifiable",
      reason: "per-length anchor is missing for this row",
    });
    const h = renderIntoJsdom(<ProofPanel seq={5} fetchProof={fetchProof} />);
    try {
      await settle();
      const text = h.container.textContent ?? "";
      expect(text).toContain("Server-asserted");
      expect(text).toContain("per-length anchor is missing");
    } finally {
      h.unmount();
    }
  });

  describe("T-F1 seal copy (signed anchors)", () => {
    test("a `verified` row with a checked signature shows the signature-checked seal", async () => {
      const { receipt: signed, pinnedKey } = signedReceiptAndKey();
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: signed,
        redacted: false,
        chainLength: 2,
      });
      const h = renderIntoJsdom(
        <ProofPanel
          seq={1}
          fetchProof={fetchProof}
          pinnedAnchorKey={pinnedKey}
          expectedAnchorAccountId={ANCHOR_ACCOUNT}
        />,
      );
      try {
        await settle();
        const seal = h.container.querySelector('[data-testid="seal-caption"]');
        expect(seal?.textContent).toBe(
          "Verified against write-once anchor (signature-checked).",
        );
      } finally {
        h.unmount();
      }
    });

    test("a `verified` row with NO checked signature shows the honest base seal, never signature-checked (the fix: no unbacked cryptographic claim)", async () => {
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: receipt(),
        redacted: false,
        chainLength: 2,
      });
      const h = renderIntoJsdom(<ProofPanel seq={1} fetchProof={fetchProof} />);
      try {
        await settle();
        const seal = h.container.querySelector('[data-testid="seal-caption"]');
        expect(seal?.textContent).toBe("Verified against write-once anchor.");
        expect(h.container.textContent ?? "").not.toContain(
          "signature-checked",
        );
      } finally {
        h.unmount();
      }
    });

    test("a signed anchor whose signature does NOT verify against the pinned key renders `tampered`, not verified", async () => {
      // Link + anchor-equality both still pass; only the signature leg fails — so this isolates it.
      // A DIFFERENT keypair published under the SAME keyId: the real signature won't verify against it.
      const { receipt: signed } = signedReceiptAndKey();
      const { publicKey } = generateKeyPairSync("ed25519");
      const wrongKey: PinnedAnchorKey = {
        keyId: "test-anchor-key",
        publicKeySpkiBase64: publicKey
          .export({ format: "der", type: "spki" })
          .toString("base64"),
      };
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: signed,
        redacted: false,
        chainLength: 2,
      });
      const h = renderIntoJsdom(
        <ProofPanel
          seq={1}
          fetchProof={fetchProof}
          pinnedAnchorKey={wrongKey}
          expectedAnchorAccountId={ANCHOR_ACCOUNT}
        />,
      );
      try {
        await settle(() => {
          const state = h.container
            .querySelector('[data-phase="loaded"]')
            ?.getAttribute("data-state");
          return state !== undefined && state !== "pending";
        });
        const panel = h.container.querySelector('[data-phase="loaded"]');
        expect(panel?.getAttribute("data-state")).toBe("tampered");
        const seal = h.container.querySelector('[data-testid="seal-caption"]');
        expect(seal?.textContent ?? "").not.toContain("signature-checked");
      } finally {
        h.unmount();
      }
    });

    test.each([
      [
        "signature stripped",
        (anchor: RowReceipt["anchor"]): RowReceipt["anchor"] => {
          const { sig: _sig, ...unsigned } = anchor;
          return unsigned;
        },
      ],
      [
        "key id swapped",
        (anchor: RowReceipt["anchor"]): RowReceipt["anchor"] => ({
          ...anchor,
          keyId: "attacker-key",
        }),
      ],
      [
        "signature malformed",
        (anchor: RowReceipt["anchor"]): RowReceipt["anchor"] => ({
          ...anchor,
          sig: "not-base64!",
        }),
      ],
    ])(
      "%s never earns a verified state with a pinned key",
      async (_label, mutate) => {
        const { receipt: signed, pinnedKey } = signedReceiptAndKey();
        const compromised: RowReceipt = {
          ...signed,
          anchor: mutate(signed.anchor),
        };
        const fetchProof = async (): Promise<ProofBundleResponse> => ({
          receipt: compromised,
          redacted: false,
          chainLength: 2,
        });
        const h = renderIntoJsdom(
          <ProofPanel
            seq={1}
            fetchProof={fetchProof}
            pinnedAnchorKey={pinnedKey}
            expectedAnchorAccountId={ANCHOR_ACCOUNT}
          />,
        );
        try {
          await settle(() => {
            const state = h.container
              .querySelector('[data-phase="loaded"]')
              ?.getAttribute("data-state");
            return state !== undefined && state !== "pending";
          });
          expect(
            h.container
              .querySelector('[data-phase="loaded"]')
              ?.getAttribute("data-state"),
          ).not.toBe("verified");
          expect(
            h.container.querySelector('[data-testid="seal-caption"]'),
          ).toBeNull();
        } finally {
          h.unmount();
        }
      },
    );

    test("a redacted row shows the anchor-confirmed seal, never the verified seal", async () => {
      const masked = receipt({
        entry: { ...e1, payload: { event: "locked", password: "[redacted]" } },
        redacted: true,
        checks: { linkRecompute: "na", anchorEquality: "pass" },
      });
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: masked,
        redacted: true,
        redactedPaths: ["password"],
        chainLength: 2,
      });
      const h = renderIntoJsdom(<ProofPanel seq={1} fetchProof={fetchProof} />);
      try {
        await settle();
        const seal = h.container.querySelector('[data-testid="seal-caption"]');
        expect(seal?.textContent).toBe(
          "Anchor confirmed — original not disclosed.",
        );
      } finally {
        h.unmount();
      }
    });

    test("never renders impossible-to-tamper or an unqualified independent-verification claim", async () => {
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: receipt(),
        redacted: false,
        chainLength: 2,
      });
      const h = renderIntoJsdom(<ProofPanel seq={1} fetchProof={fetchProof} />);
      try {
        await settle();
        const text = h.container.textContent ?? "";
        expect(text).not.toMatch(/impossible to tamper/i);
        expect(text).not.toMatch(/\bindependently verified\b/i);
      } finally {
        h.unmount();
      }
    });
  });
});
