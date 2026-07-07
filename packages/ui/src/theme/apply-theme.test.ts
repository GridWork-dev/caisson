import { describe, expect, test } from "bun:test";
import { applyTheme, themeToCssText, themeToCssVars } from "./apply-theme.ts";
import { createTheme } from "./create-theme.ts";

/** Minimal Document stand-in — just enough surface for `applyTheme`'s
 *  getElementById/createElement/head.appendChild calls. Lets the DOM-writing path be tested
 *  without a real browser DOM (bun test has none by default). */
class FakeStyleElement {
  id = "";
  textContent: string | null = null;
}

class FakeDocument {
  readonly appended: FakeStyleElement[] = [];
  private readonly registry = new Map<string, FakeStyleElement>();
  readonly head = {
    appendChild: (el: FakeStyleElement): FakeStyleElement => {
      this.registry.set(el.id, el);
      this.appended.push(el);
      return el;
    },
  };
  getElementById(id: string): FakeStyleElement | null {
    return this.registry.get(id) ?? null;
  }
  createElement(_tagName: string): FakeStyleElement {
    return new FakeStyleElement();
  }
}

describe("theme CSS-var emission (pure, ADR-0250 G2b)", () => {
  test("themeToCssVars emits --cs-* keys for every semantic token, both modes", () => {
    const theme = createTheme();
    const vars = themeToCssVars(theme);
    expect(vars.dark["--cs-bg"]).toBe(theme.dark.bg);
    expect(vars.dark["--cs-accent"]).toBe(theme.dark.accent);
    expect(vars.light["--cs-fg"]).toBe(theme.light.fg);
    expect(Object.keys(vars.dark).length).toBe(Object.keys(theme.dark).length);
  });

  test("themeToCssText emits the [data-theme] block shape tokens.css uses", () => {
    const theme = createTheme({ preset: "pressure" });
    const css = themeToCssText(theme);
    expect(css).toContain(':root, [data-theme="dark"] {');
    expect(css).toContain(`--cs-accent: ${theme.dark.accent};`);
    expect(css).toContain('[data-theme="light"] {');
    expect(css).toContain(`--cs-accent: ${theme.light.accent};`);
  });
});

describe("applyTheme (SSR-safe, ADR-0250 G2b)", () => {
  test("no-ops when there is no document and no explicit target (SSR)", () => {
    expect(typeof document).toBe("undefined"); // bun test has no DOM by default
    expect(() => applyTheme(createTheme())).not.toThrow();
  });

  test("upserts a <style> tag on an explicit target with the theme's CSS text", () => {
    const doc = new FakeDocument();
    const theme = createTheme({ preset: "bulkhead" });
    applyTheme(theme, { target: doc as unknown as Document });

    expect(doc.appended.length).toBe(1);
    const el = doc.getElementById("cs-theme-override");
    expect(el?.textContent).toBe(themeToCssText(theme));
  });

  test("re-calling with the same styleId replaces content, not a duplicate tag", () => {
    const doc = new FakeDocument();
    applyTheme(createTheme({ preset: "caisson" }), {
      target: doc as unknown as Document,
    });
    const second = createTheme({ preset: "pressure" });
    applyTheme(second, { target: doc as unknown as Document });

    expect(doc.appended.length).toBe(1);
    const el = doc.getElementById("cs-theme-override");
    expect(el?.textContent).toBe(themeToCssText(second));
  });

  test("a custom styleId keeps two applied themes independent", () => {
    const doc = new FakeDocument();
    const a = createTheme({ preset: "caisson" });
    const b = createTheme({ preset: "pressure" });
    applyTheme(a, { target: doc as unknown as Document, styleId: "theme-a" });
    applyTheme(b, { target: doc as unknown as Document, styleId: "theme-b" });

    expect(doc.appended.length).toBe(2);
    expect(doc.getElementById("theme-a")?.textContent).toBe(themeToCssText(a));
    expect(doc.getElementById("theme-b")?.textContent).toBe(themeToCssText(b));
  });
});
