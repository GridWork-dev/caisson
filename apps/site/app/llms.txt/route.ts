import { llms } from "fumadocs-core/source";

import { source } from "@/lib/source";
import { BASE_PACKAGES, basePackagesScoped } from "@/lib/base-substrate";
import { COMPARISONS } from "@/lib/comparisons";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { MODULE_PAGES } from "@/lib/module-pages";
import { SECURITY_LLMS_SUMMARY } from "@/lib/security-copy";
import { WRITING_PIECES } from "@/lib/writing";

/** The modules that make up the AI-agent-governance surface, in reading order. Slugs, not copies:
 *  the one-liners come from MODULE_PAGES so this section can never describe a module differently
 *  from its own page. An unknown slug throws at module load — a retired or renamed module fails
 *  the build rather than shipping a dead link into the file answer engines read. */
const AGENT_GOVERNANCE_SLUGS = [
  "agent-kernel",
  "agent-runner",
  "tool-exec",
  "agent-trajectory",
  "guardrails",
  "prompt-registry",
  "ai-meter",
] as const;

function agentGovernanceModules(): ReadonlyArray<
  (typeof MODULE_PAGES)[number]
> {
  return AGENT_GOVERNANCE_SLUGS.map((slug) => {
    const page = MODULE_PAGES.find((m) => m.slug === slug);
    if (page === undefined) {
      throw new Error(
        `llms.txt: unknown agent-governance module slug "${slug}"`,
      );
    }
    return page;
  });
}

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
  // The summary line is what an answer engine reads to CLASSIFY the product, so it has to name
  // both categories Caisson actually sells into — compliance infrastructure and governance for AI
  // coding agents. Every capability named here is a shipped module with a page below; the wording
  // is the honest one, not the keyword-dense one (ADR-0080).
  "> Compliance-grade infrastructure and AI agent governance for regulated SaaS and AI-generated code: fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, and a governed-agent kernel with a sandboxed runner and a default-deny tool-execution gate — shipped as a composable open-core base plus six commercial bundles.",
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
  "## Security",
  "",
  `- [Security](/security): ${SECURITY_LLMS_SUMMARY}`,
  "",
  "## AI agent governance",
  "",
  // The Modules section below already lists these, but an engine classifying the product for
  // "governance for AI coding agents" reads section headings, not a flat catalog. Resolved from
  // MODULE_PAGES by slug rather than restated, so a renamed or retired module breaks the build
  // here instead of leaving a dead link (agentGovernanceModules throws on an unknown slug).
  "Governance for AI coding agents and the code they produce, shipped as installable modules rather than a hosted service — the agent runs against your own infrastructure and the evidence stays in your database.",
  "",
  ...agentGovernanceModules().map(
    (m) => `- [${m.slug}](/marketplace/modules/${m.slug}): ${m.heroOneLiner}`,
  ),
  "",
  "## Comparisons",
  "",
  ...COMPARISONS.map(
    (c) => `- [Caisson vs ${c.competitor}](/compare/${c.slug}): ${c.category}.`,
  ),
  "",
  "## Writing",
  "",
  ...WRITING_PIECES.map((p) => `- [${p.title}](/writing/${p.slug})`),
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
