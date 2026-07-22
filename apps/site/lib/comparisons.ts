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
// SCOPE: all targets of docs/gtm/comparison-targets.md (the original 20 + auditkit, added
// 2026-07-10 off the CAISSON-76 parity research), in three honest frames.
//  • Group A — SaaS boilerplates / starter kits (+ the free create-t3-app scaffold): they ship auth +
//    billing + a landing page fast; Caisson ships the compliance and tenant-isolation substrate they
//    leave to you (fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, evidence
//    packs with OSCAL export, per-tenant field encryption). A team picking a kit AND facing an audit.
//  • Group B — compliance-automation (GRC) platforms (Vanta / Drata / Secureframe / Sprinto / Scytale
//    / Thoropass / Delve / Comp AI): NOT head-to-head. They MONITOR your stack and run the audit
//    workflow; Caisson is the CODE that implements the controls they inspect. The page draws the
//    honest own-vs-rent line and says the two compose — it never declares a winner.
//  • Group C — build it in-house: the build-vs-buy math, sourced from Caisson's own committed
//    /build-vs-buy analysis (no vendor to scrape); the $80k / 6-9-month figure is the industry cost of
//    a first SOC 2, labeled as such (ADR-0080 §4), never a Caisson quote.

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
  /** Per-record override of ACCESSED for targets verified on a later date (a record added after
   *  the last full sweep must not claim the sweep's date). Omit = ACCESSED. */
  accessed?: string;
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

