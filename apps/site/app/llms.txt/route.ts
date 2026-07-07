import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";
import { GLOSSARY_TERMS } from "@/lib/glossary";
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
  "> Compliance-grade infrastructure for regulated SaaS. A composable Apache-2.0 base plus six bundles, sold one-time with per-module and bundle options.",
  "",
  "## Marketplace",
  "",
  "- [Marketplace](/marketplace): Every bundle and module on one surface — filter, compare, build a stack, and check out in a single purchase.",
  "- [Plans and pricing](/marketplace/plans): Subscription plans on top of the one-time bundles and modules.",
  "",
  "## Modules",
  "",
  ...MODULE_PAGES.map(
    (m) => `- [${m.slug}](/marketplace/modules/${m.slug}): ${m.heroOneLiner}`,
  ),
  "",
  "## Glossary",
  "",
  "- [Glossary](/glossary): Definitions of the compliance, security, licensing, and AI-infrastructure terms Caisson ships against.",
  ...GLOSSARY_TERMS.map((t) => `- [${t.term}](/glossary/${t.slug})`),
].join("\n");

export function GET() {
  // Demote EVERY top-level heading fumadocs emits to H2, so the composed file has exactly one H1
  // (the preamble's "# Caisson"). `/^# /gm` matches only true H1 lines (hash + space) at any line
  // start — H2s (`## `) and deeper are untouched (their second char is `#`, not a space). Robust
  // to fumadocs changing its header text/count: there is no path back to a second H1.
  const docs = llms(source).index().replace(/^# /gm, "## ");
  return new Response(`${PREAMBLE}\n\n${docs}`);
}
