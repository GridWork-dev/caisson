import { describe, expect, test } from "bun:test";
import {
  contentHash,
  extractTableRows,
  latestAtomTag,
  newItems,
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
