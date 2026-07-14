// T-U1 — the client verify hook + ProofPanel. Mounts a real client tree (effects run) so the async
// WebCrypto recompute (useRowVerify) and the fetch-on-open (ProofPanel) resolve. Asserts the chip enum
// comes from the CLIENT recompute (M3), that a WebCrypto failure resolves to `unverifiable` not
// `verified` (L4), and that a redacted row's link leg reads "not applicable" (CR-06).
import { act } from "react";
import { renderIntoJsdom } from "@caisson/testing";
import { afterEach, describe, expect, test } from "bun:test";
import { anchorChain, chainEntry } from "@caisson/kernel";
import {
  buildRowReceipt,
  type RowReceipt,
  type VerifyLegs,
} from "@caisson/kernel/audit-verify";
import { ProofPanel, type ProofBundleResponse } from "./proof-panel.tsx";
import { useRowVerify } from "./use-row-verify.ts";

// A 2-entry chain: e1 (seq 1) is non-genesis, so a clean row classifies `verified` (not `genesis`).
const e0 = chainEntry(null, { event: "created" });
const e1 = chainEntry(e0, { event: "locked", password: "hunter2" });
const anchor2 = anchorChain([e0, e1]);
const PASS: VerifyLegs = { linkRecompute: "pass", anchorEquality: "pass" };

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

/** Flush the pending fetch + async recompute microtasks/macrotasks so React settles. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- deliberately sequential settle passes
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
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

  describe("T-F1 seal copy (GATE-1 signed anchors, ADR-0344)", () => {
    test("a healthy `verified` row shows the signature-checked seal caption", async () => {
      const fetchProof = async (): Promise<ProofBundleResponse> => ({
        receipt: receipt(),
        redacted: false,
        chainLength: 2,
      });
      const h = renderIntoJsdom(<ProofPanel seq={1} fetchProof={fetchProof} />);
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
