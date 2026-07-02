# @caisson/site

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

- 84052aa: Backlog P3 defense-in-depth (from the PR#35 sibling sweep; all private apps, no publish):

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
