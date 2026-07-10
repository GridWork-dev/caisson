import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RepoArtifact } from "./repo-artifact";

// A1 (ADR-0310): the click-to-reveal toggle is now pure CSS (radio + :has()), no "use client".
// The load-bearing invariant is the wiring between the tree's radio ids and the code panels'
// data-card-id — a typo in either breaks the reveal silently (nothing throws; a card just never
// shows). renderToStaticMarkup succeeding at all is also the SSR-safety proof: this used to be a
// client component.
describe("RepoArtifact — pure-CSS reveal (ADR-0310 A1)", () => {
  const html = renderToStaticMarkup(<RepoArtifact />);

  test("renders with no client-side state — all four code cards are server-rendered", () => {
    for (const id of ["rls", "kernel", "audit-worm", "field-crypto"]) {
      expect(html).toContain(`data-card-id="${id}"`);
    }
  });

  test('exactly one radio (rls) starts checked — the prior useState("rls") default', () => {
    const checkedCount = (html.match(/checked=""/g) ?? []).length;
    expect(checkedCount).toBe(1);
    const rlsInput = html.match(
      /<input[^>]*id="repo-artifact-tab-rls"[^>]*\/>/,
    )?.[0];
    expect(rlsInput).toBeDefined();
    expect(rlsInput).toContain('checked=""');
    const kernelInput = html.match(
      /<input[^>]*id="repo-artifact-tab-kernel"[^>]*\/>/,
    )?.[0];
    expect(kernelInput).toBeDefined();
    expect(kernelInput).not.toContain("checked");
  });

  test("every radio id has a matching card panel — the :has() selector in the CSS module can't miss", () => {
    for (const id of ["rls", "kernel", "audit-worm", "field-crypto"]) {
      expect(html).toContain(`id="repo-artifact-tab-${id}"`);
      expect(html).toContain(`data-card-id="${id}"`);
    }
  });

  test("clickable rows are <label>s wrapping the radio — no <button> left in this component", () => {
    expect(html).not.toContain("<button");
    expect(html).toContain("<label");
  });
});
