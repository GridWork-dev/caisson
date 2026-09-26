import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  test("renders the message and confirm/cancel actions inside a labelled dialog", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Delete grant"
        message="This revokes the customer's access."
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Delete grant"');
    expect(html).toContain("This revokes the customer&#x27;s access.");
    expect(html).toContain(">Delete<");
    expect(html).toContain(">Cancel<");
  });

  test("danger tone marks the confirm action", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Delete"
        message="x"
        tone="danger"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('data-tone="danger"');
  });

  test("busy disables the actions and shows a working label", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Delete"
        message="x"
        busy
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Working…");
  });
});
