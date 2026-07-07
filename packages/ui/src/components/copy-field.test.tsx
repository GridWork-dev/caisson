import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CopyField } from "./copy-field";

describe("CopyField", () => {
  test("renders a read-only labelled value with a copy button", () => {
    const html = renderToStaticMarkup(
      <CopyField value="sk_live_abc123" label="API key" />,
    );
    expect(html).toContain('aria-label="API key"');
    expect(html).toContain('value="sk_live_abc123"');
    expect(html).toContain("readOnly");
    expect(html).toContain('aria-label="Copy API key"');
    expect(html).toContain('role="status"');
  });

  test("secret masks the value as a password field", () => {
    const html = renderToStaticMarkup(
      <CopyField value="topsecret" label="Token" secret />,
    );
    expect(html).toContain('type="password"');
  });

  test("mono is on by default and can be turned off", () => {
    expect(renderToStaticMarkup(<CopyField value="x" label="l" />)).toContain(
      "data-mono",
    );
    expect(
      renderToStaticMarkup(<CopyField value="x" label="l" mono={false} />),
    ).not.toContain("data-mono");
  });
});
