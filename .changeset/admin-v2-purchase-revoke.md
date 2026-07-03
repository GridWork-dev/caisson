---
"@caisson/service-license": patch
"@caisson/admin": patch
"@caisson/registry": patch
---

Admin paid-purchase revoke. service-license: `revokePurchaseAdmin` composes the
existing source-scoped revoke helpers with the bounded clawback (`creditsGrantedBySource -
creditsClawedForSource`) under `withAdminWrite` in one transaction, a new `purchase_revoke`
`admin_action_log` action + CHECK migration, and a `license-revocation-store` feeding the registry's edge deny-set. admin: a paid-revoke mutation card with an impact-preview read (active sources +
projected claw) plus type-to-confirm, and the `/api/admin/entitlement/revoke-purchase` (+
`/preview`) routes. registry: the Worker deny-set check (`revocation-list.ts`), wired
fail-open into `entitlement-filter.ts`/`deploy-entry.ts` so a fetch/parse failure never blocks an
install.
