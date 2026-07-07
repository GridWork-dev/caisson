import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuditChainEntry, ChainVerification } from "@caisson/kernel";

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
