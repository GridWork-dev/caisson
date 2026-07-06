# @caisson/site

## 0.2.0

### Minor Changes

- 9ca1282: Glossary batches 2 and 3: all 32 locked terms are now live (20 new pages across the
  security, licensing, and AI-infrastructure clusters), with curated cross-links backfilled
  on the batch-1 pilot terms and a glossary section added to llms.txt.

### Patch Changes

- 783110d: Transactional emails now render as branded HTML with a plain-text fallback instead of plain text,
  and a new dev-only preview route shows every template with sample data. The buyer sign-in page
  also gains an email-and-password option alongside the existing magic link, with account
  verification and a forgot/reset password flow.
- 783110d: Cleaned up site copy flagged in a visual audit: dashes used as sentence connectors are now
  commas, colons, semicolons, or periods, matching how the rest of the site already reads.
  Rewrote a cluster of module and pricing descriptions that had fallen into the same "it does
  X, not Y" rhythm on every line, so the marketplace, module, and AI Production Kit pages read
  like they were written section by section instead of from one template. Also thinned out a
  few repeated section labels that were adding a small uppercase tag above nearly every block on
  the module and glossary pages, kept where they carry real information, dropped where the
  heading right below already said the same thing.

  No prices, claims, or page structure changed. This is a copy and typography pass only.

- 783110d: Gave the buyer dashboard's post-purchase pages (license, credits, AI keys, compliance,
  members, activity, plan, overview) a visual polish pass. Forms now share one consistent
  label-and-field look across the dashboard, empty and owner-only states read calmly instead
  of as a stray line of text, the compliance page's three frameworks are now visually
  separated instead of running together, the members "add a seat" field explains that
  invite-by-email isn't available yet, and the activity page now says when it's showing
  credit-ledger history instead of per-call usage detail. No data, permissions, or purchase
  flows changed — this is a presentation-only update.
- 783110d: Fixed two glossary page issues found in a visual audit. The "Related terms" links at the
  bottom of each glossary term page now render in the site's accent link color instead of
  plain body text, so they read as clickable. And the "Definition" section no longer repeats
  the term name a second time right under the page title — it was showing the exact same
  heading twice with no new information.
- 783110d: Added a persistent price and purchase bar pinned to the bottom of the screen on mobile for module
  pages. Previously, on a phone the price and "Add to cart" button could end up far down the page,
  past the full feature list and FAQ, before a visitor found them. Now the price and purchase button
  stay visible at every scroll position on small screens, while the full purchase card — with edition
  bundling and related reading — still appears in its usual place further down the page. Desktop
  layouts are unchanged.
- 3a6f5f1: Platform migration 0013 re-creates every platform tenant-isolation policy with an
  empty-string guard on the session GUC read: a pooled connection whose tenant setting was
  reset to an empty string now always denies instead of coincidentally matching rows. The
  platform migration package is also exported for read-only ledger drift audits.
- 8ab8ccc: Follow-up visual pass after a partial re-audit: the module comparison table now shows the same
  right-edge scroll fade as code samples when a column runs off narrow screens, and its 4th edition
  column is reachable on mobile. Terminal cards no longer clip their status badge when the label is
  long. Placeholder text is readable in light mode on every form across the site (sign-in,
  password-reset, newsletter), not just the ones fixed last time. The docs code samples now match the
  same scroll-fade treatment as the rest of the site. Several hero code/terminal panels (home,
  compliance, agentic-dev, local-first, the EU AI Act page) had their sample text re-wrapped so it no
  longer clips at the card edge. The EULA now keeps a readable line length on desktop, the footer no
  longer overflows the viewport on mobile, and a few small copy/layout bugs (a missing hyphen, an
  orphaned card in a 4-item grid, a monospace numeral style bleeding onto the word "from") are fixed.
- 783110d: Scrollable code samples and terminal output now show a soft fade at the right edge on narrow
  screens, so it's clear there's more to see instead of the content looking cut off. The
  marketplace tab row gets the same treatment when it doesn't fit the screen width. The email
  placeholder text in the product-updates signup now reads clearly in light mode.
- 783110d: Fixed five small display bugs found in a visual audit of the marketing site:

  - The Agent runner module card showed a broken glyph instead of its icon on the modules page.
  - The Alerting module's pricing description had an awkward, hard-to-read sentence.
  - On mobile, three-digit module prices in the stack builder's example (like $199) were cut off to
    two digits (like $19) — a real trust problem on a pricing surface.
  - The glossary's "AI & agent infrastructure" heading rendered with the word gap almost invisible
    on wide screens.
  - The docs sidebar's "Base substrate" section repeated its own name as its only link's label
    instead of a distinct label.

