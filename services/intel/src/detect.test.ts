import { describe, expect, test } from "bun:test";
import {
  contentHash,
  extractTableRows,
  latestAtomTag,
  newItems,
  snapshotOf,
  textDelta,
} from "./detect.ts";

describe("contentHash", () => {
  test("is stable across insignificant whitespace changes", () => {
    expect(contentHash("hello   world")).toBe(contentHash("hello world"));
    expect(contentHash(" hello world \n")).toBe(contentHash("hello world"));
  });

  test("differs when content actually changes", () => {
    expect(contentHash("v1")).not.toBe(contentHash("v2"));
  });
});

describe("latestAtomTag", () => {
  test("reads the tag out of the newest entry's releases/tag link", () => {
    const xml = `<feed>
      <entry>
        <id>tag:github.com,2008:Repository/1/v1.2.0</id>
        <link href="https://github.com/usnistgov/OSCAL/releases/tag/v1.2.0"/>
      </entry>
      <entry>
        <id>tag:github.com,2008:Repository/1/v1.1.0</id>
        <link href="https://github.com/usnistgov/OSCAL/releases/tag/v1.1.0"/>
      </entry>
    </feed>`;
    expect(latestAtomTag(xml)).toBe("v1.2.0");
  });

  test("falls back to the <id> suffix when no releases/tag link is present", () => {
    const xml = `<feed><entry><id>tag:github.com,2008:Repository/1/v3.0.0</id></entry></feed>`;
    expect(latestAtomTag(xml)).toBe("v3.0.0");
  });

  test("returns null for an empty feed", () => {
    expect(latestAtomTag("<feed></feed>")).toBeNull();
  });
});

describe("extractTableRows", () => {
  test("extracts non-header row text, tags stripped", () => {
    const html = `<table>
      <tr><th>Name</th><th>Date</th></tr>
      <tr><td>Acme Health</td><td>2026-01-01</td></tr>
      <tr><td>  Beta Corp  </td><td>2026-02-02</td></tr>
    </table>`;
    expect(extractTableRows(html)).toEqual([
      "Acme Health 2026-01-01",
      "Beta Corp 2026-02-02",
    ]);
  });

  test("drops empty rows", () => {
    expect(extractTableRows("<table><tr></tr></table>")).toEqual([]);
  });
});

describe("newItems", () => {
  test("returns only items absent from previous", () => {
    expect(newItems(["a", "b"], ["b", "c", "d"])).toEqual(["c", "d"]);
  });

  test("empty previous means everything is new", () => {
    expect(newItems([], ["a"])).toEqual(["a"]);
  });
});

describe("snapshotOf", () => {
  test("normalizes whitespace and hard-caps length", () => {
    expect(snapshotOf("a   b\n\tc")).toBe("a b c");
    expect(snapshotOf("x".repeat(20_000)).length).toBe(16_000);
  });
});

describe("textDelta", () => {
  test("with no prior snapshot, emits a current-only excerpt (no before)", () => {
    const delta = textDelta("the page now reads this", undefined);
    expect(delta.currentExcerpt).toBe("the page now reads this");
    expect(delta.previousExcerpt).toBeUndefined();
  });

  test("extracts the changed region with context, not the whole page", () => {
    const head = "Article 1. This Regulation applies from ";
    const tail = " across all member states of the Union.";
    const delta = textDelta(
      `${head}2 August 2026${tail}`,
      `${head}2 August 2025${tail}`,
    );
    // Both excerpts are present and centered on the divergence...
    expect(delta.previousExcerpt).toContain("2 August 2025");
    expect(delta.currentExcerpt).toContain("2 August 2026");
    // ...and the current excerpt does not still claim the old value.
    expect(delta.currentExcerpt).not.toContain("2 August 2025");
  });

  test("strips embedded URLs so a finding never carries an unfetched host (grounding)", () => {
    const delta = textDelta(
      "see the guidance at https://other.example.com/x now",
      "see the guidance at https://other.example.com/x before",
    );
    expect(delta.currentExcerpt).not.toContain("http");
    expect(delta.currentExcerpt).toContain("[link]");
  });

  test("a change beyond the captured window degrades to a current-only excerpt", () => {
    const prefix = "z".repeat(16_050); // exceeds SNAPSHOT_MAX_CHARS
    const delta = textDelta(`${prefix}NEW`, snapshotOf(`${prefix}OLD`));
    // The divergence is past the 16k cap, so the two capped snapshots are identical — no diffable
    // region; fall back to a current-only excerpt (the composer keeps its honest hash-only notice).
    expect(delta.previousExcerpt).toBeUndefined();
    expect(delta.currentExcerpt.length).toBeGreaterThan(0);
  });
});
