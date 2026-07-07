// "Caisson vs X" comparison-page data (AEO program stage 2). One record per competitor; the shared
// template at app/(marketing)/compare/[slug]/page.tsx renders any record, and the hub at
// app/(marketing)/compare/page.tsx lists them. A record IS the page — adding a competitor is adding
// a record here, never a new route file (same spoke pattern as GLOSSARY_TERMS + MODULE_PAGES).
//
// HONESTY FLOOR (ADR-0080, binding): every competitor number/claim below was read from the vendor's
// LIVE site on the ACCESSED date and is stamped as such on the page. What a competitor is genuinely
// better at stays IN (`competitorStrengths`) — a comparison page that overclaims against a real
// product is worse than no page. Caisson's own facts (module names, prices, license terms) are NEVER
// hardcoded here: the template reads them from the pricing display SOT (lib/pricing.ts) so a number
// can't drift. Six-bundle vocabulary only; V1-live posture (no roadmap/"coming soon").
//
// SCOPE: Group A of docs/gtm/comparison-targets.md — the SaaS boilerplates / starter kits. The
// honest frame across all ten: these ship auth + billing + a landing page fast; Caisson ships the
// compliance and tenant-isolation substrate they mostly leave to you (fail-closed RLS with isolation
// tests, a WORM + hash-chained audit trail, SOC 2 / HIPAA / EU AI Act evidence packs with OSCAL
// export, per-tenant field encryption). A team picking a kit AND facing an audit is the buyer.

/** The single date every competitor fact on these pages was verified against the live vendor site. */
export const ACCESSED = "2026-07-07";

/** One comparison-matrix row. `true`/`false` = has / doesn't; a string is a short note (a stack name,
 *  a partial). Cells are honest per the vendor's live site — the competitor wins the rows it wins. */
export interface ComparisonRow {
  label: string;
  caisson: boolean | string;
  competitor: boolean | string;
}

export interface ComparisonFaqItem {
  question: string;
  answer: string;
}

export interface Comparison {
  /** "shipfast" → /compare/shipfast */
  slug: string;
  /** Display name, e.g. "ShipFast". */
  competitor: string;
  /** The live vendor URL the facts were read from (https, dated ACCESSED). */
  competitorUrl: string;
  /** One-line category, e.g. "Next.js SaaS boilerplate". */
  category: string;
  metaTitle: string;
  /** Meta description — answer-first, keyword in the first clause (ADR-0079 §4). */
  metaDescription: string;
  /** Answer capsule — the first thing on the page (top 30%), answer-first, ~45-70 words: which one,
   *  when, and the honest line between them (ADR-0079 §5). */
  answer: string;
  /** Hero lede — one honest sentence. */
  heroLede: string;
  /** The competitor's live price string (scraped, dated). */
  competitorPrice: string;
  /** The competitor's license model in one line (scraped, dated). */
  competitorLicense: string;
  /** What the competitor is, in 3-5 dated bullets (stack + what's included). */
  competitorFacts: readonly string[];
  /** What the competitor is genuinely better at — credibility law, stays IN (2-3). */
  competitorStrengths: readonly { title: string; body: string }[];
  /** Where Caisson draws the honest line (2-3). */
  caissonLine: readonly { title: string; body: string }[];
  /** The honest capability matrix (Caisson vs the competitor). */
  rows: readonly ComparisonRow[];
  /** Honest guidance: pick the competitor when… */
  whenPickCompetitor: string;
  /** …pick Caisson when… */
  whenPickCaisson: string;
  /** …and when the two compose. */
  whenBoth: string;
  faq: readonly ComparisonFaqItem[];
}

// Shared row labels for the compliance/isolation substrate that is Caisson's whole thesis. The
// competitor cell is set per record from that vendor's live site; Caisson's cells are constant
// (true-to-built, ADR-0082). Kept as a helper so the ten records stay legible, not to hide a claim.
const SUBSTRATE = {
  rls: "Fail-closed Postgres RLS + automated cross-tenant isolation tests",
  worm: "WORM evidence store + append-only hash-chained audit trail",
  evidence: "SOC 2 / HIPAA / EU AI Act evidence packs + OSCAL export",
  fieldCrypto: "Per-tenant field encryption (envelope, per-tenant key)",
  signing: "Detached evidence signing (Ed25519 + RFC-3161)",
} as const;

