import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailList } from "./detail-list";

describe("DetailList", () => {
  test("renders a dl of term/value rows", () => {
    const html = renderToStaticMarkup(
      <DetailList
        items={[
          { term: "Status", description: "Active" },
          { term: "Grant id", description: "grt_123", mono: true },
        ]}
      />,
    );
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    expect(html).toContain("Status");
    expect(html).toContain("Active");
    expect(html).toContain("data-mono");
  });

  test("a row with href renders its value as a link", () => {
    const html = renderToStaticMarkup(
      <DetailList
        items={[{ term: "Pull request", description: "132", href: "/pr/132" }]}
      />,
    );
    expect(html).toMatch(/<a class="cs-detail__link" href="\/pr\/132">/);
  });

  test("columns layout sets the data hook", () => {
    const html = renderToStaticMarkup(
      <DetailList layout="columns" items={[{ term: "a", description: "b" }]} />,
    );
    expect(html).toContain('data-layout="columns"');
  });
});
