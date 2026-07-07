import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_REDACT_KEYS } from "../lib/redact";
import { DiffViewer } from "./diff-viewer";

describe("DiffViewer", () => {
  test("text diff renders add/remove ops with a layout toggle", () => {
    const html = renderToStaticMarkup(
      <DiffViewer kind="text" before={"a\nb\nc"} after={"a\nB\nc"} />,
    );
    expect(html).toContain('data-op="add"');
    expect(html).toContain('data-op="remove"');
    expect(html).toContain('aria-pressed="true"'); // the active view button
  });

  test("json diff shows changed key paths", () => {
    const html = renderToStaticMarkup(
      <DiffViewer
        kind="json"
        before={{ seats: 10, region: "us" }}
        after={{ seats: 12, region: "us" }}
      />,
    );
    expect(html).toContain("$.seats");
    expect(html).toContain("12");
  });

  test("json diff masks a secret key in both panes", () => {
    const html = renderToStaticMarkup(
      <DiffViewer
        kind="json"
        before={{ token: "sk-OLD" }}
        after={{ token: "sk-NEW" }}
        redactKeys={DEFAULT_REDACT_KEYS}
      />,
    );
    expect(html).not.toContain("sk-OLD");
    expect(html).not.toContain("sk-NEW");
  });
});
