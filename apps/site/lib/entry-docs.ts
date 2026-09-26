import { ALL_ENTRIES } from "./marketplace-surface";
import { source } from "./source";

/** viewId → docs page, resolved from the docs tree at build time: a family's index page, a
 *  module's own page, or (for a module with no page yet) its first family's index. Server-only
 *  (reads the fumadocs source); the gallery receives the result as a prop. */
export function entryDocsHrefs(): Record<string, string> {
  const byLeaf = new Map(source.getPages().map((p) => [p.slugs.at(-1), p.url]));
  const out: Record<string, string> = {};
  for (const e of ALL_ENTRIES) {
    const family = e.categories[0];
    const href =
      byLeaf.get(e.id) ??
      (family === undefined ? undefined : byLeaf.get(family));
    if (href !== undefined) out[e.viewId] = href;
  }
  return out;
}
