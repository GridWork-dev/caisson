import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildChain } from "@caisson/kernel";
import type { RowState } from "@caisson/kernel/audit-verify";
import { AuditChainClient } from "./audit-chain-client.tsx";

const STATES: readonly RowState[] = [
  "genesis",
  "verified",
  "anchor-confirmed-original-not-disclosed",
  "tampered",
  "unverifiable",
  "pending",
];

describe("AuditChainClient", () => {
  test("renders all six server-computed chips, lazy proof controls, and anchor provenance", () => {
    const entries = buildChain(
      STATES.map((state, index) => ({ state, index })),
    );
    const html = renderToStaticMarkup(
      <AuditChainClient
        accountId="buyer_account_01"
        entries={entries}
        verification={{ valid: true, brokenAt: null }}
        rowStatuses={STATES}
        anchorProvenance={{
          length: entries.length,
          retainUntil: "2033-07-25T00:00:00.000Z",
        }}
        redactedPaths={["credentials.token"]}
      />,
    );

    for (const label of [
      "Chain root",
      "Verified",
      "Anchor confirmed",
      "Tampered",
      "Unverifiable",
      "Checking",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Chain anchored at length 6");
    expect(html).toContain("retained until 2033-07-25T00:00:00.000Z");
    expect(html.match(/>View</g)?.length).toBe(6);
  });

  test("offers the logical evidence-pack export and one distinct-path redaction count", () => {
    const entries = buildChain([{ event: "first" }]);
    const html = renderToStaticMarkup(
      <AuditChainClient
        accountId="buyer_account_01"
        entries={entries}
        verification={{ valid: true, brokenAt: null }}
        rowStatuses={["genesis"]}
        anchorProvenance={{ length: 1 }}
        redactedPaths={["credentials.token", "credentials.token"]}
      />,
    );

    expect(html).toContain(
      'href="/api/admin/audit/export?account=buyer_account_01"',
    );
    expect(html).toContain("Export logical evidence pack");
    expect(html).toContain("1 distinct redacted key path");
    expect(html).not.toContain("2 distinct redacted");
  });
});
