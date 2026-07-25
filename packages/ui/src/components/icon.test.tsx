// Icon registry extension-point check. The kit floor renders the Lucide set with no setup; bespoke
// names are declared in the type contract but ship no glyph until an app calls `registerIcons`.
// Pins: floor name renders, an unregistered bespoke name is a safe no-op (null), and a registered
// glyph is invoked with the size + a11y props `<Icon>` computes.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Icon, registerIcons, type IconGlyph } from "./icon";

describe("Icon registry (bespoke extension point)", () => {
  test("a Lucide floor name renders with no registration", () => {
    const html = renderToStaticMarkup(<Icon name="shield" />);
    expect(html).toContain("<svg");
    expect(html).toContain("cs-icon");
  });

  test("an unregistered bespoke name renders nothing (null, never a throw)", () => {
    // `rls` is a RegisteredIconName but the open kit ships no glyph for it, and this test never
    // registers one — so the surface must degrade to an empty render, not crash.
    expect(renderToStaticMarkup(<Icon name="rls" />)).toBe("");
  });

  test("registerIcons wires a bespoke glyph into the <Icon> surface with the computed props", () => {
    const marker: IconGlyph = (p) => <svg data-test="registered" {...p} />;
    registerIcons({ worm: marker });

    const html = renderToStaticMarkup(
      <Icon name="worm" size="lg" aria-label="write once read many" />,
    );
    expect(html).toContain('data-test="registered"');
    expect(html).toContain("cs-icon");
    expect(html).toContain('data-size="lg"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="write once read many"');
  });

  test("the module-depth names participate in the typed runtime registry", () => {
    const marker =
      (name: string): IconGlyph =>
      (p) => <svg data-module-depth={name} {...p} />;
    registerIcons({
      "access-review": marker("access-review"),
      "risk-register": marker("risk-register"),
      "trust-page": marker("trust-page"),
    });

    for (const name of [
      "access-review",
      "risk-register",
      "trust-page",
    ] as const) {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).toContain(`data-module-depth="${name}"`);
      expect(html).toContain("cs-icon");
    }
  });
});
