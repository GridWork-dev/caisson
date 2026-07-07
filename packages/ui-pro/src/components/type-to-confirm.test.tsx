import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TypeToConfirm } from "./type-to-confirm";

describe("TypeToConfirm (initial render)", () => {
  test("renders the arming prompt with confirm disabled until typed", () => {
    const html = renderToStaticMarkup(
      <TypeToConfirm
        open
        title="Delete account"
        message="This is irreversible."
        confirmationPhrase="acme-prod"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Delete account"'); // Dialog label
    expect(html).toContain("acme-prod"); // the phrase to type
    expect(html).toContain('aria-label="Type acme-prod to confirm"');
    // confirm starts disabled (nothing typed) and danger-toned by default
    expect(html).toContain('data-tone="danger"');
    expect(html).toMatch(
      /data-tone="danger"[^>]*disabled|disabled[^>]*data-tone="danger"/,
    );
  });

  test("busy state disables inputs and shows a working label", () => {
    const html = renderToStaticMarkup(
      <TypeToConfirm
        open
        title="Delete"
        message="x"
        confirmationPhrase="x"
        state="busy"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Working…");
  });

  test("a result state renders an announced banner", () => {
    const html = renderToStaticMarkup(
      <TypeToConfirm
        open
        title="Delete"
        message="x"
        confirmationPhrase="x"
        state="err"
        resultMessage="Revoke failed."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('data-state="err"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Revoke failed.");
  });
});
