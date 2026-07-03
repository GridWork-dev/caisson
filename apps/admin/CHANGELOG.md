# @caisson/admin

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
- Updated dependencies [4fc006c]
- Updated dependencies [bd9a005]
- Updated dependencies [fb8d966]
  - @caisson/service-license@0.0.3
  - @caisson/ui@0.3.0
  - @caisson/kernel@0.4.0
  - @caisson/platform-reads@0.1.3
  - @caisson/audit-worm@0.2.2
  - @caisson/auth@0.2.2
  - @caisson/credits@0.3.1
  - @caisson/observability@0.2.2
  - @caisson/tenancy-rls@0.3.1

## 0.0.2

### Patch Changes

- f9d58c4: Post-wave-hardening triage Bucket B (CAISSON-10/11/12/13), test and proof hygiene, no
  runtime behavior change for buyers.

  - CAISSON-12: root bunfig.toml scopes bun test discovery away from stale compiled dist/
    output, plus a regression test in @caisson/testing.
  - CAISSON-11: apps/admin's PGlite bootstrap now applies the ADR-0218 line-item migrations
    (0008/0009), matching the deploy-migrate chain, plus a columns-contract-style parity test.
  - CAISSON-13: packages/field-crypto's live KMS proof schedules deletion for both throwaway
    CMKs defensively in afterAll, not just the one the last leg reached.
  - CAISSON-10: apps/admin's /business degrade path distinguishes a genuine undefined-table
    error (Postgres 42P01) from any other transient DB error before rendering the
    provisioning hint.

- Updated dependencies [b5915e0]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [afa6070]
- Updated dependencies [95103b6]
- Updated dependencies [aaff518]
- Updated dependencies [904b15b]
- Updated dependencies [549dd4e]
- Updated dependencies [6e08cc6]
  - @caisson/tenancy-rls@0.3.0
  - @caisson/kernel@0.3.0
  - @caisson/credits@0.3.0
  - @caisson/service-license@0.0.2
  - @caisson/ui@0.2.1
  - @caisson/observability@0.2.1
  - @caisson/audit-worm@0.2.1
  - @caisson/auth@0.2.1
  - @caisson/platform-reads@0.1.2

## 0.0.1

### Patch Changes

- Updated dependencies [72ffd85]
- Updated dependencies [59d332f]
- Updated dependencies [6236f59]
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/observability@0.2.0
  - @caisson/platform-reads@0.1.1
  - @caisson/kernel@0.2.0
  - @caisson/credits@0.2.0
  - @caisson/tenancy-rls@0.2.0
  - @caisson/ui@0.2.0
  - @caisson/service-license@0.0.1
