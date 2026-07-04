# @caisson/site

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
