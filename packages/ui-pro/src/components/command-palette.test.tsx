import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandPalette, type CommandAction } from "./command-palette";

const actions: CommandAction[] = [
  { id: "grant", label: "Grant entitlement", group: "Admin", run: () => {} },
  { id: "revoke", label: "Revoke entitlement", group: "Admin", run: () => {} },
  { id: "export", label: "Export audit log", group: "Data", run: () => {} },
];

describe("CommandPalette", () => {
  test("renders a combobox + grouped listbox of options when open", () => {
    const html = renderToStaticMarkup(
      <CommandPalette actions={actions} open onOpenChange={() => {}} />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain("Grant entitlement");
    expect(html).toContain("Export audit log");
    // Group headings render.
    expect(html).toContain("Admin");
    expect(html).toContain("Data");
  });

  test("marks the first option active via aria-selected", () => {
    const html = renderToStaticMarkup(
      <CommandPalette actions={actions} open onOpenChange={() => {}} />,
    );
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-activedescendant="cs-cmdk-opt-0"');
  });
});
