import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemeToggle } from "./theme-toggle";
import { themeInitScript } from "./theme-init";

describe("ThemeToggle + theme-init (ADR-0098 F3)", () => {
  test("renders an icon button (no text label) defaulting to dark, labelled by action", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain("<button");
    expect(html).toContain("cs-theme-toggle");
    expect(html).toContain('data-mode="dark"');
    // icon control, not text: aria-label carries the action; no "Dark"/"Light" word labels rendered
    expect(html).toContain('aria-label="Switch to light theme"');
    expect(html).toContain("<svg"); // the moon glyph
    expect(html).not.toContain(">Dark<");
    expect(html).not.toContain(">Light<");
  });

  test("themeInitScript applies only a PINNED choice (OS-follow when unset) + adds cs-js", () => {
    // pins when stored…
    expect(themeInitScript).toContain(`localStorage.getItem("cs-theme")`);
    expect(themeInitScript).toContain(
      "document.documentElement.dataset.theme=t",
    );
    // …guarded to "dark"|"light" only, so an unset choice leaves data-theme alone → CSS OS-follow
    expect(themeInitScript).toContain('t==="dark"||t==="light"');
    // engages scroll-reveal gating
    expect(themeInitScript).toContain('classList.add("cs-js")');
  });
});
