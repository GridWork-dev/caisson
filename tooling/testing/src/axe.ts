import axeCore, { type Result } from "axe-core";
import { expect } from "bun:test";
import { JSDOM } from "jsdom";

// `color-contrast` and `link-in-text-block` are disabled — mirrors axe-core's own documented
// Jest+JSDOM integration (`doc/examples/jest_react`), since JSDOM has no real layout/paint engine
// and those two checks are unreliable there. `region` is disabled too — it flags any body-level
// content outside a landmark, which is the expected shape for an isolated component (or a
// portaled floating panel, sitting directly under `document.body` like it would in a real app) and
// not a real component-level a11y issue. Every structural/ARIA rule (roles, labels, aria-*
// validity, focus order, duplicate ids, name/role/value) still runs for real.
const RULES = {
  "color-contrast": { enabled: false },
  "link-in-text-block": { enabled: false },
  region: { enabled: false },
} as const;

/**
 * Runs axe-core's accessibility ruleset against server-rendered HTML in a throwaway JSDOM window
 * and returns the violations list — the a11y regression gate for the kit's interactive primitives
 * (ADR-0291). No jest, no testing-library — bun:test asserts directly on the returned array.
 * Passing `document.body` (not `document` itself) as axe's context is required: axe-core resolves
 * its window/document from `context.ownerDocument`, which a bare `Document` node does not have.
 */
export async function axeViolations(html: string): Promise<Result[]> {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  try {
    const results = await axeCore.run(dom.window.document.body, {
      rules: RULES,
    });
    return results.violations;
  } finally {
    dom.window.close();
  }
}

/**
 * Runs axe-core against an already-mounted DOM node (from `renderIntoJsdom`) — for the kit's
 * portal-based primitives (Tooltip/Popover/Menu), whose open-state markup only exists after real
 * client rendering; `axeViolations`'s string+JSDOM round-trip can't reach it (a portal renders
 * into `document.body`, not the returned React tree).
 */
export async function axeViolationsOnNode(node: Element): Promise<Result[]> {
  const results = await axeCore.run(node, { rules: RULES });
  return results.violations;
}

/** Formats violations into a readable multi-line message for a failed assertion. */
export function formatAxeViolations(violations: readonly Result[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? "unknown"}] ${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(" "))
          .join(", ")})`,
    )
    .join("\n");
}

function assertNoViolations(violations: readonly Result[]): void {
  if (violations.length > 0) throw new Error(formatAxeViolations(violations));
  expect(violations).toEqual([]);
}

/**
 * Render → axe → assert-zero-violations in one call, the a11y regression check every new
 * interactive primitive test uses (ADR-0291). Throws the formatted violation list first (so the
 * failure message is readable) then falls through to a normal `expect` so the test framework
 * still records a proper assertion.
 */
export async function expectNoA11yViolations(html: string): Promise<void> {
  assertNoViolations(await axeViolations(html));
}

/** The `axeViolationsOnNode` counterpart of `expectNoA11yViolations`, for a real mounted DOM node. */
export async function expectNoA11yViolationsIn(node: Element): Promise<void> {
  assertNoViolations(await axeViolationsOnNode(node));
}
