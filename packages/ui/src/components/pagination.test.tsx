import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Pagination, paginationRange } from "./pagination";

describe("paginationRange", () => {
  test("lists every page when the count fits the window", () => {
    expect(paginationRange(0, 4, 5)).toEqual([0, 1, 2, 3]);
  });

  test("windows around the current page with gap sentinels + end anchors", () => {
    const r = paginationRange(10, 20, 5);
    expect(r[0]).toBe(0); // first anchor
    expect(r[r.length - 1]).toBe(19); // last anchor
    expect(r).toContain(-1); // at least one elided gap
    expect(r).toContain(10); // the current page is in the window
  });

  test("returns [] for a non-positive page count", () => {
    expect(paginationRange(0, 0)).toEqual([]);
  });
});

describe("Pagination render", () => {
  test("marks the current page and disables Prev at the start", () => {
    const html = renderToStaticMarkup(<Pagination page={0} pageCount={5} />);
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Page 1"');
    // Prev disabled at page 0, Next enabled.
    expect(html).toMatch(/aria-label="Previous page"[^>]*disabled/);
    expect(html).not.toMatch(/aria-label="Next page"[^>]*disabled/);
  });

  test("disables Next on the last page", () => {
    const html = renderToStaticMarkup(<Pagination page={4} pageCount={5} />);
    expect(html).toMatch(/aria-label="Next page"[^>]*disabled/);
  });
});
