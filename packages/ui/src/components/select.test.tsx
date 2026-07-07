import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Select } from "./select";

const options = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending", disabled: true },
];

describe("Select", () => {
  test("renders a native select with the given options", () => {
    const html = renderToStaticMarkup(
      <Select
        options={options}
        aria-label="Sort direction"
        defaultValue="asc"
      />,
    );
    expect(html).toContain("<select");
    expect(html).toContain('aria-label="Sort direction"');
    expect(html).toContain(">Ascending<");
    expect(html).toMatch(/<option value="desc" disabled/);
  });

  test("placeholder renders a disabled empty option", () => {
    const html = renderToStaticMarkup(
      <Select options={options} placeholder="Choose…" aria-label="x" />,
    );
    expect(html).toMatch(/<option value="" disabled[^>]*>Choose/);
  });

  test("invalid sets aria-invalid + the data hook", () => {
    const html = renderToStaticMarkup(
      <Select options={options} invalid aria-label="x" />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("data-invalid");
  });
});
