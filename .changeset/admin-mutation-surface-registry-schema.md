---
"@caisson/registry-schema": patch
---

Register the `admin_adjust` feature tag (ADR-0220, Fork AM-3 = A). The operator credit-adjust
action rides the existing ADR-0074 `feature_grant` / `feature_debit` envelope under this tag rather
than adding a new base `credit_event` type — so the money core needs no schema change to gain an
operator correction path. Additive to `REGISTERED_FEATURE_TAGS`; `@caisson/credits` validates it at
the boundary like any other registered tag.
