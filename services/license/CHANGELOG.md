# @caisson/service-license

## 0.0.6

### Patch Changes

- Internal hygiene wave: the standards gate's locked-price table moved the Compliance bundle to its
  current price and gained rows for the two retired alias packages; the four private reference apps
  and the root manifest now carry an explicit license field; the license service applies the new
  Developer-plan coverage semantics when computing signed license claims.
- Updated dependencies [8c53ca3]
- Updated dependencies [8170382]
- Updated dependencies
- Updated dependencies
- Updated dependencies [8c53ca3]
- Updated dependencies
- Updated dependencies [8170382]
  - @caisson/audit-worm@0.3.0
  - @caisson/registry-schema@0.4.0
  - @caisson/license-issue@0.0.6
  - @caisson/pricebook@0.5.0
  - @caisson/tenancy-rls@0.5.0
  - @caisson/credits@0.4.1
  - @caisson/billing-orchestration@0.2.1
  - @caisson/jobs@0.4.1
  - @caisson/org-controls@0.2.1
  - @caisson/rate-limit@0.1.2

## 0.0.5

### Patch Changes

- 850b844: Moved the per-account throttle store out of the commercial license service and into the
  new shared, freely licensed rate-limiting package. The open reference application now
  composes this shared store directly for its buyer-facing throttling instead of depending
  on the commercial license service to get it. Buyer-visible throttling behavior is
  unchanged; this only changes where the code lives and removes an unnecessary dependency
  from the open reference application.
- 850b844: Added a new shared rate-limiting package with an in-memory per-client-IP throttle for
  surfaces with no signed-in identity yet. The docs and license services now both import
  this shared limiter instead of each keeping a separate copy of the same logic. The
  internal licensing-boundary check also now recognizes the new package as part of the
  open, freely licensed base set. Buyer-visible throttling behavior, including the limits,
  the retry timing, and which header is trusted for the client IP, is unchanged; this only
  changes where the code lives.
- Updated dependencies [b791198]
- Updated dependencies [aec9f1c]
- Updated dependencies [b674ed3]
- Updated dependencies [d6cc28e]
- Updated dependencies [d06a9b8]
- Updated dependencies [0c883ae]
- Updated dependencies [ad02304]
- Updated dependencies [2834c3f]
- Updated dependencies [41e07b6]
- Updated dependencies [4d7eb71]
- Updated dependencies [90b6dc1]
- Updated dependencies [850b844]
- Updated dependencies [f178f9a]
- Updated dependencies [9efcff2]
- Updated dependencies [4d7eb71]
- Updated dependencies [e784af1]
- Updated dependencies [4d7eb71]
- Updated dependencies [31d6a41]
- Updated dependencies [850b844]
- Updated dependencies [850b844]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [0af4dbf]
- Updated dependencies [4d7eb71]
  - @caisson/audit-worm@0.2.4
  - @caisson/billing@0.5.0
  - @caisson/credits@0.4.0
  - @caisson/jobs@0.4.0
  - @caisson/kernel@0.4.2
  - @caisson/license-issue@0.0.5
  - @caisson/license-verify@0.3.0
  - @caisson/observability@0.2.4
  - @caisson/pricebook@0.4.0
  - @caisson/rate-limit@0.1.1
  - @caisson/registry-schema@0.3.0
  - @caisson/tenancy-rls@0.4.0
  - @caisson/billing-orchestration@0.2.0
  - @caisson/org-controls@0.2.0

## 0.0.4

### Patch Changes

- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
- Updated dependencies [cf66d65]
  - @caisson/audit-worm@0.2.3
  - @caisson/kernel@0.4.1
  - @caisson/tenancy-rls@0.3.2
  - @caisson/billing@0.4.1
  - @caisson/credits@0.3.2
  - @caisson/license-issue@0.0.4
  - @caisson/license-verify@0.2.3
  - @caisson/observability@0.2.3
  - @caisson/pricebook@0.3.2

## 0.0.3

### Patch Changes

- 4fc006c: Admin paid-purchase revoke. service-license: `revokePurchaseAdmin` composes the
  existing source-scoped revoke helpers with the bounded clawback (`creditsGrantedBySource -
creditsClawedForSource`) under `withAdminWrite` in one transaction, a new `purchase_revoke`
  `admin_action_log` action + CHECK migration, and a `license-revocation-store` feeding the registry's edge deny-set. admin: a paid-revoke mutation card with an impact-preview read (active sources +
  projected claw) plus type-to-confirm, and the `/api/admin/entitlement/revoke-purchase` (+
  `/preview`) routes. registry: the Worker deny-set check (`revocation-list.ts`), wired
  fail-open into `entitlement-filter.ts`/`deploy-entry.ts` so a fetch/parse failure never blocks an
  install.
- Updated dependencies [3a7a4fd]
- Updated dependencies [cc7cb8b]
- Updated dependencies [fb8d966]
- Updated dependencies [fb8d966]
  - @caisson/pricebook@0.3.1
  - @caisson/billing@0.4.0
  - @caisson/kernel@0.4.0
  - @caisson/audit-worm@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/license-issue@0.0.3
  - @caisson/license-verify@0.2.2
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

- 95103b6: Money-path hardening. `parsePaddleEvent` now correlates
  `items[]` to `details.line_items[]` by their shared `price_id` instead of array position, and fails
  closed on a duplicate non-empty per-line join id; a malformed adjustment item now signals through an
  optional `onWarn` callback, threaded all the way from `PaddleConfig` through `verifyAndParse` and
  wired to `services/license`'s stderr telemetry, instead of a silent skip. `@caisson/credits` gains
  `creditsClawedForSource`, which `services/license`'s `applyBillingEvent` uses to bound BOTH a
  whole-transaction `type:full` refund claw AND a per-line partial claw to the purchase's
  granted-minus-already-clawed remainder regardless of delivery order, never spilling onto another
  purchase's credits. `@caisson/tenancy-rls` gains `buildAdminSelectPolicySql`, a SELECT-only
  cross-tenant policy variant; `services/license`'s admin mutation surface now uses it (rather than the
  write variant) for its read-only `account_member` existence check, and (`grantEntitlementAdmin` /
  `adjustCreditsAdmin`) fails closed with a 404 on a nonexistent target account, rolling back the whole
  transaction before any entitlement or credit row commits.
- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.
- Updated dependencies [b5915e0]
- Updated dependencies [b5915e0]
- Updated dependencies [20d5ab0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [52c6738]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
  - @caisson/registry-schema@0.2.1
  - @caisson/tenancy-rls@0.3.0
  - @caisson/billing@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/pricebook@0.3.0
  - @caisson/observability@0.2.1
  - @caisson/license-issue@0.0.2
  - @caisson/audit-worm@0.2.1
  - @caisson/license-verify@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [5b57c78]
- Updated dependencies [9483a36]
  - @caisson/billing@0.2.0
  - @caisson/pricebook@0.2.0
  - @caisson/observability@0.2.0
  - @caisson/registry-schema@0.2.0
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/license-verify@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/license-issue@0.0.1
