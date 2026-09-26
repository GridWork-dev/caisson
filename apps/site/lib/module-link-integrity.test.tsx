// Regression guard for G5 (buyer-lifecycle audit, 2026-07-07): three of five bundle/persona pages
// gated a module member's `<Link>` on catalog membership instead of on `module-pages.ts` (the real
// depth-page route set) — a pageless module rendered as a clickable card that 404s, hitting the
// flagship Compliance page mid-evaluation.
// `routes.test.ts` only walks the static MARKETING_ROUTES registry; it never renders a page or
// follows a member-list-derived link, so that class slipped through. This test renders the ACTUAL
// page output (not a re-derivation of the gating logic) and walks every internal module link it
// finds against the real route set, so a future page reintroducing the wrong gate fails CI here,
// not on a buyer's click.
import { describe, expect, test } from "bun:test";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CompliancePage from "@/app/(marketing)/compliance/page";
import AiProductionPage from "@/app/(marketing)/ai-kit/page";
import LocalFirstPage from "@/app/(marketing)/local-first/page";
import AgenticDevPage from "@/app/(marketing)/agentic-dev/page";
import ProvenancePage from "@/app/(marketing)/provenance/page";

import { MODULE_PAGES } from "./module-pages";

const MODULE_SLUGS = new Set(MODULE_PAGES.map((r) => r.slug));

// Every bundle/persona page that renders member-module cards (Provenance already gates correctly —
// included so this test also catches a future regression there, not just the three fixed pages).
const BUNDLE_PAGES_UNDER_TEST: ReadonlyArray<
  readonly [path: string, Page: ComponentType]
> = [
  ["/compliance", CompliancePage],
  ["/ai-kit", AiProductionPage],
  ["/local-first", LocalFirstPage],
  ["/agentic-dev", AgenticDevPage],
  ["/provenance", ProvenancePage],
];

describe("bundle/persona pages — every rendered module link resolves to a real depth page (G5)", () => {
  for (const [path, Page] of BUNDLE_PAGES_UNDER_TEST) {
    test(`${path} renders no dead /marketplace/modules/<slug> link`, () => {
      const html = renderToStaticMarkup(<Page />);
      const hrefs = [
        ...html.matchAll(/href="\/marketplace\/modules\/(?<slug>[a-z0-9-]+)"/g),
      ]
        .map((m) => m.groups?.slug)
        .filter((slug): slug is string => slug !== undefined);

      // Sanity: the page does render at least one member link — an empty match set would make the
      // dead-link assertion below vacuously pass and hide a total render failure instead.
      expect(hrefs.length).toBeGreaterThan(0);

      const dead = hrefs.filter((slug) => !MODULE_SLUGS.has(slug));
      expect(dead).toEqual([]);
    });
  }
});
