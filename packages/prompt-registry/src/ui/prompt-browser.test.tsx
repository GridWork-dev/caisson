import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PromptBrowser, firstMessagePreview } from "./prompt-browser.tsx";
import type { PromptVersion } from "../registry.ts";

const versions: PromptVersion[] = [
  {
    id: "pv-1",
    accountId: "acct-1",
    name: "greeting",
    version: 1,
    supersedesId: null,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello to {{name}} warmly and briefly." },
    ],
    varSpec: { name: "string" },
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "pv-2",
    accountId: "acct-1",
    name: "summary",
    version: 3,
    supersedesId: "pv-x",
    messages: [{ role: "user", content: "Summarize the text." }],
    varSpec: {},
    createdAt: "2026-07-02T00:00:00.000Z",
  },
];

describe("PromptBrowser — SSR render (ADR-0250)", () => {
  test("renders versions with the distinct-name / total-version split", () => {
    const html = renderToStaticMarkup(<PromptBrowser versions={versions} />);
    expect(html).toContain("greeting");
    expect(html).toContain("v3"); // summary version
    expect(html).toContain("system"); // role chip
    expect(html).toContain("Prompts"); // distinct-name stat
    expect(html).toContain("Versions");
  });

  test("empty registry renders the empty state", () => {
    const html = renderToStaticMarkup(<PromptBrowser versions={[]} />);
    expect(html).toContain("No prompts registered");
  });
});

describe("firstMessagePreview — bounded one-line preview", () => {
  test("collapses whitespace and truncates past the max", () => {
    expect(firstMessagePreview(versions[0]!, 20)).toBe("You are a helpful a…");
  });
  test("no messages reads as a dash", () => {
    expect(firstMessagePreview({ ...versions[0]!, messages: [] })).toBe("—");
  });
});
