import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";
import { BASE_PACKAGES, basePackagesScoped } from "@/lib/base-substrate";
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
  "> Compliance-grade infrastructure for regulated SaaS: fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain, shipped as a composable open-core base plus six commercial bundles.",
  "",
  "Caisson is a GridWork Digital product (https://gridworkdigital.com).",
  "",
  "## Licensing",
  "",
  // Counted and named from lib/base-substrate.ts, the same const the /legal/license page and the
  // marketing copy read, so this can never claim a package set the site contradicts. Note the
  // distinction the license page draws: a couple of packages outside the named Base substrate are
  // Apache-2.0 too, so this says "the Base substrate is N packages", not "N packages are Apache".
  `Open-core. The ${BASE_PACKAGES.length}-package Base substrate is Apache-2.0 — free to use, read, and redistribute under those terms: ${basePackagesScoped()}. The six bundles and the à-la-carte modules built on top of it are commercial, sold as a perpetual license with a 12-month updates window.`,
  "",
  "- [License terms](/legal/license): which packages are Apache-2.0, which are commercial, and what each grant allows.",
  "- [Licensing, updates and renewals](/docs/licensing): what a perpetual license includes and what renewing costs.",
  "",
  "## Documentation",
  "",
  "- [Documentation](/docs): the full docs tree, indexed below.",
  "- [Getting started](/docs/getting-started): install and first run.",
  "",
  "## Buying",
  "",
  // CONTENT TRUTH: /cart and /dashboard sit behind a Cloudflare Access team login (verified live
  // 2026-08-12), so no visitor outside the team can complete a purchase. Prices ARE published and
  // committed (ADR-0403), so this states both facts rather than implying a self-serve path.
  "Prices are published and committed on the marketplace pages below. Checkout on caisson.sh is currently restricted to the Caisson team, so there is no public self-serve purchase path today — purchase, licensing, and delivery questions go to support@caisson.sh (see /support).",
  "",
  "## Marketplace",
  "",
  "- [Marketplace](/marketplace): Every bundle and module on one surface — filter, compare, and build a stack.",
  "- [Plans and pricing](/marketplace/plans): Subscription plans alongside the one-time bundles and modules.",
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