export const COMPARISONS: readonly Comparison[] = [
  // ---------------------------------------------------------------------------------------------
  {
    slug: "shipfast",
    competitor: "ShipFast",
    competitorUrl: "https://shipfa.st",
    category: "Next.js SaaS boilerplate",
    metaTitle: "Caisson vs ShipFast",
    metaDescription:
      "ShipFast gets a Next.js SaaS launched in days; Caisson adds the compliance substrate it leaves to you — fail-closed RLS, a WORM audit trail, and SOC 2 / HIPAA evidence packs. An honest, dated comparison.",
    answer:
      "Pick ShipFast to launch a Next.js SaaS in days — it wires Stripe, auth, emails, and a landing page fast, for the lowest price in this list. Pick Caisson when that app has to pass a SOC 2 or HIPAA audit: it ships fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, and evidence packs ShipFast doesn't carry. They solve different halves — many teams launch on a kit, then adopt Caisson for the regulated backend.",
    heroLede:
      "ShipFast is the speed-to-launch default. Caisson is the compliance and tenant-isolation substrate a kit leaves to you. Here is the honest line between them.",
    competitorPrice: "$199 Starter · $249 All-in (one-time)",
    competitorLicense:
      "One-time payment, pay once and build unlimited projects, lifetime updates.",
    competitorFacts: [
      "Next.js boilerplate (JavaScript or TypeScript, App or Pages router).",
      "Auth via Google OAuth + magic links; Stripe or Lemon Squeezy payments; Mailgun or Resend emails; MongoDB or Supabase.",
      "SEO + blog, UI components and animations, and a Discord community with a revenue leaderboard.",
      "One-time price, pay once for unlimited projects, lifetime updates.",
    ],
    competitorStrengths: [
      {
        title: "Fastest path to a launched SaaS",
        body: "ShipFast's whole design is time-to-first-dollar: payments, auth, and emails are wired so a solo founder can ship in a day. If launch speed is the constraint, that is exactly what it is built for.",
      },
      {
        title: "Lowest price and a large community",
        body: "At a one-time $199 it is the cheapest kit here, backed by a big maker community and a Stripe-verified revenue leaderboard. For validating an idea cheaply, that is hard to beat.",
      },
    ],
    caissonLine: [
      {
        title: "The audit substrate is not in the box",
        body: "ShipFast gets you selling; it does not ship fail-closed RLS with isolation tests, a tamper-evident audit trail, or evidence packs. When a customer's security review asks for those, you build them yourself — or start from a substrate that already has them.",
      },
      {
        title: "Own the source, one-time, with 12 months of updates",
        body: "Caisson is also a one-time perpetual license on an Apache-2.0 base — the difference is what the source contains: the compliance and multi-tenant-isolation packages, not just the launch plumbing.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "Next.js + MongoDB / Supabase",
      },
      { label: "Auth (OAuth, magic link)", caisson: true, competitor: true },
      { label: "Payments / billing", caisson: true, competitor: true },
      {
        label: "Marketing landing-page templates",
        caisson: false,
        competitor: true,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "One-time perpetual license, own the source",
        caisson: true,
        competitor: true,
      },
    ],
    whenPickCompetitor:
      "You want the fastest, cheapest path to a launched Next.js SaaS and are not (yet) facing a compliance audit.",
    whenPickCaisson:
      "Your SaaS handles regulated data and has to show fail-closed tenant isolation, an immutable audit trail, and SOC 2 / HIPAA evidence.",
    whenBoth:
      "Launch and validate on ShipFast, then adopt Caisson's compliance packages onto your Postgres app when the first enterprise security review lands.",
    faq: [
      {
        question: "Is Caisson a ShipFast alternative?",
        answer:
          "They overlap on auth, billing, and emails but solve different halves. ShipFast optimizes time-to-launch; Caisson supplies the compliance and tenant-isolation substrate (fail-closed RLS, WORM audit, evidence packs) a launch kit leaves to you. A team can launch on ShipFast and adopt Caisson for the regulated backend, or start on Caisson if the audit is on day one.",
      },
      {
        question: "Does ShipFast include SOC 2 or HIPAA controls?",
        answer:
          "No. As of 2026-07-07 ShipFast's live site advertises auth, payments, emails, SEO, and a blog — not fail-closed RLS with isolation tests, a tamper-evident audit log, or framework evidence packs. Those are what Caisson's Compliance bundle ships.",
      },
      {
        question: "How much does each cost?",
        answer:
          "ShipFast is a one-time $199 (Starter) or $249 (All-in) with lifetime updates, verified 2026-07-07. Caisson is a one-time perpetual license per bundle or module with 12 months of updates included, renewable per entitlement afterward — see the licensing section below for the live figures.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "makerkit",
    competitor: "MakerKit",
    competitorUrl: "https://makerkit.dev",
    category: "Next.js / Supabase SaaS boilerplate",
    metaTitle: "Caisson vs MakerKit",
    metaDescription:
      "MakerKit ships production-grade Supabase multi-tenancy with RLS; Caisson adds the evidence layer on top — isolation tests, a WORM audit trail, and SOC 2 / HIPAA / OSCAL packs. An honest, dated comparison.",
    answer:
      "Pick MakerKit for a mature, production-grade Next.js + Supabase kit: real multi-tenancy on Postgres RLS, MFA auth, a super-admin, and an MCP server your AI agent builds on, maintained full-time since 2022. Pick Caisson when you must prove that isolation to an auditor: it adds automated cross-tenant isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs with OSCAL export. MakerKit gives you RLS; Caisson gives you RLS plus the evidence it holds.",
    heroLede:
      "MakerKit gives you Supabase RLS multi-tenancy you configure. Caisson gives you fail-closed RLS with the isolation tests and audit evidence an auditor asks for. Here is the honest line.",
    competitorPrice: "$299 Pro (1 dev) · $599 Teams (up to 5)",
    competitorLicense:
      "One-time payment, lifetime license, unlimited projects, continuous updates.",
    competitorFacts: [
      "Next.js 16 or React Router 7 on a Supabase-native stack (Auth, Storage, Database, RLS).",
      "Multi-tenancy (users across multiple organizations), MFA auth, a Super Admin with impersonation, Stripe / Lemon Squeezy / Paddle billing.",
      "An MCP server and agent rules for Claude Code / Cursor / Codex, Shadcn UI + Tailwind v4, i18n, Playwright E2E, React.Email.",
      "Maintained full-time since 2022 with 400+ pages of documentation.",
    ],
    competitorStrengths: [
      {
        title: "Mature, real multi-tenancy on Supabase RLS",
        body: "MakerKit is not a weekend project — it has run in production since 2022 and ships genuine organization-based multi-tenancy enforced by Postgres RLS through Supabase, plus MFA and a super-admin. That is a strong, well-trodden foundation.",
      },
      {
        title: "Built for AI-assisted development",
        body: "It ships an MCP server and curated agent rules so tools like Claude Code and Cursor extend the codebase along its intended patterns — a real advantage if AI-driven development is your workflow.",
      },
    ],
    caissonLine: [
      {
        title: "RLS is only as good as your coverage — Caisson proves it",
        body: "MakerKit gives you RLS to configure per table; a missed policy is a silent cross-tenant leak. Caisson's compliance-core ships an RLS-force evidence collector and isolation tests that attempt a cross-tenant read and assert it fails, every run — the difference between having RLS and proving it.",
      },
      {
        title: "The audit + evidence layer MakerKit doesn't carry",
        body: "A WORM + hash-chained audit trail, per-tenant field encryption, detached evidence signing, and SOC 2 / HIPAA / EU AI Act packs with OSCAL export are Caisson's core and are not part of MakerKit's feature set.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "Next.js / React Router + Supabase",
      },
      { label: "Auth + MFA", caisson: true, competitor: true },
      { label: "Organization multi-tenancy", caisson: true, competitor: true },
      { label: "Postgres RLS", caisson: true, competitor: true },
      {
        label: SUBSTRATE.rls,
        caisson: true,
        competitor: "RLS, no shipped isolation tests",
      },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      { label: SUBSTRATE.signing, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want a mature, AI-agent-friendly Next.js + Supabase kit with real multi-tenancy and are handling your own compliance story.",
    whenPickCaisson:
      "You need to prove tenant isolation with automated tests and produce SOC 2 / HIPAA evidence, not just enable RLS.",
    whenBoth:
      "Build the product surface on MakerKit's Supabase stack and add Caisson's compliance-core, audit-worm, and field-crypto packages for the isolation tests and evidence an auditor requires.",
    faq: [
      {
        question: "Doesn't MakerKit already have RLS? Why Caisson?",
        answer:
          "Yes — MakerKit enforces multi-tenancy with Supabase Postgres RLS, and that is a genuine strength. Caisson's addition is the evidence: an RLS-force collector and isolation tests that prove a cross-tenant read fails on every run, plus a WORM audit trail and OSCAL evidence packs. Having RLS and being able to prove it to an auditor are different deliverables.",
      },
      {
        question: "Is Caisson also a one-time purchase like MakerKit?",
        answer:
          "Yes. Both are one-time perpetual licenses you own the source of. MakerKit is $299 (1 dev) or $599 (up to 5), verified 2026-07-07, with continuous updates. Caisson is one-time per bundle or module with 12 months of updates included and per-entitlement renewal after — see the licensing section for live figures.",
      },
      {
        question: "Can I use MakerKit and Caisson together?",
        answer:
          "Yes. Caisson's compliance packages sit on a standard Postgres app, so you can layer the isolation tests, WORM audit, and field encryption onto a MakerKit-built product without a rewrite.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "supastarter",
    competitor: "supastarter",
    competitorUrl: "https://supastarter.dev",
    category: "Next.js / Nuxt / TanStack SaaS boilerplate",
    metaTitle: "Caisson vs supastarter",
    metaDescription:
      "supastarter is the most feature-complete multi-framework SaaS monorepo; Caisson is the compliance substrate underneath — fail-closed RLS with isolation tests, WORM audit, and OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick supastarter for breadth: a production-ready monorepo with auth, multi-provider billing, organizations, a typed API, i18n, storage, and an admin UI, on your choice of Next.js, Nuxt, or TanStack Start. Pick Caisson for depth on one axis — the compliance and tenant-isolation substrate: fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. supastarter is the widest kit; Caisson is the regulated backend it doesn't try to be.",
    heroLede:
      "supastarter is the most feature-rich starter kit. Caisson is the compliance depth a broad kit doesn't carry. Here is the honest line between breadth and audit-readiness.",
    competitorPrice: "$349 Solo · $799 Startup (5) · $1,499 Agency (10)",
    competitorLicense:
      "One-time purchase, lifetime access and updates, unlimited projects, own the source.",
    competitorFacts: [
      "Monorepo on Next.js, Nuxt, or TanStack Start with a shared packages layer.",
      "Auth, multi-provider payments, organizations/multi-tenancy, a typed API (oRPC), i18n, storage, background jobs, notifications, an admin UI, and a blog.",
      "AI integration and AGENTS.md conventions for AI coding agents.",
      "One-time pricing, lifetime access and updates; a paid 'done-for-you' MVP service is offered.",
    ],
    competitorStrengths: [
      {
        title: "The broadest feature set and framework choice",
        body: "supastarter is genuinely the most complete kit here — organizations, typed API, i18n, jobs, storage, notifications, admin — and it is one of the few that lets you pick Next.js, Nuxt, or TanStack Start. For raw breadth, it leads.",
      },
      {
        title: "Clean monorepo architecture",
        body: "Its shared-packages monorepo is well structured and documented, and it is explicitly tuned for AI coding agents. That scaffolding is real, ships today, and saves weeks.",
      },
    ],
    caissonLine: [
      {
        title: "Breadth is not the same as audit depth",
        body: "supastarter gives you organizations and an admin UI; it does not ship isolation tests that prove cross-tenant reads fail, a WORM audit trail, per-tenant field encryption, or framework evidence packs. Those are the controls a SOC 2 or HIPAA audit actually inspects.",
      },
      {
        title: "Composable, not a monolith to fork",
        body: "Caisson is composable packages on an Apache-2.0 base — you add the compliance modules you need onto a standard Postgres app rather than adopting one large template wholesale.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "Next.js / Nuxt / TanStack + Postgres",
      },
      { label: "Auth", caisson: true, competitor: true },
      {
        label: "Organizations / multi-tenancy",
        caisson: true,
        competitor: true,
      },
      {
        label: "Typed API + i18n + jobs",
        caisson: "partial",
        competitor: true,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      { label: SUBSTRATE.signing, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want the widest possible feature set and framework choice in a single well-structured monorepo.",
    whenPickCaisson:
      "You need the compliance controls and audit evidence a broad kit doesn't include, on a composable base you extend as needed.",
    whenBoth:
      "Ship the app breadth on supastarter and add Caisson's Compliance bundle for the isolation tests, WORM audit, and evidence packs when compliance enters scope.",
    faq: [
      {
        question: "supastarter has more features — why would I add Caisson?",
        answer:
          "supastarter's breadth is real and it wins on feature count. Caisson competes on a different axis: the compliance and tenant-isolation substrate — isolation tests, WORM audit, field encryption, OSCAL evidence packs — that a general-purpose kit doesn't ship. If you are heading into a SOC 2 or HIPAA audit, that depth is the deciding factor.",
      },
      {
        question: "Do both let me own the source?",
        answer:
          "Yes. supastarter is a one-time purchase ($349 Solo to $1,499 Agency, verified 2026-07-07) with lifetime updates. Caisson is a one-time perpetual license with 12 months of updates included; its Base substrate is Apache-2.0 and the compliance modules are commercial — see the licensing section for live figures.",
      },
      {
        question: "Can I use supastarter and Caisson together?",
        answer:
          "Yes. supastarter's monorepo runs on standard Postgres, and Caisson's compliance packages install onto a standard Postgres app — so you can add the isolation tests, WORM audit, and field encryption to a supastarter-built product without adopting a second framework.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "saas-pegasus",
    competitor: "SaaS Pegasus",
    competitorUrl: "https://www.saaspegasus.com",
    category: "Django / Python SaaS boilerplate",
    metaTitle: "Caisson vs SaaS Pegasus",
    metaDescription:
      "SaaS Pegasus is the mature Django/Python SaaS boilerplate; Caisson is a TypeScript compliance substrate — fail-closed RLS with isolation tests, WORM audit, and SOC 2 / HIPAA / OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick SaaS Pegasus if your team is Python-first: it is the mature Django boilerplate, with a code configurator, teams/RBAC, Stripe subscriptions, Celery, a Wagtail CMS, and a choice of React or HTMX. Pick Caisson if you are on TypeScript/Postgres and need the compliance substrate: fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. This is a stack contrast first — Python vs TypeScript — and a compliance-depth contrast second.",
    heroLede:
      "SaaS Pegasus is the Django incumbent. Caisson is a TypeScript compliance substrate. The choice is your stack first, then the audit layer.",
    competitorPrice: "$249 Starter · $449 Professional · $999 Unlimited",
    competitorLicense:
      "One-time license, lifetime access with 1 year of updates; upgrade within the year for the price difference.",
    competitorFacts: [
      "Django / Python, generated from an online code configurator; front end in your choice of React or HTMX.",
      "Teams/multi-tenancy with an RBAC framework, Stripe subscriptions and per-seat pricing, Celery background tasks, a Wagtail CMS, REST APIs.",
      "Feature flags, 2FA, user impersonation, i18n, Docker-based dev, the Django admin.",
      "One-time license from $249 to $999 with one year of updates, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "The strongest Django/Python option",
        body: "If your team lives in Python, Pegasus is the mature, well-documented choice — used by companies like PhotoRoom — with a code configurator, Celery, and the full Django admin. No TypeScript kit replaces that for a Django shop.",
      },
      {
        title: "Batteries-included breadth",
        body: "Teams and RBAC, subscriptions, a CMS, feature flags, 2FA, and impersonation ship in the box. For a Django SaaS it is a complete, production-grade starting point.",
      },
    ],
    caissonLine: [
      {
        title: "Different stack — TypeScript and Postgres RLS",
        body: "Caisson is TypeScript-native on Postgres; Pegasus is Python/Django. If you have chosen your language, that alone likely decides it. Caisson's isolation model is enforced in the database with RLS rather than in the application's ORM layer.",
      },
      {
        title: "The compliance evidence layer",
        body: "Pegasus ships RBAC and 2FA; it does not ship isolation tests that prove cross-tenant reads fail, a WORM audit trail, field encryption, or OSCAL evidence packs. Those are Caisson's core deliverable.",
      },
    ],
    rows: [
      {
        label: "Language / stack",
        caisson: "TypeScript + Postgres",
        competitor: "Python / Django",
      },
      { label: "Auth + 2FA", caisson: true, competitor: true },
      { label: "Teams / RBAC", caisson: true, competitor: true },
      { label: "Subscriptions / billing", caisson: true, competitor: true },
      { label: "Built-in CMS", caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "Your team is Python-first, or you want the Django admin, Celery, and a built-in CMS out of the box.",
    whenPickCaisson:
      "You are building on TypeScript/Postgres and need database-enforced isolation with tests plus audit evidence.",
    whenBoth:
      "They rarely compose in one codebase — the stacks differ. Choose by language first; if that is TypeScript and compliance is in scope, Caisson is the fit.",
    faq: [
      {
        question: "Is Caisson a SaaS Pegasus alternative?",
        answer:
          "Only if you are choosing a stack. Pegasus is Django/Python; Caisson is TypeScript on Postgres. For a Python team, Pegasus is the stronger pick. For a TypeScript team that also needs SOC 2 / HIPAA evidence, Caisson supplies the compliance substrate Pegasus's language ecosystem would have you build yourself.",
      },
      {
        question: "Does SaaS Pegasus handle SOC 2 or HIPAA?",
        answer:
          "It ships RBAC, 2FA, and teams — useful controls — but as of 2026-07-07 not fail-closed RLS with isolation tests, a WORM audit trail, or OSCAL evidence packs. Caisson's Compliance bundle ships those directly.",
      },
      {
        question: "Can I use SaaS Pegasus and Caisson together?",
        answer:
          "Rarely in one codebase — Pegasus is Django/Python and Caisson is TypeScript on Postgres, so they don't share a runtime. Choose by language first. If your stack is TypeScript and compliance is in scope, Caisson is the fit; if you are Python-first, Pegasus is the stronger base.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "turbostarter",
    competitor: "TurboStarter",
    competitorUrl: "https://www.turbostarter.dev",
    category: "Cross-platform (web + mobile + extension) SaaS boilerplate",
    metaTitle: "Caisson vs TurboStarter",
    metaDescription:
      "TurboStarter ships web, mobile, and a browser extension from one codebase; Caisson is the compliance backend — fail-closed RLS with isolation tests, WORM audit, and OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick TurboStarter if you need one codebase across web, mobile, and a browser extension: it is the cross-platform kit, with a Hono API, six payment providers, passkeys, and organizations. Pick Caisson when the backend behind those apps handles regulated data and must pass an audit: it ships fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. TurboStarter maximizes surface breadth across platforms; Caisson maximizes compliance depth on the server.",
    heroLede:
      "TurboStarter spans web, mobile, and browser-extension from one codebase. Caisson is the audit-ready backend those surfaces need. Here is the honest line.",
    competitorPrice: "$299 (one-time; higher tiers add AI templates)",
    competitorLicense:
      "One-time payment, lifetime access, ongoing updates, one-click deploy to every platform.",
    competitorFacts: [
      "Web, mobile, and browser-extension apps from a unified codebase, with a Hono API.",
      "Auth (email/password, magic link, social, 2FA, passkeys), billing across Stripe / Lemon Squeezy / Polar / Dodo / RevenueCat / Superwall, organizations/teams with RBAC, i18n.",
      "A CLI to scaffold and deploy, AI integration, and AI-editor rules/skills/agents.",
      "One-time pricing from $299 with lifetime access, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "True cross-platform from one codebase",
        body: "TurboStarter is the only kit here that ships web, mobile, and a browser extension together with shared packages. If your product spans those surfaces, that unification is a genuine, hard-to-replicate advantage.",
      },
      {
        title: "The widest payment-provider support",
        body: "Six billing integrations including RevenueCat and Superwall means it covers mobile in-app purchase and paywall flows most web-only kits don't touch.",
      },
    ],
    caissonLine: [
      {
        title: "Cross-platform surface, not the compliance backend",
        body: "TurboStarter's strength is breadth of client surfaces; it does not ship database-enforced isolation with tests, a WORM audit trail, field encryption, or evidence packs. Those live on the server that all those surfaces talk to — which is where Caisson operates.",
      },
      {
        title: "Web/server focus, deliberately",
        body: "Caisson is a web-and-server compliance substrate; it does not ship a mobile or extension client. It is the regulated backend, not the multi-platform frontend kit.",
      },
    ],
    rows: [
      { label: "Web app", caisson: true, competitor: true },
      {
        label: "Mobile + browser-extension apps",
        caisson: false,
        competitor: true,
      },
      {
        label: "Auth (passkeys, 2FA, social)",
        caisson: true,
        competitor: true,
      },
      { label: "Organizations / RBAC", caisson: true, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      { label: SUBSTRATE.signing, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "Your product spans web, mobile, and a browser extension and you want them from one codebase with unified billing.",
    whenPickCaisson:
      "The backend behind your apps handles regulated data and needs database-enforced isolation, audit evidence, and field encryption.",
    whenBoth:
      "Build the multi-platform client surfaces on TurboStarter and put Caisson's compliance packages on the Postgres backend they share.",
    faq: [
      {
        question: "Can TurboStarter and Caisson work together?",
        answer:
          "Yes, and it is a natural split. TurboStarter owns the web/mobile/extension clients; Caisson owns the compliance substrate on the Postgres backend those clients call. Neither duplicates the other.",
      },
      {
        question: "Does TurboStarter include audit logging or evidence packs?",
        answer:
          "As of 2026-07-07 its live site advertises auth, billing, organizations, and cross-platform apps — not a WORM audit trail, isolation tests, or OSCAL evidence packs. Caisson's Compliance and Provenance bundles ship those.",
      },
      {
        question:
          "Does Caisson ship a mobile or browser-extension app like TurboStarter?",
        answer:
          "No. Caisson is a web-and-server compliance substrate; it does not ship a mobile or extension client. TurboStarter is the stronger pick for the multi-platform frontend, and Caisson is the backend those platforms share.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "open-saas",
    competitor: "Open SaaS",
    competitorUrl: "https://opensaas.sh",
    category: "Free open-source SaaS template (Wasp)",
    metaTitle: "Caisson vs Open SaaS",
    metaDescription:
      "Open SaaS is a free, MIT React/Node template built on the Wasp framework; Caisson is a compliance substrate on plain Next.js/Postgres — fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Open SaaS to start free: it is a genuinely open-source (MIT) React + Node + Prisma template with auth, Stripe/Polar/Lemon Squeezy, an admin dashboard, and one-command deploy — built on the Wasp framework. Pick Caisson when you need a compliance substrate on plain Next.js/Postgres you fully control: fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Open SaaS is free but Wasp-framework-bound; Caisson is a paid, Apache-2.0-based library on the framework you already run.",
    heroLede:
      "Open SaaS is the free, open-source kit — built on the Wasp framework. Caisson is a compliance substrate on plain Next.js/Postgres. Here is the honest line between free-on-Wasp and audit-ready-on-your-stack.",
    competitorPrice: "Free (open-source, MIT)",
    competitorLicense: "MIT open-source; you own all the code. No purchase.",
    competitorFacts: [
      "React + Node + Prisma, built on and requiring the Wasp full-stack framework (a config/compiler layer).",
      "Auth you own, Stripe / Polar / Lemon Squeezy payments, an admin dashboard, analytics (Plausible or Google), AWS S3 file upload, email, an Astro blog.",
      "End-to-end Playwright tests and a GitHub Actions CI pipeline.",
      "Free and MIT-licensed, verified 2026-07-07; a Discord community backs it.",
    ],
    competitorStrengths: [
      {
        title: "Free and truly open-source",
        body: "Open SaaS is MIT-licensed and costs nothing — you own every line with no purchase. For learning, prototyping, or a budget-zero launch, that is a real and honest advantage no paid kit matches on price.",
      },
      {
        title: "Wasp's full-stack ergonomics",
        body: "Built on Wasp, it gives you end-to-end type safety, auth, and one-command deploy from a concise config. If you are happy adopting Wasp, the developer experience is smooth and well-supported.",
      },
    ],
    caissonLine: [
      {
        title: "Wasp is a framework commitment; Caisson isn't",
        body: "Open SaaS runs on Wasp — a DSL/compiler layer your app is built around. Caisson is a set of packages on plain Next.js and Postgres, so you are not adopting a new framework to get the substrate.",
      },
      {
        title: "The compliance layer isn't in a launch template",
        body: "Open SaaS ships auth, billing, and an admin dashboard; it does not ship fail-closed RLS with isolation tests, a WORM audit trail, field encryption, or evidence packs. That regulated-backend layer is what you would pay Caisson for.",
      },
    ],
    rows: [
      {
        label: "Price",
        caisson: "Paid (one-time perpetual)",
        competitor: "Free (MIT)",
      },
      {
        label: "Framework",
        caisson: "Plain Next.js + Postgres",
        competitor: "Wasp (React + Node + Prisma)",
      },
      { label: "Auth", caisson: true, competitor: true },
      { label: "Payments + admin dashboard", caisson: true, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "Apache-2.0 base you own",
        caisson: true,
        competitor: "MIT (whole template)",
      },
    ],
    whenPickCompetitor:
      "You want a free, open-source starting point and are comfortable building your app on the Wasp framework.",
    whenPickCaisson:
      "You need compliance controls and audit evidence on plain Next.js/Postgres without adopting a new framework.",
    whenBoth:
      "They target different foundations — Open SaaS is Wasp-based. If you have chosen plain Next.js/Postgres and need the compliance layer, Caisson is the fit; if free-on-Wasp works for you, start there.",
    faq: [
      {
        question: "Why pay for Caisson when Open SaaS is free?",
        answer:
          "Open SaaS's price is its honest strength. What it doesn't include is the compliance substrate — fail-closed RLS with isolation tests, a WORM audit trail, field encryption, and OSCAL evidence packs — and it commits you to the Wasp framework. Caisson is paid because that regulated-backend layer, on plain Next.js/Postgres, is the product.",
      },
      {
        question: "Is Open SaaS really open-source?",
        answer:
          "Yes — it is MIT-licensed, verified 2026-07-07, and you own all the code. Caisson's Base substrate is also open (Apache-2.0); its compliance modules are commercial, one-time perpetual licenses.",
      },
      {
        question: "Can I use Open SaaS and Caisson together?",
        answer:
          "They target different foundations — Open SaaS is built on the Wasp framework, while Caisson is packages on plain Next.js/Postgres. If you have committed to Wasp, adding Caisson means bridging to a standard Postgres backend; if you are on plain Next.js/Postgres, Caisson drops in directly.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "bedrock",
    competitor: "Bedrock",
    competitorUrl: "https://bedrock.mxstbr.com",
    category: "Next.js + GraphQL SaaS boilerplate",
    metaTitle: "Caisson vs Bedrock",
    metaDescription:
      "Bedrock is a modern, modular Next.js + GraphQL boilerplate with teams and per-seat billing; Caisson adds the compliance substrate — fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Bedrock for a clean, modern Next.js + GraphQL foundation: magic-link auth, teams with per-seat Stripe billing, a typed GraphQL API (Pothos + Prisma + urql), token-based API auth, and a deliberately modular design where everything but Next.js is removable. Pick Caisson when that foundation has to meet a compliance bar: it ships fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Bedrock is a superb starting foundation; Caisson is the regulated-backend substrate on top.",
    heroLede:
      "Bedrock is a modern, modular Next.js + GraphQL foundation. Caisson is the compliance substrate a foundation leaves to you. Here is the honest line.",
    competitorPrice: "$450 (one-time; sale price shown lower)",
    competitorLicense:
      "One-time purchase with a license key; 14-day money-back guarantee; own the source.",
    competitorFacts: [
      "Next.js + GraphQL (Pothos + Prisma + urql), intentionally unstyled so you bring your own UI.",
      "Magic-link auth, teams (projects with their own billing and members), Stripe Checkout subscription payments including per-seat, transactional emails, token-based API authentication.",
      "Deliberately modular — every tool except Next.js can be removed or swapped.",
      "One-time purchase (list $450, a sale price is shown), 14-day money-back guarantee, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "Excellent GraphQL developer experience",
        body: "Bedrock's typed GraphQL API on Pothos + Prisma with urql on the client is a genuinely nice foundation, from a well-known author. If you want GraphQL and a modular, no-magic codebase, it is a strong pick.",
      },
      {
        title: "Teams and per-seat billing, built in",
        body: "Projects with their own billing and members, plus per-seat Stripe pricing and token-based API auth, ship out of the box — real B2B plumbing, cleanly done.",
      },
    ],
    caissonLine: [
      {
        title: "A foundation, not a compliance layer",
        body: "Bedrock is designed as a clean base to build on; it does not ship database-enforced isolation with tests, a WORM audit trail, field encryption, or evidence packs. Caisson is precisely that layer, and it enforces isolation in Postgres RLS rather than the GraphQL resolver layer.",
      },
      {
        title: "Composable packages vs a base to extend",
        body: "Both value modularity. Caisson expresses it as installable packages on a shared Apache-2.0 base, so you add exactly the compliance modules you need — and never depend 'up' on an edition.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "Next.js + GraphQL + Prisma",
      },
      { label: "Auth (magic link)", caisson: true, competitor: true },
      { label: "Teams + per-seat billing", caisson: true, competitor: true },
      { label: "Typed API", caisson: "REST/typed", competitor: "GraphQL" },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      { label: SUBSTRATE.signing, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want a clean, modular Next.js + GraphQL foundation with teams and per-seat billing to build your own product on.",
    whenPickCaisson:
      "That product handles regulated data and needs database-enforced isolation, an audit trail, and compliance evidence.",
    whenBoth:
      "Use Bedrock as the GraphQL foundation and add Caisson's compliance packages on the Postgres side for the isolation tests, WORM audit, and evidence packs.",
    faq: [
      {
        question: "Does Bedrock include SOC 2 or compliance features?",
        answer:
          "As of 2026-07-07, Bedrock's live site advertises auth, teams, per-seat Stripe billing (it notes Stripe handles PCI), a GraphQL API, and modularity — not fail-closed RLS with isolation tests, a WORM audit trail, or OSCAL evidence packs. Those are Caisson's core, so the two compose rather than compete.",
      },
      {
        question: "Is Caisson also modular like Bedrock?",
        answer:
          "Yes, and it is a shared value. Bedrock makes every tool but Next.js removable; Caisson ships composable packages on an Apache-2.0 base where an edition is a composition of modules, never a fork. You add only the compliance modules you need.",
      },
      {
        question: "Can I use Bedrock and Caisson together?",
        answer:
          "Yes. Use Bedrock as the Next.js + GraphQL foundation and add Caisson's compliance packages on the Postgres side — the RLS isolation tests, WORM audit, and evidence packs enforce in the database, beneath whichever API layer you build.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "shipixen",
    competitor: "Shipixen",
    competitorUrl: "https://shipixen.com",
    category: "Next.js landing-page + boilerplate generator",
    metaTitle: "Caisson vs Shipixen",
    metaDescription:
      "Shipixen generates a designed Next.js landing page, blog, and marketing site in minutes; Caisson is the compliance backend — fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Shipixen to go from nothing to a deployed, well-designed Next.js marketing site fast: landing pages, a blog, 300+ components, 60+ themes, AI content generation, and one-click deploy — for unlimited generated codebases. Pick Caisson for the opposite half of the stack: the compliance backend, with fail-closed Postgres RLS and isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Shipixen is a front-end/marketing generator with no built-in database or auth; Caisson is the regulated backend it doesn't try to be.",
    heroLede:
      "Shipixen is the fastest way to a designed marketing site and landing page. Caisson is the compliance backend behind the product. These two barely overlap — here is the honest line.",
    competitorPrice: "$379 lifetime · $249 one-year license",
    competitorLicense:
      "Pay once for a lifetime license (or a one-year license); generate unlimited codebases, all generated code is yours forever.",
    competitorFacts: [
      "A Next.js boilerplate GENERATOR: pick a template, customize content and theme, deploy — landing pages, a blog, a waitlist.",
      "300+ UI components, 60+ themes, AI content generation, automatic SEO (sitemap, RSS, tags), MDX blog, dark mode.",
      "Front-end focused — no built-in database or authentication; you integrate those separately.",
      "One-time $379 lifetime or $249/year, unlimited generated codebases, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "The fastest path to a designed marketing site",
        body: "Shipixen's whole strength is design-forward speed: select a template, tweak copy, one-click deploy a polished landing page, blog, or waitlist. For founders who don't want to design, it is genuinely excellent and Caisson doesn't compete on it.",
      },
      {
        title: "Unlimited codebases, own the code",
        body: "One purchase generates as many boilerplates as you like, each yours forever, with strong built-in SEO. For serial launchers, that is real leverage.",
      },
    ],
    caissonLine: [
      {
        title: "Front-end generator, not a backend",
        body: "Shipixen is explicitly front-end: no built-in database or auth. Caisson is the other half — the Postgres backend with database-enforced isolation, an audit trail, and evidence packs. There is almost no overlap to reconcile.",
      },
      {
        title: "Composable app substrate, not marketing scaffold",
        body: "Where Shipixen generates a marketing surface, Caisson ships the app substrate — auth, tenancy, billing, and the compliance modules — as audited packages you compose and own.",
      },
    ],
    rows: [
      {
        label: "Marketing site / landing pages / blog",
        caisson: false,
        competitor: true,
      },
      {
        label: "Designed component + theme library",
        caisson: "@caisson/ui kit",
        competitor: true,
      },
      { label: "Built-in database", caisson: true, competitor: false },
      { label: "Built-in auth", caisson: true, competitor: false },
      {
        label: "Billing / tenancy substrate",
        caisson: true,
        competitor: false,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You need a polished marketing site, landing page, or blog deployed fast and will handle the backend elsewhere.",
    whenPickCaisson:
      "You need the regulated application backend — auth, tenancy, billing, and compliance evidence — not a marketing front end.",
    whenBoth:
      "Generate the marketing site with Shipixen and build the compliant product backend with Caisson; they cover opposite ends of the stack.",
    faq: [
      {
        question: "Is Caisson a Shipixen alternative?",
        answer:
          "Not really — they solve opposite problems. Shipixen generates a front-end marketing site with no built-in database or auth; Caisson is the Postgres application backend with compliance controls. A team can use both: Shipixen for the site, Caisson for the regulated product behind it.",
      },
      {
        question: "Does Shipixen include auth, a database, or compliance?",
        answer:
          "As of 2026-07-07, Shipixen's live site is explicit that it is front-end focused with no built-in database or authentication. Compliance controls like RLS, a WORM audit trail, and evidence packs are outside its scope and are Caisson's core.",
      },
      {
        question: "Can I use Shipixen and Caisson together?",
        answer:
          "Yes, and they complement cleanly. Generate the marketing site, landing page, and blog with Shipixen, and build the regulated application backend — auth, tenancy, billing, and the compliance modules — with Caisson. They cover opposite ends of the stack.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "saasrock",
    competitor: "SaasRock",
    competitorUrl: "https://saasrock.com",
    category: "React Router 7 (Remix) SaaS boilerplate",
    metaTitle: "Caisson vs SaasRock",
    metaDescription:
      "SaasRock is an admin-heavy React Router 7 boilerplate with an entity builder and B2B2C portals; Caisson is the compliance substrate — fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick SaasRock for admin depth on React Router 7 (Remix): an entity builder that auto-generates CRUD + APIs, separate admin/app/marketing portals, no-code page blocks, feature flags, roles, i18n, and B2B2C support. Pick Caisson for the compliance substrate underneath: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. SaasRock maximizes admin and app-builder tooling; Caisson maximizes audit-readiness.",
    heroLede:
      "SaasRock is the admin-heavy React Router kit with an entity builder. Caisson is the compliance substrate it sits above. Here is the honest line.",
    competitorPrice: "$249 MVP · $499 Core · $1,999 Pro (one-time)",
    competitorLicense:
      "Pay once, own the code, unlimited SaaS apps; upgrade an edition by paying the difference; free updates within the major version.",
    competitorFacts: [
      "React Router 7 (Remix) + Tailwind + shadcn/ui + Prisma, with admin, app, and marketing portals.",
      "An Entity Builder that auto-generates CRUD and APIs, no-code page blocks, feature flags, roles/permissions, i18n, Stripe subscriptions, GDPR management, B2B2C apps.",
      "Google / GitHub sign-in, Postmark / Resend / SendGrid email, built-in metrics.",
      "One-time pricing $249 to $1,999 with free updates within the major version, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "An entity builder and deep admin tooling",
        body: "SaasRock's auto-generated CRUD + APIs, no-code page blocks, and three-portal structure (admin/app/marketing) are a lot of working machinery. For an admin-heavy internal product, that tooling saves real time.",
      },
      {
        title: "B2B2C and feature-flag breadth",
        body: "It ships B2B2C application support, feature flags, roles, and metrics — capabilities many kits skip. For a multi-layered B2B product, that breadth is a genuine head start.",
      },
    ],
    caissonLine: [
      {
        title: "Admin tooling, not audit evidence",
        body: "SaasRock gives you an app builder and admin; it does not ship isolation tests that prove cross-tenant reads fail, a WORM audit trail, field encryption, or OSCAL evidence packs. Its isolation is enforced in the Prisma layer, not database RLS.",
      },
      {
        title: "A focused substrate, not a kitchen sink",
        body: "Caisson is composable compliance packages you add to a standard Postgres app, rather than a broad admin platform to adopt whole.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "React Router 7 + Prisma",
      },
      {
        label: "Admin / app / marketing portals",
        caisson: "partial",
        competitor: true,
      },
      { label: "Auth + RBAC", caisson: true, competitor: true },
      { label: "Subscriptions / billing", caisson: true, competitor: true },
      {
        label: "No-code entity / page builder",
        caisson: false,
        competitor: true,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want an admin-heavy React Router product with an entity builder, page blocks, and B2B2C support out of the box.",
    whenPickCaisson:
      "You need database-enforced isolation with tests plus audit evidence, on a focused, composable substrate.",
    whenBoth:
      "Build the admin surface on SaasRock and add Caisson's Compliance bundle for the isolation tests, WORM audit, and evidence packs when compliance enters scope.",
    faq: [
      {
        question:
          "SaasRock has an admin and RBAC — isn't that enough for compliance?",
        answer:
          "RBAC and an admin are useful controls, and SaasRock's tooling is real. But an auditor asks for proof of tenant isolation, a tamper-evident record, and mapped evidence — isolation tests, a WORM audit trail, and OSCAL packs. As of 2026-07-07 those are not in SaasRock's feature set; they are Caisson's core.",
      },
      {
        question: "Do both let me own the code?",
        answer:
          "Yes. SaasRock is a one-time purchase ($249 to $1,999, verified 2026-07-07) where you own the code and build unlimited apps. Caisson is a one-time perpetual license with 12 months of updates included; its Base is Apache-2.0 and compliance modules are commercial.",
      },
      {
        question: "Can I use SaasRock and Caisson together?",
        answer:
          "Yes. Build the admin surface, entity CRUD, and B2B2C portals on SaasRock, and add Caisson's Compliance bundle for the database-enforced isolation tests, WORM audit, and OSCAL evidence packs when an audit enters scope.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "divjoy",
    competitor: "Divjoy",
    competitorUrl: "https://divjoy.com",
    category: "React codebase generator",
    metaTitle: "Caisson vs Divjoy",
    metaDescription:
      "Divjoy is a visual React codebase generator that scaffolds a SaaS front end with your stack choices; Caisson is the compliance backend — fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Divjoy to scaffold a React SaaS front end fast with a visual generator: choose your framework, UI kit, auth provider, database, and Stripe, then export the code. Pick Caisson for the regulated backend that a scaffold doesn't produce: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Divjoy generates a customizable front-end starting point; Caisson is the audited compliance substrate behind it.",
    heroLede:
      "Divjoy is a visual React scaffold generator. Caisson is the compliance backend a scaffold doesn't build. Here is the honest line.",
    competitorPrice: "$199 (one-time)",
    competitorLicense:
      "One-time payment, lifetime updates, unlimited projects, 14-day money-back guarantee.",
    competitorFacts: [
      "A visual React codebase generator: pick framework (React / Next.js), UI kit (Tailwind / Material UI / Bootstrap / Bulma), auth (Firebase / Supabase / Auth0), database (Firestore / Supabase), and Stripe.",
      "Generates a SaaS front end with authentication, subscription payments, user settings, a dashboard, and a landing page; export the code or push to CodeSandbox.",
      "One-time $199 with lifetime updates and unlimited projects, verified 2026-07-07 (the site footer reads © 2024).",
    ],
    competitorStrengths: [
      {
        title: "A visual, multi-stack generator",
        body: "Divjoy's editor lets you mix a framework, UI kit, auth provider, and database and preview before exporting. For quickly bootstrapping a React front end in your preferred stack, that flexibility is a real, distinctive strength.",
      },
      {
        title: "Low price, own the code",
        body: "At a one-time $199 with lifetime updates and unlimited projects, it is an inexpensive way to skip the initial React setup and get a customized scaffold.",
      },
    ],
    caissonLine: [
      {
        title: "A generated scaffold, not a compliance backend",
        body: "Divjoy outputs a front-end SaaS scaffold wired to third-party auth and a database; it does not produce database-enforced isolation with tests, a WORM audit trail, field encryption, or evidence packs. Caisson is that audited backend layer.",
      },
      {
        title: "Composed, audited packages vs one-time codegen",
        body: "Caisson's compliance code is maintained, versioned packages with golden-file regression and isolation tests — not a one-shot generated scaffold you then own alone.",
      },
    ],
    rows: [
      {
        label: "Output",
        caisson: "Composable packages",
        competitor: "Generated scaffold",
      },
      {
        label: "Front-end scaffold + landing page",
        caisson: "@caisson/ui kit",
        competitor: true,
      },
      { label: "Auth (via provider)", caisson: true, competitor: true },
      { label: "Subscription payments", caisson: true, competitor: true },
      { label: "Organization multi-tenancy", caisson: true, competitor: false },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want to visually scaffold a React SaaS front end in your chosen stack and export the code quickly.",
    whenPickCaisson:
      "You need the regulated backend — database-enforced isolation, an audit trail, and compliance evidence — not a front-end scaffold.",
    whenBoth:
      "Scaffold the front end with Divjoy and build the compliant backend with Caisson; they address different layers of the app.",
    faq: [
      {
        question: "Is Caisson a Divjoy alternative?",
        answer:
          "They target different layers. Divjoy generates a React front-end scaffold wired to a provider's auth and database; Caisson is the audited compliance backend with RLS isolation, a WORM audit trail, and evidence packs. A team could scaffold with Divjoy and build the regulated backend with Caisson.",
      },
      {
        question: "Does Divjoy produce compliance controls?",
        answer:
          "No. As of 2026-07-07 Divjoy generates a front-end SaaS scaffold with auth, payments, and a dashboard; database-enforced isolation with tests, a WORM audit trail, and OSCAL evidence packs are outside its scope and are Caisson's core.",
      },
      {
        question: "Can I use Divjoy and Caisson together?",
        answer:
          "Yes. Scaffold the React front end with Divjoy's generator, then build the compliant backend — tenancy, RLS isolation, audit, and evidence — with Caisson. Divjoy addresses the front-end layer; Caisson addresses the regulated backend.",
      },
    ],
  },
] as const;

/** Lookup a comparison by slug. */
export function findComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
