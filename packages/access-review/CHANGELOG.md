# @caisson/access-review

## 0.2.0

### Minor Changes

- d9d56b8: New module: access-review campaigns. A reviewer imports a membership roster from CSV or JSON,
  opens a review campaign, and records an approve or revoke decision for each person on the list.
  Every decision is written to the same tamper-evident audit trail the rest of the compliance
  tooling uses, so an auditor can prove the review actually happened rather than trusting a plain
  log. A campaign closes automatically once every reviewer decision is in, or once its deadline
  passes — anyone left undecided is called out explicitly rather than being treated as approved.
  This module is not yet available for purchase.
