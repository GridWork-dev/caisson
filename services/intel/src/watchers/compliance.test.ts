import { describe, expect, test } from "bun:test";
import { detectComplianceChanges, detectHipaaBreaches } from "./compliance.ts";
import type { FetchedSource } from "./compliance.ts";

const ATOM_SOURCE: FetchedSource["source"] = {
  key: "oscal",
  label: "NIST OSCAL",
  url: "https://github.com/usnistgov/OSCAL/releases.atom",
  mode: "atom",
};

const HASH_SOURCE: FetchedSource["source"] = {
  key: "eu-ai-act-eurlex",
  label: "EU AI Act (EUR-Lex)",
  url: "https://eur-lex.europa.eu/x",
  mode: "hash",
};

const ATOM_V2 = `<feed><entry><link href="https://github.com/usnistgov/OSCAL/releases/tag/v2.0.0"/></entry></feed>`;

describe("detectComplianceChanges", () => {
  test("first observation records a silent baseline, no finding", () => {
    const { findings, nextState } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {},
    );
    expect(findings).toEqual([]);
    expect(nextState["compliance:oscal:version"]).toBe("v2.0.0");
  });

  test("a version bump against stored state emits a framework_release finding", () => {
    const { findings } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {
        "compliance:oscal:version": "v1.0.0",
      },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("framework_release");
    expect(findings[0]?.title).toContain("v2.0.0");
  });

  test("no change against stored state emits nothing", () => {
    const { findings } = detectComplianceChanges(
      [{ source: ATOM_SOURCE, text: ATOM_V2 }],
      {
        "compliance:oscal:version": "v2.0.0",
      },
    );
    expect(findings).toEqual([]);
  });

  test("a content-hash source emits framework_change on a hash mismatch", () => {
    const { findings } = detectComplianceChanges(
      [{ source: HASH_SOURCE, text: "new content" }],
      { "compliance:eu-ai-act-eurlex:hash": "deadbeef" },
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("framework_change");
  });
});

describe("detectHipaaBreaches", () => {
  const html = `<table>
    <tr><th>Name</th></tr>
    <tr><td>Acme Health</td></tr>
    <tr><td>Beta Corp</td></tr>
  </table>`;

  test("first observation records a baseline, no finding", () => {
    const { findings } = detectHipaaBreaches(html, {});
    expect(findings).toEqual([]);
  });

  test("new rows since the stored baseline emit a hipaa_breach finding", () => {
    const baseline = detectHipaaBreaches(
      `<table><tr><th>Name</th></tr><tr><td>Acme Health</td></tr></table>`,
      {},
    ).nextState;
    const { findings } = detectHipaaBreaches(html, baseline);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.payload).toMatchObject({ newCount: 1 });
  });

  test("no new rows emits nothing", () => {
    const baseline = detectHipaaBreaches(html, {}).nextState;
    const { findings } = detectHipaaBreaches(html, baseline);
    expect(findings).toEqual([]);
  });
});
