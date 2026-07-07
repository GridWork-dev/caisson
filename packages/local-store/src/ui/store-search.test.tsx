import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StoreSearch } from "./store-search.tsx";
import type { StoreSearchResult } from "./store-search.tsx";

const results: StoreSearchResult[] = [
  { id: "doc-alpha", text: "the quick brown fox", score: 0.0312 },
  { id: "doc-beta", text: "lazy dog", score: 0.0157 },
];

const noop = () => {};

describe("StoreSearch — SSR render (ADR-0250)", () => {
  test("renders the controlled query + ranked results", () => {
    const html = renderToStaticMarkup(
      <StoreSearch
        query="fox"
        onQueryChange={noop}
        results={results}
        total={42}
      />,
    );
    expect(html).toContain('value="fox"');
    expect(html).toContain("doc-alpha");
    expect(html).toContain("0.0312");
    expect(html).toContain("Documents in store");
  });

  test("blank query renders 'type to search', not 'no matches'", () => {
    const html = renderToStaticMarkup(
      <StoreSearch query="   " onQueryChange={noop} results={[]} />,
    );
    expect(html).toContain("Type to search");
    expect(html).not.toContain("No matches");
  });

  test("non-empty query with zero hits renders 'no matches'", () => {
    const html = renderToStaticMarkup(
      <StoreSearch query="zzz" onQueryChange={noop} results={[]} />,
    );
    expect(html).toContain("No matches");
  });
});
