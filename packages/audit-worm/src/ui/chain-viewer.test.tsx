import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuditChainEntry, ChainVerification } from "@caisson-sh/kernel";

import { ChainViewer, previewPayload } from "./chain-viewer.tsx";

const entries: AuditChainEntry[] = [
  {
    seq: 0,
    prevHash: null,
    payload: { event: "created" },
    hash: "a".repeat(64),
  },
  {
    seq: 1,
    prevHash: "a".repeat(64),
    payload: { event: "locked" },
    hash: "b".repeat(64),
  },
];

describe("ChainViewer — SSR render (ADR-0250)", () => {
  test("verified chain: renders the entries + a positive verdict", () => {
    const verification: ChainVerification = { valid: true, brokenAt: null };
    const html = renderToStaticMarkup(
      <ChainViewer entries={entries} verification={verification} />,
    );
    expect(html).toContain("Verified");
    expect(html).toContain("2 entries");
    expect(html).toContain("genesis"); // entry 0's prevHash
    expect(html).toContain("created"); // payload preview
  });

  test("broken chain: surfaces the offending seq", () => {
    const verification: ChainVerification = { valid: false, brokenAt: 1 };
    const html = renderToStaticMarkup(
      <ChainViewer entries={entries} verification={verification} />,
    );
    expect(html).toContain("Broken at #1");
  });

  test("empty chain: renders the empty state, not a bare table", () => {
    const html = renderToStaticMarkup(
      <ChainViewer
        entries={[]}
        verification={{ valid: true, brokenAt: null }}
      />,
    );
    expect(html).toContain("No chain entries");
    expect(html).toContain("1 entries".replace("1", "0")); // "0 entries"
  });
});

describe("ChainViewer — per-row six-state chips + provenance (T-U2)", () => {
  test("rowStatuses render distinct per-row chips; a late break doesn't poison an early row", () => {
    const html = renderToStaticMarkup(
      <ChainViewer
        entries={entries}
        verification={{ valid: false, brokenAt: 1 }}
        rowStatuses={["verified", "tampered"]}
      />,
    );
    // Row 0 stays verified even though row 1 is tampered (per-length anchors localize tamper).
    expect(html).toContain("Verified");
    expect(html).toContain("Tampered");
  });

  test("the redaction state shows the honest chip, never `verified`", () => {
    const html = renderToStaticMarkup(
      <ChainViewer
        entries={entries}
        verification={{ valid: true, brokenAt: null }}
        rowStatuses={["genesis", "anchor-confirmed-original-not-disclosed"]}
      />,
    );
    expect(html).toContain("Anchor confirmed");
    expect(html).toContain("Chain root");
  });

  test("anchorProvenance renders the write-once provenance header line", () => {
    const html = renderToStaticMarkup(
      <ChainViewer
        entries={entries}
        verification={{ valid: true, brokenAt: null }}
        anchorProvenance={{ length: 2, retainUntil: "2033-07-13" }}
      />,
    );
    expect(html).toContain("Chain anchored at length 2 in write-once storage");
    expect(html).toContain("retained until 2033-07-13");
  });

  test("without the new props it renders identically (backward compatible — no status/proof column)", () => {
    const html = renderToStaticMarkup(
      <ChainViewer
        entries={entries}
        verification={{ valid: true, brokenAt: null }}
      />,
    );
    expect(html).not.toContain("Status");
    expect(html).not.toContain("write-once storage");
  });
});

describe("previewPayload — bounded one-line JSON", () => {
  test("truncates past the max with an ellipsis", () => {
    const long = previewPayload({ note: "x".repeat(200) }, 40);
    expect(long.length).toBe(40);
    expect(long.endsWith("…")).toBe(true);
  });
  test("short payloads pass through verbatim", () => {
    expect(previewPayload({ a: 1 })).toBe('{"a":1}');
  });
});
