# @caisson/access-review

## 0.3.1

### Patch Changes

- 108a358: README refreshed: the module is now a standalone catalog listing and a member of the Compliance and Everything bundles.
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
- Updated dependencies [31bf5f1]
  - @caisson/kernel@0.6.0
  - @caisson/jobs@0.7.0
  - @caisson/tenancy-rls@0.5.6

## 0.3.0

### Minor Changes

- 1c5c137: Access reviews are now sold à la carte at $199 and included in the Compliance and
  Everything bundles: audit-prep review campaigns over an imported membership snapshot,
  with per-reviewee attested approve/revoke decisions recorded into the WORM log and
  undecided reviewees flagged, never auto-approved.

## 0.2.0

### Minor Changes

- d9d56b8: New module: access-review campaigns. A reviewer imports a membership roster from CSV or JSON,
  opens a review campaign, and records an approve or revoke decision for each person on the list.
  Every decision is written to the same tamper-evident audit trail the rest of the compliance
  tooling uses, so an auditor can prove the review actually happened rather than trusting a plain
  log. A campaign closes automatically once every reviewer decision is in, or once its deadline
  passes — anyone left undecided is called out explicitly rather than being treated as approved.
  This module is not yet available for purchase.