// Shared row labels for the Group-B compliance-automation (GRC) platforms. These platforms MONITOR
// your stack and run the audit workflow; Caisson is the controls IN your codebase they inspect —
// so the honest split is "different category", not a knock, and the platform wins its rows. The
// competitor cell is `true` for a real GRC platform; Caisson's cell is `false` or a short note.
// Kept as a helper so the eight platform records stay legible (same pattern as SUBSTRATE).
const GRC = {
  monitor: "Continuous stack/cloud monitoring + automated evidence collection",
  auditWorkflow:
    "Runs the audit workflow (evidence-for-auditor, questionnaires)",
  trustCenter: "Hosted Trust Center for prospects",
  tprm: "Third-party / vendor risk management (TPRM)",
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
      "ShipFast gets a Next.js SaaS launched in days; Caisson adds the compliance substrate it leaves to you: fail-closed RLS, a WORM audit trail, and SOC 2 / HIPAA evidence packs. An honest, dated comparison.",
    answer:
      "Pick ShipFast to launch a Next.js SaaS in days: it wires Stripe, auth, emails, and a landing page fast, for the lowest price in this list. Pick Caisson when that app has to pass a SOC 2 or HIPAA audit: it ships fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, and evidence packs ShipFast doesn't carry. They solve different halves; many teams launch on a kit, then adopt Caisson for the regulated backend.",
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
        body: "ShipFast gets you selling; it does not ship fail-closed RLS with isolation tests, a tamper-evident audit trail, or evidence packs. When a customer's security review asks for those, you build them yourself, or start from a substrate that already has them.",
      },
      {
        title: "Own the source, one-time, with 12 months of updates",
        body: "Caisson is also a one-time perpetual license on an Apache-2.0 base. The difference is what the source contains: the compliance and multi-tenant-isolation packages, not just the launch plumbing.",
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
          "No. As of 2026-07-07 ShipFast's live site advertises auth, payments, emails, SEO, and a blog, not fail-closed RLS with isolation tests, a tamper-evident audit log, or framework evidence packs. Those are what Caisson's Compliance bundle ships.",
      },
      {
        question: "How much does each cost?",
        answer:
          "ShipFast is a one-time $199 (Starter) or $249 (All-in) with lifetime updates, verified 2026-07-07. Caisson is a one-time perpetual license per bundle or module with 12 months of updates included, renewable per entitlement afterward. See the licensing section below for the live figures.",
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
      "MakerKit ships production-grade Supabase multi-tenancy with RLS; Caisson adds the evidence layer on top: isolation tests, a WORM audit trail, and SOC 2 / HIPAA / OSCAL packs. An honest, dated comparison.",
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
        body: "MakerKit is not a weekend project: it has run in production since 2022 and ships genuine organization-based multi-tenancy enforced by Postgres RLS through Supabase, plus MFA and a super-admin. That is a strong, well-trodden foundation.",
      },
      {
        title: "Built for AI-assisted development",
        body: "It ships an MCP server and curated agent rules so tools like Claude Code and Cursor extend the codebase along its intended patterns, a real advantage if AI-driven development is your workflow.",
      },
    ],
    caissonLine: [
      {
        title: "RLS is only as good as your coverage: Caisson proves it",
        body: "MakerKit gives you RLS to configure per table; a missed policy is a silent cross-tenant leak. Caisson's compliance-core ships an RLS-force evidence collector and isolation tests that attempt a cross-tenant read and assert it fails, every run, the difference between having RLS and proving it.",
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
          "Yes, MakerKit enforces multi-tenancy with Supabase Postgres RLS, and that is a genuine strength. Caisson's addition is the evidence: an RLS-force collector and isolation tests that prove a cross-tenant read fails on every run, plus a WORM audit trail and OSCAL evidence packs. Having RLS and being able to prove it to an auditor are different deliverables.",
      },
      {
        question: "Is Caisson also a one-time purchase like MakerKit?",
        answer:
          "Yes. Both are one-time perpetual licenses you own the source of. MakerKit is $299 (1 dev) or $599 (up to 5), verified 2026-07-07, with continuous updates. Caisson is one-time per bundle or module with 12 months of updates included and per-entitlement renewal after. See the licensing section for live figures.",
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
      "supastarter is the most feature-complete multi-framework SaaS monorepo; Caisson is the compliance substrate underneath: fail-closed RLS with isolation tests, WORM audit, and OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick supastarter for breadth: a production-ready monorepo with auth, multi-provider billing, organizations, a typed API, i18n, storage, and an admin UI, on your choice of Next.js, Nuxt, or TanStack Start. Pick Caisson for depth on one axis (the compliance and tenant-isolation substrate): fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. supastarter is the widest kit; Caisson is the regulated backend it doesn't try to be.",
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
        body: "supastarter is genuinely the most complete kit here (organizations, typed API, i18n, jobs, storage, notifications, admin) and it is one of the few that lets you pick Next.js, Nuxt, or TanStack Start. For raw breadth, it leads.",
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
        body: "Caisson is composable packages on an Apache-2.0 base: you add the compliance modules you need onto a standard Postgres app rather than adopting one large template wholesale.",
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
        question: "supastarter has more features. Why would I add Caisson?",
        answer:
          "supastarter's breadth is real and it wins on feature count. Caisson competes on a different axis: the compliance and tenant-isolation substrate (isolation tests, WORM audit, field encryption, OSCAL evidence packs) that a general-purpose kit doesn't ship. If you are heading into a SOC 2 or HIPAA audit, that depth is the deciding factor.",
      },
      {
        question: "Do both let me own the source?",
        answer:
          "Yes. supastarter is a one-time purchase ($349 Solo to $1,499 Agency, verified 2026-07-07) with lifetime updates. Caisson is a one-time perpetual license with 12 months of updates included; its Base substrate is Apache-2.0 and the compliance modules are commercial. See the licensing section for live figures.",
      },
      {
        question: "Can I use supastarter and Caisson together?",
        answer:
          "Yes. supastarter's monorepo runs on standard Postgres, and Caisson's compliance packages install onto a standard Postgres app, so you can add the isolation tests, WORM audit, and field encryption to a supastarter-built product without adopting a second framework.",
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
      "SaaS Pegasus is the mature Django/Python SaaS boilerplate; Caisson is a TypeScript compliance substrate: fail-closed RLS with isolation tests, WORM audit, and SOC 2 / HIPAA / OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick SaaS Pegasus if your team is Python-first: it is the mature Django boilerplate, with a code configurator, teams/RBAC, Stripe subscriptions, Celery, a Wagtail CMS, and a choice of React or HTMX. Pick Caisson if you are on TypeScript/Postgres and need the compliance substrate: fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. This is a stack contrast first (Python vs TypeScript) and a compliance-depth contrast second.",
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
        body: "If your team lives in Python, Pegasus is the mature, well-documented choice (used by companies like PhotoRoom) with a code configurator, Celery, and the full Django admin. No TypeScript kit replaces that for a Django shop.",
      },
      {
        title: "Batteries-included breadth",
        body: "Teams and RBAC, subscriptions, a CMS, feature flags, 2FA, and impersonation ship in the box. For a Django SaaS it is a complete, production-grade starting point.",
      },
    ],
    caissonLine: [
      {
        title: "Different stack: TypeScript and Postgres RLS",
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
      "They rarely compose in one codebase: the stacks differ. Choose by language first; if that is TypeScript and compliance is in scope, Caisson is the fit.",
    faq: [
      {
        question: "Is Caisson a SaaS Pegasus alternative?",
        answer:
          "Only if you are choosing a stack. Pegasus is Django/Python; Caisson is TypeScript on Postgres. For a Python team, Pegasus is the stronger pick. For a TypeScript team that also needs SOC 2 / HIPAA evidence, Caisson supplies the compliance substrate Pegasus's language ecosystem would have you build yourself.",
      },
      {
        question: "Does SaaS Pegasus handle SOC 2 or HIPAA?",
        answer:
          "It ships RBAC, 2FA, and teams (useful controls), but as of 2026-07-07 not fail-closed RLS with isolation tests, a WORM audit trail, or OSCAL evidence packs. Caisson's Compliance bundle ships those directly.",
      },
      {
        question: "Can I use SaaS Pegasus and Caisson together?",
        answer:
          "Rarely in one codebase: Pegasus is Django/Python and Caisson is TypeScript on Postgres, so they don't share a runtime. Choose by language first. If your stack is TypeScript and compliance is in scope, Caisson is the fit; if you are Python-first, Pegasus is the stronger base.",
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
      "TurboStarter ships web, mobile, and a browser extension from one codebase; Caisson is the compliance backend: fail-closed RLS with isolation tests, WORM audit, and OSCAL evidence packs. An honest, dated comparison.",
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
        body: "TurboStarter's strength is breadth of client surfaces; it does not ship database-enforced isolation with tests, a WORM audit trail, field encryption, or evidence packs. Those live on the server that all those surfaces talk to, which is where Caisson operates.",
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
          "As of 2026-07-07 its live site advertises auth, billing, organizations, and cross-platform apps, not a WORM audit trail, isolation tests, or OSCAL evidence packs. Caisson's Compliance and Provenance bundles ship those.",
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
      "Open SaaS is a free, MIT React/Node template built on the Wasp framework; Caisson is a compliance substrate on plain Next.js/Postgres: fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Open SaaS to start free: it is a genuinely open-source (MIT) React + Node + Prisma template with auth, Stripe/Polar/Lemon Squeezy, an admin dashboard, and one-command deploy, built on the Wasp framework. Pick Caisson when you need a compliance substrate on plain Next.js/Postgres you fully control: fail-closed RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Open SaaS is free but Wasp-framework-bound; Caisson is a paid, Apache-2.0-based library on the framework you already run.",
    heroLede:
      "Open SaaS is the free, open-source kit, built on the Wasp framework. Caisson is a compliance substrate on plain Next.js/Postgres. Here is the honest line between free-on-Wasp and audit-ready-on-your-stack.",
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
        body: "Open SaaS is MIT-licensed and costs nothing: you own every line with no purchase. For learning, prototyping, or a budget-zero launch, that is a real and honest advantage no paid kit matches on price.",
      },
      {
        title: "Wasp's full-stack ergonomics",
        body: "Built on Wasp, it gives you end-to-end type safety, auth, and one-command deploy from a concise config. If you are happy adopting Wasp, the developer experience is smooth and well-supported.",
      },
    ],
    caissonLine: [
      {
        title: "Wasp is a framework commitment; Caisson isn't",
        body: "Open SaaS runs on Wasp, a DSL/compiler layer your app is built around. Caisson is a set of packages on plain Next.js and Postgres, so you are not adopting a new framework to get the substrate.",
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
      "They target different foundations: Open SaaS is Wasp-based. If you have chosen plain Next.js/Postgres and need the compliance layer, Caisson is the fit; if free-on-Wasp works for you, start there.",
    faq: [
      {
        question: "Why pay for Caisson when Open SaaS is free?",
        answer:
          "Open SaaS's price is its honest strength. What it doesn't include is the compliance substrate (fail-closed RLS with isolation tests, a WORM audit trail, field encryption, and OSCAL evidence packs), and it commits you to the Wasp framework. Caisson is paid because that regulated-backend layer, on plain Next.js/Postgres, is the product.",
      },
      {
        question: "Is Open SaaS really open-source?",
        answer:
          "Yes, it is MIT-licensed, verified 2026-07-07, and you own all the code. Caisson's Base substrate is also open (Apache-2.0); its compliance modules are commercial, one-time perpetual licenses.",
      },
      {
        question: "Can I use Open SaaS and Caisson together?",
        answer:
          "They target different foundations: Open SaaS is built on the Wasp framework, while Caisson is packages on plain Next.js/Postgres. If you have committed to Wasp, adding Caisson means bridging to a standard Postgres backend; if you are on plain Next.js/Postgres, Caisson drops in directly.",
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
      "Bedrock is a modern, modular Next.js + GraphQL boilerplate with teams and per-seat billing; Caisson adds the compliance substrate: fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
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
      "Deliberately modular: every tool except Next.js can be removed or swapped.",
      "One-time purchase (list $450, a sale price is shown), 14-day money-back guarantee, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "Excellent GraphQL developer experience",
        body: "Bedrock's typed GraphQL API on Pothos + Prisma with urql on the client is a genuinely nice foundation, from a well-known author. If you want GraphQL and a modular, no-magic codebase, it is a strong pick.",
      },
      {
        title: "Teams and per-seat billing, built in",
        body: "Projects with their own billing and members, plus per-seat Stripe pricing and token-based API auth, ship out of the box, real B2B plumbing, cleanly done.",
      },
    ],
    caissonLine: [
      {
        title: "A foundation, not a compliance layer",
        body: "Bedrock is designed as a clean base to build on; it does not ship database-enforced isolation with tests, a WORM audit trail, field encryption, or evidence packs. Caisson is precisely that layer, and it enforces isolation in Postgres RLS rather than the GraphQL resolver layer.",
      },
      {
        title: "Composable packages vs a base to extend",
        body: "Both value modularity. Caisson expresses it as installable packages on a shared Apache-2.0 base, so you add exactly the compliance modules you need, and never depend 'up' on an edition.",
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
          "As of 2026-07-07, Bedrock's live site advertises auth, teams, per-seat Stripe billing (it notes Stripe handles PCI), a GraphQL API, and modularity, not fail-closed RLS with isolation tests, a WORM audit trail, or OSCAL evidence packs. Those are Caisson's core, so the two compose rather than compete.",
      },
      {
        question: "Is Caisson also modular like Bedrock?",
        answer:
          "Yes, and it is a shared value. Bedrock makes every tool but Next.js removable; Caisson ships composable packages on an Apache-2.0 base where an edition is a composition of modules, never a fork. You add only the compliance modules you need.",
      },
      {
        question: "Can I use Bedrock and Caisson together?",
        answer:
          "Yes. Use Bedrock as the Next.js + GraphQL foundation and add Caisson's compliance packages on the Postgres side: the RLS isolation tests, WORM audit, and evidence packs enforce in the database, beneath whichever API layer you build.",
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
      "Shipixen generates a designed Next.js landing page, blog, and marketing site in minutes; Caisson is the compliance backend: fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Shipixen to go from nothing to a deployed, well-designed Next.js marketing site fast: landing pages, a blog, 300+ components, 60+ themes, AI content generation, and one-click deploy, for unlimited generated codebases. Pick Caisson for the opposite half of the stack: the compliance backend, with fail-closed Postgres RLS and isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. Shipixen is a front-end/marketing generator with no built-in database or auth; Caisson is the regulated backend it doesn't try to be.",
    heroLede:
      "Shipixen is the fastest way to a designed marketing site and landing page. Caisson is the compliance backend behind the product. These two barely overlap: here is the honest line.",
    competitorPrice: "$379 lifetime · $249 one-year license",
    competitorLicense:
      "Pay once for a lifetime license (or a one-year license); generate unlimited codebases, all generated code is yours forever.",
    competitorFacts: [
      "A Next.js boilerplate GENERATOR: pick a template, customize content and theme, deploy (landing pages, a blog, a waitlist).",
      "300+ UI components, 60+ themes, AI content generation, automatic SEO (sitemap, RSS, tags), MDX blog, dark mode.",
      "Front-end focused: no built-in database or authentication; you integrate those separately.",
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
        body: "Shipixen is explicitly front-end: no built-in database or auth. Caisson is the other half: the Postgres backend with database-enforced isolation, an audit trail, and evidence packs. There is almost no overlap to reconcile.",
      },
      {
        title: "Composable app substrate, not marketing scaffold",
        body: "Where Shipixen generates a marketing surface, Caisson ships the app substrate (auth, tenancy, billing, and the compliance modules) as audited packages you compose and own.",
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
      "You need the regulated application backend (auth, tenancy, billing, and compliance evidence), not a marketing front end.",
    whenBoth:
      "Generate the marketing site with Shipixen and build the compliant product backend with Caisson; they cover opposite ends of the stack.",
    faq: [
      {
        question: "Is Caisson a Shipixen alternative?",
        answer:
          "Not really: they solve opposite problems. Shipixen generates a front-end marketing site with no built-in database or auth; Caisson is the Postgres application backend with compliance controls. A team can use both: Shipixen for the site, Caisson for the regulated product behind it.",
      },
      {
        question: "Does Shipixen include auth, a database, or compliance?",
        answer:
          "As of 2026-07-07, Shipixen's live site is explicit that it is front-end focused with no built-in database or authentication. Compliance controls like RLS, a WORM audit trail, and evidence packs are outside its scope and are Caisson's core.",
      },
      {
        question: "Can I use Shipixen and Caisson together?",
        answer:
          "Yes, and they complement cleanly. Generate the marketing site, landing page, and blog with Shipixen, and build the regulated application backend (auth, tenancy, billing, and the compliance modules) with Caisson. They cover opposite ends of the stack.",
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
      "SaasRock is an admin-heavy React Router 7 boilerplate with an entity builder and B2B2C portals; Caisson is the compliance substrate: fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
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
        body: "It ships B2B2C application support, feature flags, roles, and metrics, capabilities many kits skip. For a multi-layered B2B product, that breadth is a genuine head start.",
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
          "SaasRock has an admin and RBAC. Isn't that enough for compliance?",
        answer:
          "RBAC and an admin are useful controls, and SaasRock's tooling is real. But an auditor asks for proof of tenant isolation, a tamper-evident record, and mapped evidence: isolation tests, a WORM audit trail, and OSCAL packs. As of 2026-07-07 those are not in SaasRock's feature set; they are Caisson's core.",
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
      "Divjoy is a visual React codebase generator that scaffolds a SaaS front end with your stack choices; Caisson is the compliance backend: fail-closed RLS, WORM audit, OSCAL evidence packs. An honest, dated comparison.",
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
        body: "Caisson's compliance code is maintained, versioned packages with golden-file regression and isolation tests, not a one-shot generated scaffold you then own alone.",
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
      "You need the regulated backend (database-enforced isolation, an audit trail, and compliance evidence), not a front-end scaffold.",
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
          "Yes. Scaffold the React front end with Divjoy's generator, then build the compliant backend (tenancy, RLS isolation, audit, and evidence) with Caisson. Divjoy addresses the front-end layer; Caisson addresses the regulated backend.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // Group A tail — a free typesafe stack scaffold.
  {
    slug: "create-t3-app",
    competitor: "Create T3 App",
    competitorUrl: "https://create.t3.gg",
    category: "Free typesafe Next.js stack scaffold (T3)",
    metaTitle: "Caisson vs Create T3 App",
    metaDescription:
      "Create T3 App scaffolds a free, typesafe full-stack Next.js app; Caisson is the regulated backend it deliberately leaves out: fail-closed RLS with isolation tests, a WORM audit trail, and SOC 2 / HIPAA / OSCAL evidence packs. An honest, dated comparison.",
    answer:
      "Pick Create T3 App to start a full-stack, typesafe Next.js app for free: it wires Next.js, TypeScript, Tailwind, tRPC, Prisma or Drizzle, and NextAuth.js: by design, only the typesafe core. Pick Caisson when that app has to carry regulated data through an audit: it ships fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and SOC 2 / HIPAA / EU AI Act evidence packs. create-t3-app scaffolds the foundation; Caisson is the compliance and tenancy substrate it says up front it does not include.",
    heroLede:
      "Create T3 App is the free, typesafe scaffold: deliberately only the core. Caisson is the compliance and tenant-isolation substrate it leaves to you. Here is the honest line.",
    competitorPrice: "Free (open-source, MIT)",
    competitorLicense:
      "MIT open-source; you own all generated code. No purchase.",
    competitorFacts: [
      "A CLI scaffold for the T3 stack: Next.js, TypeScript, Tailwind CSS, tRPC, Prisma or Drizzle ORM, and NextAuth.js; you pick which pieces.",
      "Explicitly NOT an all-inclusive template: its stated design is to scaffold only the typesafe core and have you bring your own libraries.",
      "No billing, no multi-tenancy, and no compliance tooling; those are outside its scope by design.",
      "Free and MIT-licensed with a large community and Discord, verified 2026-07-07.",
    ],
    competitorStrengths: [
      {
        title: "Best-in-class typesafety, for free",
        body: "create-t3-app's end-to-end type safety (tRPC from client to server, typed all the way down) is a genuinely excellent free foundation. For a TypeScript team that wants the typesafe core and nothing it didn't ask for, it is the gold-standard start.",
      },
      {
        title: "Deliberately minimal, huge community",
        body: "Its whole philosophy is to add only what you need, which keeps the scaffold clean, and it is backed by one of the largest communities in the ecosystem. That restraint and support are real, honest advantages.",
      },
    ],
    caissonLine: [
      {
        title: "A scaffold of the core, not a product substrate",
        body: "create-t3-app is upfront that it is not an all-inclusive template: it does not ship billing, multi-tenancy, or any compliance tooling. Caisson is precisely that substrate: tenancy, billing, and the compliance modules as audited packages on a standard Postgres app.",
      },
      {
        title: "Composable packages onto exactly this stack",
        body: "Caisson installs onto a plain Next.js + Postgres app (the same shape create-t3-app scaffolds), so you add fail-closed RLS with isolation tests, a WORM audit trail, and evidence packs without leaving the stack you started on.",
      },
    ],
    rows: [
      {
        label: "Stack",
        caisson: "Next.js + Postgres",
        competitor: "Next.js + Prisma / Drizzle",
      },
      { label: "Typesafe API", caisson: "REST/typed", competitor: "tRPC" },
      { label: "Auth", caisson: true, competitor: "NextAuth.js wiring" },
      { label: "Billing / subscriptions", caisson: true, competitor: false },
      { label: "Organization multi-tenancy", caisson: true, competitor: false },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License / price",
        caisson: "One-time perpetual",
        competitor: "Free (MIT)",
      },
    ],
    whenPickCompetitor:
      "You want a free, minimal, typesafe Next.js starting point and will add product features (billing, tenancy, compliance) yourself.",
    whenPickCaisson:
      "You need the regulated backend (tenancy, billing, database-enforced isolation with tests, and audit evidence) as maintained packages rather than hand-rolled.",
    whenBoth:
      "Scaffold the app with create-t3-app, then add Caisson's tenancy, billing, and Compliance packages onto the same Next.js + Postgres codebase.",
    faq: [
      {
        question: "Is Caisson an alternative to create-t3-app?",
        answer:
          "Only partly: they sit at different layers. create-t3-app scaffolds a free, typesafe Next.js core and stops there by design; Caisson supplies the tenancy, billing, and compliance substrate on top. A team can scaffold with create-t3-app and adopt Caisson's packages for the regulated backend without changing stacks.",
      },
      {
        question: "Does create-t3-app include compliance or multi-tenancy?",
        answer:
          "No. As of 2026-07-07 create-t3-app is explicit that it scaffolds only the typesafe core (Next.js, tRPC, an ORM, and auth wiring) and expects you to bring the rest. Multi-tenant RLS, a WORM audit trail, and evidence packs are outside its scope and are Caisson's core.",
      },
      {
        question: "create-t3-app is free. Why pay for Caisson?",
        answer:
          "Its price is its honest strength for the scaffold. What it doesn't include is the compliance and tenant-isolation substrate (fail-closed RLS with isolation tests, a WORM audit trail, field encryption, and OSCAL evidence packs), which is the maintained, tested code you would pay Caisson for. Caisson's own Base substrate is also open (Apache-2.0).",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // Group B — compliance automation (GRC) platforms. NOT head-to-head: they MONITOR your stack and
  // run the audit workflow; Caisson is the controls in your codebase they inspect. The honest frame
  // is own-vs-rent + compose, and each page says so. Prices: none of these publish public self-serve
  // pricing (all "book a demo"), verified 2026-07-07 — a true, scraped fact, not an invented number.
  {
    slug: "vanta",
    competitor: "Vanta",
    competitorUrl: "https://www.vanta.com",
    category: "Compliance automation platform (GRC SaaS)",
    metaTitle: "Caisson vs Vanta",
    metaDescription:
      "Vanta is the market-leading GRC platform that monitors your stack and automates the audit; Caisson is the code that implements the controls it looks for: fail-closed RLS, a WORM audit trail, and OSCAL evidence packs you own. An honest, dated comparison.",
    answer:
      "These aren't head-to-head: they solve different halves, and the honest answer is often both. Vanta is the category-leading GRC platform: it connects to your stack, continuously monitors it, automates evidence collection, and runs the audit workflow, a subscription that watches whatever you built. Caisson is the code that implements the technical controls Vanta looks for: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your own codebase. Vanta proves your posture; Caisson makes the controls real.",
    heroLede:
      "Vanta monitors your stack and runs the audit. Caisson is the controls in your codebase it inspects. These compose: here is the honest line, own vs rent.",
    competitorPrice: "No public self-serve pricing: quote-based (book a demo)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "The market-leading GRC / trust platform, advertising 16,000+ customers on its live site (verified 2026-07-07).",
      "Continuous monitoring and automated evidence collection across your whole stack (cloud, HR, devices, and vendors), not just your application.",
      "Covers SOC 2, ISO 27001, HIPAA, GDPR, NIST AI RMF, ISO 42001, HITRUST, and FedRAMP, with a Trust Center, questionnaire automation, and third-party risk.",
      "Connects to your infrastructure and watches it; it does not ship the application code that implements the controls.",
    ],
    competitorStrengths: [
      {
        title: "Continuous, org-wide monitoring as a managed program",
        body: "Vanta's reach goes far beyond an app: it integrates across cloud, HR, device, and vendor systems and continuously monitors them, flagging drift the moment it happens. Caisson does not do continuous org-wide monitoring: for that, Vanta is genuinely the leader.",
      },
      {
        title: "The whole audit workflow, run for you",
        body: "Auditor coordination, a hosted Trust Center, automated questionnaires, and the broadest framework catalog turn the audit from a fire drill into a managed program. That operational layer is real and is not something a code library provides.",
      },
    ],
    caissonLine: [
      {
        title: "Vanta watches the controls; Caisson is the controls",
        body: "A monitor inspects code it didn't write. Caisson ships the technical controls themselves (fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator) as source in your codebase, wired and CI-tested before the assessor asks.",
      },
      {
        title: "Own vs rent, and not a substitute",
        body: "Caisson is a one-time perpetual license you own the source of; Vanta is a subscription. And Caisson does not monitor your HR, devices, or vendors or manage your auditor: it is the earlier layer, the controls a platform grades.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      { label: GRC.tprm, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You need continuous org-wide monitoring, an auditor and Trust Center workflow, questionnaire automation, and vendor risk, the audit program run as a service.",
    whenPickCaisson:
      "You want the technical controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time, rather than rented monitoring of code you still have to write.",
    whenBoth:
      "The common reality: implement the controls with Caisson and monitor the rest of your stack plus run the audit with Vanta; the evidence Caisson emits from your own code feeds the platform.",
    faq: [
      {
        question: "Is Caisson a Vanta alternative?",
        answer:
          "Not directly: they operate at different layers and most teams that use one can use both. Vanta is a GRC platform that monitors your stack and runs the audit workflow; Caisson is the code that implements the technical controls Vanta inspects. Caisson doesn't replace continuous monitoring or your auditor, and Vanta doesn't ship the RLS, audit chain, or evidence generator that live in your codebase.",
      },
      {
        question: "Does Caisson replace Vanta's continuous monitoring?",
        answer:
          "No. Caisson is not a monitoring service: it is the controls themselves, as source you own. It generates OSCAL-exportable evidence from your own code, but it does not watch your cloud, HR, devices, or vendors the way Vanta does. For continuous org-wide monitoring, Vanta (or a peer) is the right tool, and Caisson feeds it evidence.",
      },
      {
        question: "Own vs rent: how do the costs compare?",
        answer:
          "Vanta is an annual subscription that renews for as long as you need to stay audit-ready; its live site lists no public self-serve price and is quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (see the licensing section for the live figure) and you own the source. They cover different costs: rented monitoring versus owned controls.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "drata",
    competitor: "Drata",
    competitorUrl: "https://drata.com",
    category: "Compliance automation platform (GRC SaaS)",
    metaTitle: "Caisson vs Drata",
    metaDescription:
      "Drata automates compliance with continuous monitoring, control cross-mapping, and an audit hub; Caisson is the code that implements the controls it collects evidence from: fail-closed RLS, a WORM audit trail, and OSCAL packs you own. An honest, dated comparison.",
    answer:
      "Different layers, and often both. Drata is a deep GRC automation platform: continuous control monitoring, automatic control cross-mapping across frameworks, evidence collection, a Trust Center, and questionnaire automation, a subscription that keeps you continuously audit-ready. Caisson is the code that implements the controls Drata monitors: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your own codebase. Drata proves and cross-maps your posture; Caisson is the posture, as source.",
    heroLede:
      "Drata automates and cross-maps your compliance program. Caisson is the controls in your codebase it collects from. These compose: here is the honest line.",
    competitorPrice: "No public self-serve pricing: quote-based (get started)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "A GRC / trust-management platform advertising 8,500+ customers and a 4.8 G2 rating on its live site (verified 2026-07-07).",
      "Continuous monitoring, automated evidence collection, and control cross-mapping so one control maps across multiple frameworks and stays audit-ready.",
      "A Trust Center, questionnaire automation, and third-party risk management, increasingly driven by autonomous AI agents.",
      "Connects to your stack and collects evidence from it; it does not ship the application controls that produce that evidence.",
    ],
    competitorStrengths: [
      {
        title: "Deep automation and control cross-mapping",
        body: "Drata's strength is breadth of automation: map a control once and reuse it across frameworks, with continuous monitoring and guided remediation. For a team scaling from one framework to several, that cross-mapping is a genuine time-saver Caisson does not attempt.",
      },
      {
        title: "A full audit hub and Trust Center",
        body: "Evidence collection, an audit hub, a Trust Center, and questionnaire automation run the ongoing program. That operational layer (the workflow around an audit) is real and is not what a code library provides.",
      },
    ],
    caissonLine: [
      {
        title: "Drata collects the evidence; Caisson produces it",
        body: "Drata pulls evidence from the systems you built. Caisson is those systems' controls (fail-closed RLS with isolation tests, a hash-chained audit trail, and an evidence-pack generator) as source you own, CI-tested on every push, emitting OSCAL evidence a platform can ingest.",
      },
      {
        title: "One-time, and not a substitute",
        body: "Caisson is a one-time perpetual license you own the source of; Drata is a subscription. Caisson does not cross-map frameworks across your org or manage your auditor: it is the earlier layer, the implemented controls.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      { label: GRC.tprm, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You need continuous monitoring, control cross-mapping across many frameworks, an audit hub, and a Trust Center, the audit program automated and run for you.",
    whenPickCaisson:
      "You want the implemented controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time.",
    whenBoth:
      "Implement the controls with Caisson and automate the program with Drata; Caisson emits the OSCAL evidence Drata would otherwise collect from your stack.",
    faq: [
      {
        question: "Is Caisson a Drata alternative?",
        answer:
          "They sit at different layers and commonly coexist. Drata is a GRC platform that monitors your stack and cross-maps controls across frameworks; Caisson is the code that implements the controls it collects evidence from. Caisson doesn't replace Drata's monitoring or audit hub, and Drata doesn't ship the RLS, audit chain, or evidence generator that live in your codebase.",
      },
      {
        question: "Does Caisson do control cross-mapping like Drata?",
        answer:
          "Caisson ships framework mappings as code (SOC 2, HIPAA, and EU AI Act controls with OSCAL export), so the evidence packs render against named clauses. It does not run continuous, org-wide control cross-mapping across your whole stack the way Drata's platform does; that program-level automation is Drata's strength, and Caisson feeds it evidence.",
      },
      {
        question: "How do the pricing models differ?",
        answer:
          "Drata is an annual subscription with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (the live figure is in the licensing section) where you own the source. One rents automation of your program; the other is the owned controls underneath it.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "secureframe",
    competitor: "Secureframe",
    competitorUrl: "https://secureframe.com",
    category: "Compliance automation platform (GRC SaaS)",
    metaTitle: "Caisson vs Secureframe",
    metaDescription:
      "Secureframe automates multi-framework compliance (including CMMC/defense) with continuous monitoring and AI remediation; Caisson is the code that implements the controls it checks: fail-closed RLS, a WORM audit trail, and OSCAL packs you own. An honest, dated comparison.",
    answer:
      "Different halves of the same problem. Secureframe is a multi-framework GRC platform: automated evidence collection, continuous monitoring, personnel and vendor and asset management, AI remediation, and a defense-focused CMMC track, a subscription that manages the compliance program. Caisson is the code that implements the technical controls Secureframe verifies: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your codebase. Secureframe runs the program; Caisson is the controls it inspects.",
    heroLede:
      "Secureframe manages a multi-framework compliance program. Caisson is the controls in your codebase it verifies. These compose: here is the honest line.",
    competitorPrice:
      "No public self-serve pricing: quote-based (schedule a demo)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "A GRC platform advertising 6,000+ customers on its live site (verified 2026-07-07), with automated evidence collection and continuous monitoring.",
      "Broad framework coverage (SOC 2, ISO 27001, HIPAA, PCI DSS, GDPR, NIST) plus a purpose-built CMMC / defense (Secureframe Defense) track for the Defense Industrial Base.",
      "Personnel management, vendor management, vendor access, and asset inventory, with AI-assisted remediation and risk (Comply AI).",
      "Connects to your stack to test and monitor it; it does not ship the application controls it checks for.",
    ],
    competitorStrengths: [
      {
        title: "Broad framework coverage as a managed service",
        body: "Secureframe's range (from SOC 2 and ISO 27001 to a dedicated CMMC track for defense contractors) plus continuous monitoring and expert support is a genuine, wide-coverage program Caisson does not attempt to run.",
      },
      {
        title: "Org-wide management: people, vendors, assets",
        body: "Personnel, vendor, and asset management with AI-assisted remediation covers the organizational side of compliance: the parts outside the application entirely. That breadth is real and is not what a code library delivers.",
      },
    ],
    caissonLine: [
      {
        title: "Secureframe checks the controls; Caisson implements them",
        body: "Its automated tests inspect the systems you built. Caisson is those controls (fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator) as source you own, CI-tested, emitting OSCAL evidence the platform can ingest.",
      },
      {
        title: "Framework mappings as code you own, one-time",
        body: "Secureframe delivers framework coverage as a subscription service; Caisson delivers SOC 2 / HIPAA / EU AI Act mappings as code with OSCAL export, one-time and owned. It does not manage your personnel, vendors, or auditor: it is the earlier, implemented layer.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      {
        label: "Personnel / vendor / asset management",
        caisson: false,
        competitor: true,
      },
      { label: GRC.tprm, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You need a managed multi-framework program with continuous monitoring, personnel/vendor/asset management, or a CMMC / defense track, compliance run as a service across your org.",
    whenPickCaisson:
      "You want the implemented technical controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time.",
    whenBoth:
      "Implement the controls with Caisson and run the org-wide program with Secureframe; Caisson emits the evidence Secureframe would otherwise collect from your application.",
    faq: [
      {
        question: "Is Caisson a Secureframe alternative?",
        answer:
          "They address different layers and often coexist. Secureframe is a GRC platform that monitors your stack, manages personnel and vendors, and runs a multi-framework program; Caisson is the code that implements the technical controls it checks. Caisson doesn't manage your org or replace continuous monitoring, and Secureframe doesn't ship the RLS, audit chain, or evidence generator in your codebase.",
      },
      {
        question: "Does Caisson cover CMMC or defense like Secureframe?",
        answer:
          "No. Secureframe's CMMC / defense track is a purpose-built program for the Defense Industrial Base, which Caisson does not offer. Caisson ships SOC 2, HIPAA, and EU AI Act mappings with OSCAL export as code you own; for CMMC-specific program management, Secureframe (or a peer) is the fit, and Caisson can supply implemented controls beneath it.",
      },
      {
        question: "How do the two price?",
        answer:
          "Secureframe is an annual subscription with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (see the licensing section for the live figure) with the source owned. One rents program management; the other is the owned controls underneath.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "sprinto",
    competitor: "Sprinto",
    competitorUrl: "https://sprinto.com",
    category: "Compliance automation platform (GRC SaaS)",
    metaTitle: "Caisson vs Sprinto",
    metaDescription:
      "Sprinto is a startup-focused autonomous trust platform that scopes and runs your first SOC 2; Caisson is the code that implements the controls it monitors: fail-closed RLS, a WORM audit trail, and OSCAL packs you own. An honest, dated comparison.",
    answer:
      "Different layers, and a startup often wants both. Sprinto is an autonomous trust platform aimed at fast-moving startups: it scopes your SOC 2, ISO 27001, or HIPAA program, connects to your systems, closes gaps, and runs continuous compliance across 200+ frameworks, a subscription acting as your compliance operator. Caisson is the code that implements the controls Sprinto monitors: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your codebase. Sprinto runs the program; Caisson is the controls it validates.",
    heroLede:
      "Sprinto is the guided first-compliance operator for startups. Caisson is the controls in your codebase it monitors. These compose: here is the honest line.",
    competitorPrice: "No public self-serve pricing: quote-based (book a demo)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "An autonomous trust / GRC platform advertising 3,000+ companies from Series A to enterprise (verified 2026-07-07), positioned as a startup's first compliance operator.",
      "Scopes and runs SOC 2, ISO 27001, and HIPAA programs across 200+ frameworks, connecting to your systems and closing gaps with continuous monitoring.",
      "Autonomous third-party risk management and AI governance: it detects change, determines risk, and acts, with you approving decisions.",
      "Connects to and monitors your systems; it does not ship the application controls it checks.",
    ],
    competitorStrengths: [
      {
        title: "A guided first-SOC-2 operator for startups",
        body: "Sprinto's positioning is genuine leverage for an early team with no compliance owner: it scopes the program, connects to your systems, and drives you to audit readiness. For getting a first SOC 2 fast without hiring, that guided-operator model is a real strength.",
      },
      {
        title: "Continuous program automation and AI governance",
        body: "Continuous monitoring, autonomous TPRM, and AI-governance coverage across 200+ frameworks keep the program running as you scale. That ongoing operational layer is not something a code library provides.",
      },
    ],
    caissonLine: [
      {
        title: "Sprinto runs the program; Caisson is the controls",
        body: "Sprinto monitors and closes gaps in the systems you built. Caisson is those controls (fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator) shipped pre-wired in code and CI-tested on every push, before a platform grades them.",
      },
      {
        title: "One-time and owned, not a subscription operator",
        body: "Caisson is a one-time perpetual license you own the source of; Sprinto is a subscription that runs your program. Caisson does not scope your org, monitor vendors, or manage your auditor: it is the implemented layer beneath the operator.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      { label: GRC.tprm, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You are an early team with no compliance owner and want a guided operator to scope and run your first SOC 2 / ISO 27001, with continuous monitoring and vendor risk handled for you.",
    whenPickCaisson:
      "You want the implemented controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time.",
    whenBoth:
      "Let Sprinto scope and run the program while Caisson implements the controls in your app: the OSCAL evidence Caisson emits is what Sprinto validates and presents.",
    faq: [
      {
        question: "Is Caisson a Sprinto alternative?",
        answer:
          "They work at different layers and a startup often uses both. Sprinto is a platform that scopes and runs your compliance program and monitors your systems; Caisson is the code that implements the controls it validates. Caisson doesn't scope your org or replace continuous monitoring, and Sprinto doesn't ship the RLS, audit chain, or evidence generator that live in your codebase.",
      },
      {
        question: "Does Caisson get me my first SOC 2 like Sprinto?",
        answer:
          "Not on its own. Caisson ships the technical controls and generates the evidence a SOC 2 requires, wired and tested from day one, but it does not scope your program, coordinate your auditor, or manage organizational controls. Sprinto runs that program; Caisson makes the technical evidence real for it to present. You still need an audit.",
      },
      {
        question: "How do the pricing models compare?",
        answer:
          "Sprinto is an annual subscription with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (the live figure is in the licensing section) with the source owned. One rents a running program; the other is the owned controls it runs on.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "scytale",
    competitor: "Scytale",
    competitorUrl: "https://scytale.ai",
    category: "Compliance automation platform (GRC SaaS)",
    metaTitle: "Caisson vs Scytale",
    metaDescription:
      "Scytale is an AI GRC platform with human experts across 80+ frameworks, continuous monitoring, and built-in pentesting; Caisson is the code that implements the controls it monitors: fail-closed RLS, a WORM audit trail, and OSCAL packs you own. An honest, dated comparison.",
    answer:
      "Different layers, frequently both. Scytale is an AI GRC platform paired with human experts: it automates compliance across 80+ frameworks with seamless cross-mapping, continuous control monitoring, a Trust Center, and even a built-in penetration-testing model, a subscription that runs your program end to end. Caisson is the code that implements the controls Scytale monitors: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your codebase. Scytale gives you framework breadth and experts; Caisson gives you implementation depth you own.",
    heroLede:
      "Scytale is broad-framework AI GRC with human experts. Caisson is the controls in your codebase it monitors. These compose: here is the honest line.",
    competitorPrice: "No public self-serve pricing: quote-based (book a demo)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "An AI GRC platform advertising 1,000+ companies and a 4.8 rating (verified 2026-07-07), pairing automation with dedicated human GRC experts.",
      "Supports 80+ security, privacy, and AI frameworks (SOC 2, ISO 27001, ISO 42001, HIPAA, PCI DSS, GDPR, CMMC) with built-in control cross-mapping.",
      "Agentic GRC that collects evidence and monitors controls continuously, plus a Trust Center and an integrated offensive-security / penetration-testing model.",
      "Connects to and monitors your stack; it does not ship the application controls it evaluates.",
    ],
    competitorStrengths: [
      {
        title: "Broad framework coverage plus human experts",
        body: "Scytale's 80+ frameworks with cross-mapping, backed by dedicated GRC experts, is a wide, guided program. For a team that wants many frameworks and hands-on expert help, that breadth-plus-service combination is a genuine strength Caisson does not offer.",
      },
      {
        title: "Built-in penetration testing",
        body: "An integrated offensive-security / pentesting model inside the compliance platform is a distinctive capability: an end-to-end automated testing cycle most GRC tools leave to a separate vendor. That is real and outside a code library's scope.",
      },
    ],
    caissonLine: [
      {
        title: "Scytale monitors the controls; Caisson implements them",
        body: "Its agents collect evidence from the systems you built. Caisson is those controls (fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator) as source you own, CI-tested, emitting OSCAL evidence a platform can ingest.",
      },
      {
        title: "Depth of implementation, owned one-time",
        body: "Scytale sells framework breadth and expert service as a subscription; Caisson ships the depth (the actual RLS, audit, and evidence code) one-time and owned. It does not run pentests, provide GRC experts, or manage your auditor; it is the implemented layer beneath.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      {
        label: "Built-in penetration testing",
        caisson: false,
        competitor: true,
      },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You want breadth across many frameworks with hands-on human experts, cross-mapping, and built-in penetration testing, a guided program run as a service.",
    whenPickCaisson:
      "You want the implemented controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time.",
    whenBoth:
      "Run the multi-framework program and pentests with Scytale while Caisson implements the controls in your app: Caisson emits the OSCAL evidence Scytale monitors and presents.",
    faq: [
      {
        question: "Is Caisson a Scytale alternative?",
        answer:
          "They sit at different layers and commonly coexist. Scytale is an AI GRC platform with human experts that monitors your stack across 80+ frameworks; Caisson is the code that implements the controls it monitors. Caisson doesn't provide experts, pentesting, or continuous monitoring, and Scytale doesn't ship the RLS, audit chain, or evidence generator in your codebase.",
      },
      {
        question: "Does Caisson include penetration testing like Scytale?",
        answer:
          "No. Scytale's integrated offensive-security / pentesting model is a platform capability Caisson does not offer. Caisson ships the technical controls and OSCAL evidence as code you own; for penetration testing and multi-framework program management, Scytale (or a peer) is the fit, and Caisson supplies the implemented controls beneath it.",
      },
      {
        question: "How do the two price?",
        answer:
          "Scytale is an annual subscription with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (see the licensing section for the live figure) with the source owned. One rents breadth and expertise; the other is the owned depth underneath.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "thoropass",
    competitor: "Thoropass",
    competitorUrl: "https://thoropass.com",
    category: "Compliance platform + in-house auditor (GRC SaaS)",
    metaTitle: "Caisson vs Thoropass",
    metaDescription:
      "Thoropass bundles the compliance software AND the auditor under one roof, with AI-driven evidence collection; Caisson is the code that implements the controls the audit examines: fail-closed RLS, a WORM audit trail, and OSCAL packs you own. An honest, dated comparison.",
    answer:
      "Different layers, and a natural pairing. Thoropass is distinctive among GRC platforms: it bundles the compliance software AND the audit itself under one roof: in-house auditors plus AI-driven evidence collection across SOC 2, ISO 27001, HIPAA, PCI DSS, and HITRUST. Caisson is the code that implements the controls that audit examines: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs, one-time, in your codebase. Thoropass gives you the audit path end to end; Caisson gives you the controls the auditor inspects.",
    heroLede:
      "Thoropass bundles the software and the auditor in one place. Caisson is the controls in your codebase the audit examines. These compose: here is the honest line.",
    competitorPrice:
      "No public self-serve pricing: quote-based (start your audit)",
    competitorLicense:
      "Annual SaaS subscription + audit engagement (recurring).",
    competitorFacts: [
      "A compliance platform trusted by 1,000+ organizations (verified 2026-07-07) that combines audit software with in-house audit experts: the auditor and the tooling under one roof.",
      "Covers SOC 2, ISO 27001, GDPR, PCI DSS, HITRUST, and HIPAA with real-time control views and automated validation.",
      "AI-powered evidence collection paired with an auditor-led model: the assurance team performs the audit, not just the prep.",
      "Runs the audit and collects evidence from your stack; it does not ship the application controls the audit examines.",
    ],
    competitorStrengths: [
      {
        title: "The auditor and the software in one place",
        body: "Thoropass's differentiator is genuine: it bundles in-house auditors with the compliance tooling, so audit prep and the audit itself live under one roof. For a team that wants a single accountable path to a signed report, that is a real advantage no code library offers.",
      },
      {
        title: "Auditor-led, AI-powered evidence collection",
        body: "Experienced assurance partners plus AI-driven evidence collection reduce the lift on your team and shorten the cycle. That end-to-end audit service is real and is well outside what Caisson provides.",
      },
    ],
    caissonLine: [
      {
        title: "Thoropass audits the controls; Caisson implements them",
        body: "Its auditors and agents examine the systems you built. Caisson is those controls (fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator) as source you own, CI-tested, emitting OSCAL evidence an auditor can review.",
      },
      {
        title: "Own the evidence pipeline, one-time",
        body: "Thoropass sells the audit path and evidence collection as a service; Caisson ships the evidence pipeline itself (the code that produces byte-stable OSCAL packs) one-time and owned. It does not perform your audit or sign your report; it is the implemented layer the auditor inspects.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      {
        label: "In-house auditor / signed audit engagement",
        caisson: false,
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      { label: SUBSTRATE.signing, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Subscription + audit engagement",
      },
    ],
    whenPickCompetitor:
      "You want a single accountable path to a signed audit: the compliance software and the auditor bundled, with evidence collection handled for you.",
    whenPickCaisson:
      "You want the implemented controls and evidence pipeline (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as code you own and test in CI, one-time.",
    whenBoth:
      "Implement the controls with Caisson and take the audit path with Thoropass: the OSCAL evidence Caisson emits is what Thoropass's auditors examine and validate.",
    faq: [
      {
        question: "Is Caisson a Thoropass alternative?",
        answer:
          "They operate at different layers and pair naturally. Thoropass bundles the audit software and the auditor and collects evidence from your stack; Caisson is the code that implements the controls the audit examines. Caisson does not perform or sign an audit, and Thoropass does not ship the RLS, audit chain, or evidence generator that live in your codebase.",
      },
      {
        question: "Does Caisson replace the auditor Thoropass provides?",
        answer:
          "No. Caisson ships the technical controls and generates the evidence an audit requires, but the audit itself, the auditor, and the signed report stay separate: Thoropass's in-house auditors are exactly that service. No codebase can certify you. Caisson makes the technical evidence real and ready before the assessor asks.",
      },
      {
        question: "How do the two price?",
        answer:
          "Thoropass is a subscription plus an audit engagement, with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (the live figure is in the licensing section) with the source owned. One is the audit path as a service; the other is the owned controls the audit examines.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  {
    slug: "delve",
    competitor: "Delve",
    competitorUrl: "https://delve.co",
    category: "AI-native compliance platform (GRC SaaS)",
    metaTitle: "Caisson vs Delve",
    metaDescription:
      "Delve is an AI-native compliance platform whose agents auto-collect evidence; Caisson is the code that implements the controls: evidence an auditor can verify without trusting any vendor. An honest, dated comparison, including the 2026 fabricated-reports allegations.",
    answer:
      "Different layers, and since March 2026, a live trust question. Delve is an AI-native compliance platform: autonomous agents gather screenshot evidence, fill out security questionnaires, and scan your infrastructure daily, backed by 1:1 Slack support. In March 2026 it was publicly accused of delivering AI-fabricated SOC 2 reports to hundreds of customers (TechCrunch, 2026-03-22; one named customer confirmed exposure). Those are reported allegations, not findings, but they reframed the category's buying question: can you verify your compliance evidence without trusting the vendor that collected it? Caisson's answer is structural: the controls live in your codebase, and the evidence is deterministic, hash-chained, and anchored outside your database, verifiable by your auditor with no trust in a collector required.",
    heroLede:
      "Delve's AI agents collect your evidence. Caisson is the controls in your codebase: producing evidence anyone can verify without trusting the collector. After 2026's fabricated-reports allegations, that difference is the story.",
    competitorPrice: "No public self-serve pricing: quote-based (book a demo)",
    competitorLicense: "Annual SaaS subscription (recurring).",
    competitorFacts: [
      "An AI-native compliance platform whose autonomous agents auto-collect evidence, take screenshots, fill security questionnaires, and scan infrastructure daily (verified 2026-07-07).",
      "Covers SOC 2, HIPAA, GDPR, ISO 27001, and FedRAMP, and customizes controls to your team, integrations, and risk tolerance.",
      "Positions itself as a compliance partner, not just software: 1:1 Slack support with security experts responding in minutes, plus a free trust center.",
      "Connects to and scans your infrastructure; it does not ship the application controls it evaluates.",
      "In March 2026, Delve (YC-backed, $32M raised) was publicly accused of delivering AI-fabricated SOC 2 reports to 400+ customers (TechCrunch, 2026-03-22; licens.io, 2026-04-03). One named customer, Lovable, publicly confirmed exposure, and Delve published its own response (2026-03-20/21). The incident was still the category's cautionary reference in vendor roundups as of 2026-06-28. These are reported allegations, dated: read the primary reporting.",
    ],
    competitorStrengths: [
      {
        title: "AI-native evidence collection with expert support",
        body: "Delve's autonomous agents handling screenshots, questionnaires, and daily scans (backed by fast 1:1 expert Slack support) is a genuinely modern, low-lift onboarding. For a team that wants compliance busywork off their plate quickly, that AI-plus-human model is a real strength.",
      },
      {
        title: "Customized controls and a partner posture",
        body: "Tailoring controls to your stack and risk tolerance, with experts on hand, is more hands-on than a pure self-serve tool. That partner posture is real and is not what a code library provides.",
      },
    ],
    caissonLine: [
      {
        title: "Verification that doesn't require trust",
        body: "The 2026 allegations reframed what compliance evidence is worth: evidence you can't independently verify is a promise, not proof. Caisson's audit trail is hash-chained and anchored write-once outside your database, and its evidence packs are deterministic and byte-stable: your auditor can check integrity without trusting Caisson, a collector, or an AI agent. That property is the product.",
      },
      {
        title: "Delve collects evidence; Caisson produces it deterministically",
        body: "Delve's agents gather evidence from the systems you built, screenshot by screenshot. Caisson is those controls (fail-closed RLS with isolation tests, a hash-chained audit trail, and an evidence-pack generator that emits byte-stable OSCAL) as source you own, CI-tested on every push, so the evidence is reproducible rather than re-collected.",
      },
      {
        title: "Owned, one-time, in your repo",
        body: "Caisson is one-time and owned, not a subscription: it does not monitor your org or manage your auditor, and its evidence packs are versioned in your repo where they can be re-generated and re-verified at any time.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      {
        label: "AI agents auto-collect evidence + answer questionnaires",
        caisson: "deterministic OSCAL packs",
        competitor: true,
      },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      {
        label: "Evidence verifiable without trusting the vendor",
        caisson: "hash chain + external write-once anchor",
        competitor: false,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
      {
        label: "License model",
        caisson: "One-time perpetual, own the source",
        competitor: "Annual subscription",
      },
    ],
    whenPickCompetitor:
      "You want AI agents to collect evidence and answer questionnaires with fast expert support (compliance busywork taken off your plate as a service), and you've done your own diligence on the vendor.",
    whenPickCaisson:
      "You want the implemented controls and evidence your auditor can verify independently of any vendor (RLS with isolation tests, an externally anchored WORM audit trail, and byte-stable OSCAL packs) as code you own and test in CI, one-time.",
    whenBoth:
      "The layers still compose: a GRC platform can present evidence Caisson's code produces. The 2026 episode is the argument for owning the evidence layer no matter which platform presents it: deterministic, externally anchored evidence stays verifiable regardless of who collects, summarizes, or files it.",
    faq: [
      {
        question: "Is Caisson a Delve alternative?",
        answer:
          "They sit at different layers. Delve is an AI-native platform whose agents collect evidence and scan your stack; Caisson is the code that implements the controls it evaluates. Caisson doesn't run AI evidence-collection agents or provide expert support, and Delve doesn't ship the RLS, audit chain, or evidence generator that live in your codebase. What Caisson does offer that no collection service can: evidence whose integrity is checkable without trusting the collector.",
      },
      {
        question: "What are the Delve fabricated-reports allegations?",
        answer:
          "In March 2026, reporting alleged that Delve delivered AI-fabricated SOC 2 reports to 400+ customers (TechCrunch, 2026-03-22; licens.io, 2026-04-03). One named customer, Lovable, publicly confirmed exposure; Delve published its own response the same week. They remain reported allegations: read the primary sources. The relevance here is not the verdict but the question it surfaced: AI-collected compliance evidence is only as trustworthy as its collector. Caisson's evidence model (hash-chained, anchored write-once outside your database, deterministic to the byte) is built so that question never has to be asked.",
      },
      {
        question:
          "How is Caisson's evidence different from Delve's AI collection?",
        answer:
          "Delve's agents gather evidence from your systems (screenshots, questionnaire answers, scans), and you trust the gathering. Caisson's evidence-pack generator produces deterministic, byte-stable OSCAL packs from your own code, versioned in your repo, re-runnable in CI, and verifiable against an external write-once anchor. One is collected and trusted; the other is produced and provable.",
      },
      {
        question: "How do the two price?",
        answer:
          "Delve is an annual subscription with no public self-serve price, quote-based as of 2026-07-07. Caisson's Compliance bundle is a one-time perpetual license (see the licensing section for the live figure) with the source owned. One rents AI-driven collection; the other is the owned controls that produce the evidence.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // The closest wedge-to-wedge target: a hash-chained audit-log SDK + SOC 2 prep layer sold as a
  // subscription. Facts verified 2026-07-10 (per-record `accessed`); parity research:
  // outputs/research/auditkit-parity-2026-07-10.md (CAISSON-76). Their GRC-lite workflow features
  // are real strengths and stay in.
  {
    slug: "auditkit",
    accessed: "2026-07-10",
    competitor: "AuditKit",
    competitorUrl: "https://auditkit.dev",
    category: "Audit-log SDK + SOC 2 prep platform (subscription)",
    metaTitle: "Caisson vs AuditKit",
    metaDescription:
      "AuditKit is a subscription audit-log SDK plus SOC 2 prep platform (hash-chained logs, evidence vault, $99–999+/mo); Caisson is the owned compliance substrate (externally anchored WORM chain, field encryption, deterministic OSCAL evidence packs), one-time source you own. An honest, dated comparison.",
    answer:
      "The closest wedge-to-wedge comparison on this list. AuditKit ships hash-chained, tamper-evident audit logs plus a SOC 2 prep layer (evidence vault, 51 pre-built controls, policy templates, access reviews) as a subscription: AGPLv3 core, with its differentiated features in a commercially-licensed /ee directory, and a managed cloud at $99–$999+/mo. Caisson ships the compliance substrate as source you own outright: a WORM audit chain anchored write-once outside your database, per-tenant field encryption with crypto-shred, deterministic evidence generation that refuses to guess, and NIST OSCAL export, one-time, licensed per organization. Rent the audit-log service, or own the audit infrastructure.",
    heroLede:
      "AuditKit rents you tamper-evident audit logs and SOC 2 prep as a subscription. Caisson sells you the audit infrastructure as source you own. Here is the honest line.",
    competitorPrice:
      "$99–$999+/mo published tiers (subscription, event-volume-metered)",
    competitorLicense:
      "AGPLv3 core; the /ee feature directory requires a commercial license even when self-hosting; managed cloud is a subscription.",
    competitorFacts: [
      "A TypeScript audit-log SDK (SHA-256 hash-chained events, Ed25519-signed uploads, an embeddable React viewer) plus a SOC 2 prep layer: evidence vault, 51 pre-built controls, 15 policy templates, access-review campaigns, vendor tracking, and a risk register (verified 2026-07-10).",
      "Tier-gated: access-review campaigns sit in Pro ($299/mo) and up, Merkle-tree batch proofs and the auditor-collaboration portal in Business ($499/mo) and up; SSO/SCIM and the GraphQL API live in the /ee directory, which requires a commercial license even for self-hosters (auditkit.dev + repo README, 2026-07-10).",
      "Client SDKs in TypeScript, Python, Go, and Java; exports PDF, CSV, JSON, OCSF, and CEF for SIEM ingestion.",
      'Positions directly against GRC platforms ("80% cheaper vs Vanta/Drata") with a self-hostable AGPLv3 core via Docker Compose.',
    ],
    competitorStrengths: [
      {
        title: "Turnkey SOC 2 prep workflow breadth",
        body: "Access-review campaigns, vendor tracking, a general risk register, pre-written policy templates, and an auditor-collaboration portal are real workflow features Caisson does not ship. A team that wants the audit-prep busywork managed inside one tool gets genuine coverage here.",
      },
      {
        title: "Multi-language SDKs and batch proofs",
        body: "Native TypeScript, Python, Go, and Java SDKs reach stacks Caisson's TS/Bun substrate does not, and Merkle-tree batch proofs (Business tier) are an efficient verification primitive Caisson has not implemented.",
      },
      {
        title: "A low subscription entry point",
        body: "At $99/mo entry, the initial commitment is small, a real advantage for a team that wants tamper-evident logging this week without a purchase decision.",
      },
    ],
    caissonLine: [
      {
        title: "The root of trust lives outside your database",
        body: "AuditKit's chain verification reads the same database the chain lives in. Caisson's WORM anchor is written once, externally (S3 Object-Lock, GCS, R2) on every append, so wholesale DB rewrites and tail truncation are detectable against a root of trust no DB admin can alter. Chain-break detection alone can't make that guarantee.",
      },
      {
        title: "Evidence is generated, not gathered",
        body: "AuditKit's evidence vault is upload-then-hash: a human still collects the artifact (their own copy: evidence collection \"consumes 60-70% of total compliance effort\"). Caisson's collectors derive evidence from live system state, canonicalize it to identical bytes for identical inputs, hard-refuse to ship an incomplete pack, and export NIST OSCAL v1.2.2 validated in CI.",
      },
      {
        title: "One purchase, the whole surface, per organization",
        body: "No feature tier sits above you: the Compliance bundle ships its entire source (chain, anchors, field encryption, crypto-shred, evidence generation, crosswalks) for one per-organization license. Everyone your company authorizes works with the code; nothing is gated behind a higher subscription or a second /ee license.",
      },
    ],
    rows: [
      {
        label: "Tamper-evident hash-chained audit log",
        caisson: true,
        competitor: true,
      },
      {
        label: "External write-once root of trust (WORM anchor outside the DB)",
        caisson: true,
        competitor: false,
      },
      {
        label: "Tail-truncation detection (anchor as length oracle)",
        caisson: true,
        competitor: "chain-break detection",
      },
      {
        label: SUBSTRATE.fieldCrypto,
        caisson: true,
        competitor: false,
      },
      {
        label: "GDPR/CCPA erasure automation + crypto-shred",
        caisson: true,
        competitor: false,
      },
      {
        label: "Machine-readable compliance export",
        caisson: "OSCAL v1.2.2 (NIST), CI-validated",
        competitor: "PDF / CSV / JSON / OCSF / CEF",
      },
      {
        label: "Access reviews, vendor tracking, policy templates",
        caisson: false,
        competitor: "Pro tier ($299/mo) and up",
      },
      {
        label: "Auditor delivery",
        caisson: "signed, downloadable evidence pack",
        competitor: "hosted portal (Business tier)",
      },
      {
        label: "License model",
        caisson: "One-time perpetual, per-org, full source",
        competitor: "Subscription; /ee needs a commercial license",
      },
    ],
    whenPickCompetitor:
      "You want a hosted audit-log service plus a managed SOC 2 prep workflow (access reviews, vendor tracking, policy templates, an auditor portal) at a low monthly entry, and renting it is fine.",
    whenPickCaisson:
      "You want the audit chain, encryption, and evidence generation as code you own (externally anchored, deterministic, OSCAL-exporting) for one per-organization purchase, with no feature tier above you.",
    whenBoth:
      "Less natural to pair than a GRC platform: the two overlap on the audit-log wedge itself. If you run AuditKit's SOC 2 prep workflow, Caisson's substrate can still own the in-app controls (RLS, field encryption, erasure); but most teams will pick one owner for the evidence chain.",
    faq: [
      {
        question: "Is Caisson an AuditKit alternative?",
        answer:
          "On the tamper-evident audit-log and compliance-evidence wedge, yes, with a different model: AuditKit is a subscription service (SDK + managed API + prep workflow), Caisson is source-owned infrastructure. On the GRC-workflow features (access reviews, vendor tracking, policy templates, auditor portal), no: AuditKit ships those and Caisson doesn't; Caisson's substitute for the portal is a signed, downloadable evidence pack.",
      },
      {
        question: "Both say self-hostable. What does that include?",
        answer:
          "AuditKit's AGPLv3 core self-hosts via Docker Compose, but its differentiated features (Merkle batch proofs, SSO/SCIM, the GraphQL API, the auditor portal) live in the /ee directory, which requires a commercial license even when self-hosting (repo README, 2026-07-10). Caisson's Compliance bundle ships its entire feature surface as source for one purchase; the base substrate is Apache-2.0.",
      },
      {
        question: "How do the two price?",
        answer:
          "AuditKit publishes $99–$999+/mo subscription tiers, metered by event volume (auditkit.dev, 2026-07-10). Caisson's Compliance bundle is a one-time perpetual license per organization (see the licensing section for the live figure) with 12 months of updates included and the source yours either way. One is a metered service; the other is owned infrastructure.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // The closest philosophical comparable — both open-source, dev-owned. The honest distinction is
  // platform-vs-library, monitors-vs-implements, and AGPLv3-copyleft-vs-Apache-permissive. Write it
  // fairly: Comp AI is a real, capable open-source GRC platform.
  {
    slug: "comp-ai",
    competitor: "Comp AI",
    competitorUrl: "https://www.trycomp.ai",
    category: "Open-source compliance automation platform (GRC)",
    metaTitle: "Caisson vs Comp AI",
    metaDescription:
      "Comp AI is an open-source (AGPLv3) GRC platform you self-host to monitor your stack and collect evidence; Caisson is an Apache-2.0 infrastructure library that implements the controls a platform inspects: fail-closed RLS, a WORM audit trail, and OSCAL packs. An honest, dated comparison.",
    answer:
      "This is the closest philosophical comparable, and the honest distinction is platform vs library. Comp AI is an open-source (AGPLv3) GRC platform: self-hostable on Bun and Postgres, with 580+ integrations and AI agents that automate evidence collection and continuous monitoring across SOC 2, ISO 27001, HIPAA, and GDPR. Caisson is an Apache-2.0 infrastructure library you compose into your app: fail-closed Postgres RLS with isolation tests, a WORM + hash-chained audit trail, per-tenant field encryption, and OSCAL evidence packs: the controls a platform like Comp AI inspects. Comp AI is the compliance program you run; Caisson is the controls in the app it watches.",
    heroLede:
      "Comp AI is an open-source GRC platform you run. Caisson is an Apache-2.0 library that implements the controls a platform inspects. Both are dev-owned: here is the honest line.",
    competitorPrice:
      "Self-host: free, no license fee (AGPLv3) · managed cloud: quote-based",
    competitorLicense:
      "Open-core: the platform is AGPLv3 (a network-deployed derivative must be open-sourced); managed cloud is commercial.",
    competitorFacts: [
      "An open-source, AI-native GRC platform (github.com/trycompai/comp), self-hostable on Node 20+, Bun 1.1.36+, and PostgreSQL 15+ (verified 2026-07-07).",
      "580+ integrations with AI agents that automate evidence collection, policy generation, and continuous monitoring across SOC 2, ISO 27001, HIPAA, GDPR, and FedRAMP; advertises 830+ companies.",
      "1:1 Slack support with in-house experts and a live Trust Center to share compliance status with prospects.",
      "Self-host has no license fee; the platform is AGPLv3 (copyleft), and managed cloud is a commercial, quote-based subscription.",
    ],
    competitorStrengths: [
      {
        title: "A genuinely open-source GRC platform you can self-host",
        body: "Comp AI is a real, capable compliance platform whose code is open and self-hostable at no license fee: AI agents, 580+ integrations, continuous monitoring, and a Trust Center. For a team that wants to run its own dev-owned compliance program, that is a strong, honest offering Caisson does not replicate.",
      },
      {
        title: "Automates the program end to end",
        body: "Evidence collection, policy generation, continuous monitoring, and expert Slack support cover the whole compliance program. That operational breadth (running the audit workflow) is not what an infrastructure library does.",
      },
    ],
    caissonLine: [
      {
        title:
          "Platform vs library: Comp AI runs the program, Caisson is the controls",
        body: "Comp AI is a platform you deploy to monitor your stack and collect evidence; Caisson is a library you compose into the app itself: fail-closed RLS with isolation tests, a hash-chained audit trail, WORM storage, and an evidence-pack generator. It is the code the platform inspects, not a second platform.",
      },
      {
        title: "Apache-2.0 permissive vs AGPLv3 copyleft",
        body: "Both are open-source, but the licenses differ where it matters: Caisson's Base is Apache-2.0 (permissive, no copyleft obligation on your product), while Comp AI's platform is AGPLv3, which requires open-sourcing a network-deployed derivative. For a commercial SaaS, that distinction is worth a legal read.",
      },
    ],
    rows: [
      {
        label: GRC.monitor,
        caisson: "from your own app code",
        competitor: true,
      },
      { label: GRC.auditWorkflow, caisson: false, competitor: true },
      { label: GRC.trustCenter, caisson: false, competitor: true },
      {
        label: "Form factor",
        caisson: "Library you compose into your app",
        competitor: "Platform you deploy",
      },
      {
        label: "Open-source license",
        caisson: "Apache-2.0 base (permissive)",
        competitor: "AGPLv3 (copyleft)",
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: false },
      { label: SUBSTRATE.worm, caisson: true, competitor: false },
      { label: SUBSTRATE.evidence, caisson: true, competitor: false },
      { label: SUBSTRATE.fieldCrypto, caisson: true, competitor: false },
    ],
    whenPickCompetitor:
      "You want to run your own open-source, self-hosted GRC platform (monitoring, evidence collection, and a Trust Center) and are comfortable with the AGPLv3 obligation.",
    whenPickCaisson:
      "You want the implemented controls (RLS with isolation tests, a WORM audit trail, and OSCAL evidence) as an Apache-2.0 library composed into your app, one-time and owned.",
    whenBoth:
      "Self-host Comp AI to run the program and use Caisson to implement the controls in your app: a fully dev-owned stack where Caisson emits the evidence Comp AI monitors and presents.",
    faq: [
      {
        question: "Is Caisson a Comp AI alternative?",
        answer:
          "Partly, but they are different form factors. Comp AI is an open-source GRC platform you deploy to monitor your stack and run the audit workflow; Caisson is an infrastructure library you compose into the application itself. Caisson doesn't run continuous monitoring or a Trust Center, and Comp AI doesn't ship the RLS, audit chain, or field encryption that live inside your app. Many dev-owned teams would use both.",
      },
      {
        question: "Both are open-source. What's the licensing difference?",
        answer:
          "It's the copyleft boundary. Comp AI's platform is AGPLv3, so a network-deployed derivative must be open-sourced, worth a legal review if you build a product on its codebase. Caisson's Base substrate is Apache-2.0 (permissive, no copyleft obligation on your product); its compliance modules are commercial one-time licenses. Same open-source spirit, materially different obligations for a commercial SaaS.",
      },
      {
        question: "Does Caisson monitor my stack like Comp AI?",
        answer:
          "No. Caisson is not a monitoring platform: it is the controls as code you own, and it emits OSCAL-exportable evidence from your own app. Continuous monitoring, integrations, and the Trust Center are Comp AI's job. If you want a self-hosted program to watch your stack, run Comp AI; if you want the controls implemented in the app it watches, use Caisson.",
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------
  // Group C — build it yourself. No vendor to scrape: the honest source is Caisson's own committed
  // /build-vs-buy analysis (competitorUrl), whose $80k / 6-9-month figure is the industry cost of a
  // first SOC 2 (labeled as such, not a Caisson quote — ADR-0080 §4). No invented numbers.
  {
    slug: "build-in-house",
    competitor: "building it in-house",
    competitorUrl: "https://caisson.sh/build-vs-buy",
    category: "The do-it-yourself path",
    metaTitle: "Caisson vs building it in-house",
    metaDescription:
      "Build the compliance substrate yourself or own Caisson's source: an honest build-vs-buy look at fail-closed RLS, a WORM audit trail, a hash-chained audit log, and OSCAL export, the person-months to get them right vs a one-time perpetual license you still own.",
    answer:
      "The real default competitor is your own backlog. Building the compliance substrate yourself means writing fail-closed RLS, a tamper-evident audit chain, WORM evidence storage, and an evidence-pack generator from scratch: the load-bearing parts a regulated-SaaS team has to get exactly right the first time; the industry cost of a first SOC 2 built from zero is about $80k and 6–9 months. Caisson ships those controls as source you own, wired and CI-tested from day one, for a one-time perpetual license, and the Apache-2.0 base means you still own and can read every line. Build it if the domain is unusual enough that no library fits; own Caisson if you'd otherwise rebuild what already exists, tested.",
    heroLede:
      "Building the compliance substrate yourself is real work: months of it. Here is the honest build-vs-buy line, and where owning Caisson's source fits.",
    competitorPrice:
      "Your engineering time (industry: ~$80k, 6–9 months for a first SOC 2)",
    competitorLicense: "You own everything you write; no purchase.",
    competitorFacts: [
      "The load-bearing controls to build from scratch: fail-closed RLS, a tamper-evident audit chain, WORM evidence storage, and an evidence-pack generator.",
      "The industry cost of a first SOC 2 built from scratch is about $80k and 6–9 months, an industry figure, not a Caisson quote.",
      // Source: https://appycodes.dev/blog/multi-tenant-architecture-cost-study-2026/ (published
      // 2026-04-08, re-verified live 2026-07-08) — a dev-studio's write-up of engineering hours
      // across its own multi-tenant builds, not an independent/peer-reviewed study; cited here as
      // that, not as authoritative market data. "Architecture Onboarding Cost" (AOC) there is
      // engineering hours to ship a tenancy pattern from scratch: schema design, RLS/policy setup,
      // test coverage, observability, and the tenant onboarding flow — 40 hours for the single-DB
      // tenant_id + RLS pattern specifically, before WORM, field crypto, or an evidence generator.
      "Even the narrowest slice (wiring single-DB tenant_id isolation with Postgres RLS, schema, and tests, before WORM, field crypto, or evidence generation) runs about 40 engineering hours by one outside estimate (Appycodes' 2026 write-up of its own multi-tenant builds).",
      "Retrofitting RLS, WORM, and an audit chain into a live database is months more than greenfielding them.",
      "You still need an audit and your organizational controls: no codebase makes you compliant on its own.",
    ],
    competitorStrengths: [
      {
        title: "Exact fit and total control",
        body: "Building it yourself means the controls fit your domain precisely, with no unused surface, and you understand every line because you wrote it. For a team with the security-engineering time and an unusual model, that control is a genuine advantage.",
      },
      {
        title: "No license cost, no vendor dependency",
        body: "There is nothing to buy and no third party in the loop. If your constraint is a zero software budget and full autonomy over the implementation, rolling your own is an honest, valid choice.",
      },
    ],
    caissonLine: [
      {
        title: "The load-bearing parts are the easy ones to get subtly wrong",
        body: "A missed RLS policy is a silent cross-tenant leak; an audit log that isn't truly append-only isn't evidence. Caisson ships these with isolation tests that assert a cross-tenant read fails and a hash-chain verifier that detects tamper, running in CI on every push, not just the day you wrote them.",
      },
      {
        title: "You still own the source",
        body: "Caisson isn't the opposite of owning your code. The Base substrate is Apache-2.0 and you get the source: you are buying the months of load-bearing work already done and tested, then extending it yourself, not renting a black box.",
      },
    ],
    rows: [
      {
        label: "Exact fit to your domain model",
        caisson: "partial",
        competitor: true,
      },
      { label: "No software license cost", caisson: false, competitor: true },
      {
        label: "Wired and CI-tested on day one",
        caisson: true,
        competitor: false,
      },
      { label: SUBSTRATE.rls, caisson: true, competitor: "you build it" },
      { label: SUBSTRATE.worm, caisson: true, competitor: "you build it" },
      { label: SUBSTRATE.evidence, caisson: true, competitor: "you build it" },
      {
        label: "Maintained + framework-mapping updates",
        caisson: true,
        competitor: false,
      },
      {
        label: "You own and can read every line",
        caisson: true,
        competitor: true,
      },
    ],
    whenPickCompetitor:
      "You have the security-engineering time, an unusual domain no library fits, and compliance is far enough out that months of build cost is acceptable.",
    whenPickCaisson:
      "You'd otherwise spend months rebuilding fail-closed RLS, WORM, a hash-chained audit trail, and OSCAL export that already exist, tested, and you still want to own and read the source.",
    whenBoth:
      "Own the load-bearing substrate from Caisson and build the domain-specific controls yourself on top: the Apache-2.0 base and full source mean it is not all-or-nothing.",
    faq: [
      {
        question: "Isn't building it myself cheaper than buying Caisson?",
        answer:
          "Rarely, once you count the time. Building the controls from scratch runs about $80k and 6–9 months for a first SOC 2, an industry figure, not a Caisson quote. The Compliance bundle is a one-time perpetual license (see the licensing section for the live figure) with the controls wired and tested on day one, and you still own the source. Retrofitting into a live database costs months more.",
      },
      {
        question: "If I buy Caisson, do I still own my code?",
        answer:
          "Yes. Caisson's Base substrate is Apache-2.0 and you get the source: owning Caisson is not the opposite of owning your code. You are buying the months of load-bearing work already done and tested, then extending it yourself. Nothing is a black box, and nothing you bought stops working if you let an optional updates plan lapse.",
      },
      {
        question: "Does either option make me compliant?",
        answer:
          "No, neither a hand-built substrate nor Caisson makes you SOC 2 or HIPAA compliant on its own. Both ship the technical controls; the audit itself and your organizational controls (HR, vendor management, incident response) stay yours. Caisson makes the technical evidence real, testable, and ready before the assessor asks; the compliance determination stays with your team and auditor.",
      },
    ],
  },
] as const;

/** Lookup a comparison by slug. */
export function findComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
