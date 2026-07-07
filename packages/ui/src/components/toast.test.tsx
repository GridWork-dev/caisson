import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Toast, ToastRegion } from "./toast";

describe("Toast", () => {
  test("polite tones use role=status", () => {
    const html = renderToStaticMarkup(
      <Toast tone="success" title="Saved">
        Your view was saved.
      </Toast>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('data-tone="success"');
    expect(html).toContain("Saved");
    expect(html).toContain("Your view was saved.");
  });

  test("danger announces assertively with role=alert", () => {
    const html = renderToStaticMarkup(
      <Toast tone="danger">Export failed.</Toast>,
    );
    expect(html).toContain('role="alert"');
  });

  test("renders a dismiss button only when onDismiss is given", () => {
    const withDismiss = renderToStaticMarkup(
      <Toast onDismiss={() => {}}>x</Toast>,
    );
    expect(withDismiss).toContain('aria-label="Dismiss"');
    const without = renderToStaticMarkup(<Toast>x</Toast>);
    expect(without).not.toContain('aria-label="Dismiss"');
  });
});

describe("ToastRegion", () => {
  test("is a polite additions-only live region", () => {
    const html = renderToStaticMarkup(
      <ToastRegion placement="top">
        <Toast>hi</Toast>
      </ToastRegion>,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-relevant="additions"');
    expect(html).toContain('data-placement="top"');
  });
});
