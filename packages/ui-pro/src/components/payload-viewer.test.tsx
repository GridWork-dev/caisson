import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PayloadViewer } from "./payload-viewer";

const payload = {
  event: "purchase.completed",
  amountCents: 12900,
  ok: true,
  credentials: { token: "sk_live_secret" },
};

describe("PayloadViewer (initial render)", () => {
  test("renders a labelled, typed tree with the top level expanded", () => {
    const html = renderToStaticMarkup(
      <PayloadViewer value={payload} ariaLabel="Webhook body" />,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Webhook body"');
    expect(html).toContain('aria-expanded="true"'); // root open at depth 0
    expect(html).toContain("purchase.completed");
    expect(html).toContain("12900");
    expect(html).toContain('aria-label="Copy redacted payload"');
  });

  test("masks secret-bearing keys in the tree and never emits the secret", () => {
    const html = renderToStaticMarkup(
      <PayloadViewer value={payload} defaultExpandDepth={5} />,
    );
    expect(html).toContain('aria-label="redacted"');
    expect(html).toContain("[redacted]");
    expect(html).not.toContain("sk_live_secret");
  });

  test("a custom redact set is honoured", () => {
    const html = renderToStaticMarkup(
      <PayloadViewer
        value={{ ssn: "123-45-6789", name: "Ada" }}
        redactKeys={["ssn"]}
        defaultExpandDepth={5}
      />,
    );
    expect(html).not.toContain("123-45-6789");
    expect(html).toContain("Ada");
  });
});
