import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FormField } from "./form-field";

describe("FormField — label/control/helper-error association (ADR-0099)", () => {
  test("wires htmlFor/id + aria-describedby to the helper text", () => {
    const html = renderToStaticMarkup(
      <FormField label="Provider" helperText="Pick a provider.">
        <select name="provider" />
      </FormField>,
    );
    const idMatch = /id="([^"]+)"/.exec(html);
    expect(idMatch).not.toBeNull();
    const id = idMatch?.[1] ?? "";
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain(`aria-describedby="${id}-helper"`);
    expect(html).toContain(`id="${id}-helper"`);
    expect(html).toContain("Pick a provider.");
    expect(html).toContain("cs-field__control");
  });

  test("an error swaps in for helperText, marks aria-invalid, and is announced", () => {
    const html = renderToStaticMarkup(
      <FormField
        label="Secret key"
        helperText="Never shown again."
        error="Enter the full key."
      >
        <input name="apiKey" />
      </FormField>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Enter the full key.");
    expect(html).not.toContain("Never shown again.");
    expect(html).toContain('role="alert"');
  });

  test("neither helperText nor error renders no supporting paragraph", () => {
    const html = renderToStaticMarkup(
      <FormField label="User id">
        <input name="userId" />
      </FormField>,
    );
    expect(html).not.toContain("cs-field__helper");
    expect(html).not.toContain("cs-field__error");
  });

  test("mono sets data-mono on the wrapper for control-ID fields", () => {
    const html = renderToStaticMarkup(
      <FormField label="User id" mono>
        <input name="userId" />
      </FormField>,
    );
    expect(html).toContain('data-mono=""');
  });

  test("a select control keeps its own tag through Slot (framework-agnostic control seam)", () => {
    const html = renderToStaticMarkup(
      <FormField label="Provider">
        <select name="provider">
          <option value="openai">openai</option>
        </select>
      </FormField>,
    );
    expect(html).toContain("<select");
    expect(html).not.toContain("<input");
  });
});
