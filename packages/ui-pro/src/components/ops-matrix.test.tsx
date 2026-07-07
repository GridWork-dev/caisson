import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { OpsMatrix } from "./ops-matrix";

describe("OpsMatrix", () => {
  test("renders a labelled coverage grid with tri-state + note cells", () => {
    const html = renderToStaticMarkup(
      <OpsMatrix
        rowHeader="Control"
        caption="Control coverage by role"
        columns={["Admin", "Member"]}
        rows={[
          { label: "Read audit log", cells: [true, { state: "partial" }] },
          { label: "Revoke grant", cells: [true, false] },
          { label: "Retention", cells: ["30d", "—"] },
        ]}
      />,
    );
    expect(html).toContain("Control coverage by role");
    expect(html).toContain(">Control<");
    expect(html).toContain('scope="row"');
    expect(html).toContain('data-state="yes"');
    expect(html).toContain('data-state="partial"');
    expect(html).toContain('data-state="no"');
    expect(html).toContain('data-state="note"');
    // glyphs are labelled, not the only signal
    expect(html).toContain('aria-label="covered"');
    expect(html).toContain('aria-label="partial coverage"');
    expect(html).toContain("30d");
  });

  test("sticky is on by default and can be disabled", () => {
    expect(
      renderToStaticMarkup(
        <OpsMatrix columns={["A"]} rows={[{ label: "x", cells: [true] }]} />,
      ),
    ).toContain("data-sticky");
    expect(
      renderToStaticMarkup(
        <OpsMatrix
          sticky={false}
          columns={["A"]}
          rows={[{ label: "x", cells: [true] }]}
        />,
      ),
    ).not.toContain("data-sticky");
  });
});