- Updated dependencies [b791198]
- Updated dependencies [b674ed3]
- Updated dependencies [783110d]
- Updated dependencies [dec93f3]
- Updated dependencies [d06a9b8]
- Updated dependencies [defb22e]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [ad66801]
- Updated dependencies [850b844]
- Updated dependencies [aec9f1c]
- Updated dependencies [783110d]
- Updated dependencies [8ab8ccc]
- Updated dependencies [e784af1]
- Updated dependencies [4d7eb71]
- Updated dependencies [783110d]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [783110d]
  - @caisson/ai-kit@0.3.1
  - @caisson/ai-meter@0.3.3
  - @caisson/auth@0.3.0
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/email@0.3.0
  - @caisson/field-crypto@0.2.4
  - @caisson/kernel@0.4.2
  - @caisson/migrate@0.2.4
  - @caisson/observability@0.2.4
  - @caisson/platform-reads@0.1.5
  - @caisson/pricebook@0.4.0
  - @caisson/tenancy-rls@0.4.0
  - @caisson/ui@0.4.0
  - @caisson/billing-orchestration@0.2.0
  - @caisson/brand@0.1.0
  - @caisson/org-controls@0.2.0
  - @caisson/service-license@0.0.5

## 0.1.3

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/field-crypto@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/ai-kit@0.3.0
  - @caisson/tenancy-rls@0.3.2
  - @caisson/service-license@0.0.4
  - @caisson/ai-meter@0.3.2
  - @caisson/auth@0.2.3
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/email@0.2.3
  - @caisson/migrate@0.2.3
  - @caisson/observability@0.2.3
  - @caisson/pricebook@0.3.2
  - @caisson/platform-reads@0.1.4

## 0.1.2

### Patch Changes

- Updated dependencies [4fc006c]
- Updated dependencies [3a7a4fd]
- Updated dependencies [cc7cb8b]
- Updated dependencies [bd9a005]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/pricebook@0.3.1
  - @caisson/billing@0.4.0
  - @caisson/ui@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/platform-reads@0.1.3
  - @caisson/ai-kit@0.2.2
  - @caisson/ai-meter@0.3.1
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/email@0.2.2
  - @caisson/field-crypto@0.2.2
  - @caisson/migrate@0.2.2
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.1.1

### Patch Changes

- 4287ce5: Legal pages carry the Paddle MoR reseller sentence and refund copy grounded in shipped billing behavior.
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
- Updated dependencies [5fd31fe]
- Updated dependencies [44a6414]
- Updated dependencies [959e555]
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [081a1d8]
- Updated dependencies [52c6738]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [f9d58c4]
- Updated dependencies [549dd4e]
- Updated dependencies [6e08cc6]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/ai-kit@0.2.1
  - @caisson/ai-meter@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/pricebook@0.3.0
  - @caisson/field-crypto@0.2.1
  - @caisson/service-license@0.0.2
  - @caisson/ui@0.2.1
  - @caisson/observability@0.2.1
  - @caisson/auth@0.2.1
  - @caisson/platform-reads@0.1.2
  - @caisson/email@0.2.1
  - @caisson/migrate@0.2.1

## 0.1.0

### Minor Changes

- 16526fa: Site marketplace rework (ADR-0189–0196): split the overloaded `/pricing` into three rooms
  — `/pricing` (editions + bundle), `/modules` (faceted à-la-carte catalog), and `/build`
  (compose-a-stack configurator with an honest upgrade nudge). Fold the four editions behind
  a WAI-ARIA Disclosure in the nav and fix the "Get started" label→destination. Differentiate
  the cart drawer (glance) from the rich `/cart` (review), sharing one line-item + one bundle
  -math function, with the drawer rebuilt on a native `<dialog>` for a real focus contract.
  Single "Add to cart" buy verb sitewide; Martian Mono as the sole monospace; a sitewide ⌘K
  search trigger; module `ItemList` structured data; and flat edition prices (drop the
  misleading "from" prefix — the only purchasable price is exactly the number shown).

### Patch Changes

- 84052aa: Backlog P3 defense-in-depth (all private apps, no publish):

  - `@caisson/site`: `AddMemberInput` gains `.strict()` for boundary-schema floor consistency (behavior
    unchanged — the parse object is hand-built, owner-gated, RLS-scoped, parameterized).
  - `@caisson/local-ai-app` + `@caisson/app-compliance`: the demo field-crypto paths (`demoProvider` /
    `createLegHarness`) now **fail closed under `NODE_ENV=production`** instead of silently using the fixed
    demo key vector. Neither app is a deployed service and both handle only synthetic data, so this never
    fires today (tests run under `NODE_ENV=test`; the compliance leg is golden-deterministic so `fromEnv`
    is deliberately NOT used) — pure defense-in-depth against a future deploy routing real data through.

- Updated dependencies [22077d1]
- Updated dependencies [33bee35]
- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [57170c5]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [a07feb0]
- Updated dependencies [9483a36]
  - @caisson/auth@0.2.0
  - @caisson/ai-meter@0.2.0
  - @caisson/ai-kit@0.2.0
  - @caisson/billing@0.2.0
  - @caisson/pricebook@0.2.0
  - @caisson/field-crypto@0.2.0
  - @caisson/observability@0.2.0
  - @caisson/platform-reads@0.1.1
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/email@0.2.0
  - @caisson/migrate@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/ui@0.2.0
  - @caisson/service-license@0.0.1
