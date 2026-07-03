import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";
import { MODULE_PAGES } from "@/lib/module-pages";

// Agent-readable index (specs/03 §3, ADR-0237 F8). Composed, not docs-only: a Caisson preamble
// carries the marketplace hub + the data-driven MODULE_PAGES spokes (the depth routes fumadocs'
// docs index never covers), so an LLM reading llms.txt learns the commerce + module routes that
// exist alongside the docs. The Fumadocs docs tree follows, its leading H1 demoted one level so
// the composed file has a single top-level title. MODULE_PAGES is the same record the sitemap and
// the depth routes render — a catalog change lands here with no second edit.
export const dynamic = "force-static";

const PREAMBLE = [
  "# Caisson",
  "",
  "> Compliance-grade infrastructure for regulated SaaS. A composable Apache-2.0 base plus four premium editions, sold one-time with bundle and per-module options.",
  "",
  "## Marketplace",
  "",
  "- [Marketplace](/marketplace): Every standalone module and edition in one cart, one checkout.",
  "- [Plans and pricing](/marketplace/plans): Edition prices, the Everything bundle, and per-module options.",
  "- [Build a stack](/marketplace/build): Compose modules and editions and check out in a single purchase.",
  "",
  "## Modules",
  "",
  ...MODULE_PAGES.map(
    (m) => `- [${m.slug}](/marketplace/modules/${m.slug}): ${m.heroOneLiner}`,
  ),
].join("\n");

export function GET() {
  // Demote the docs index's leading "# Documentation" to H2 so the file has one H1. Tolerant: a
  // single non-global regex on the string start — if fumadocs ever changes that header the worst
  // case is two H1s, never a crash or data loss.
  const docs = llms(source).index().replace(/^# /, "## ");
  return new Response(`${PREAMBLE}\n\n${docs}`);
}
