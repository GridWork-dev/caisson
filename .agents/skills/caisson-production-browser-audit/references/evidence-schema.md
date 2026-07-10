# Evidence contract

Each finding records:

- stable id, category, severity, and independent confidence
- ring, journey, production URL, viewport, theme, auth state
- exact steps, observed state, expected user-visible state
- before/action/after/revert screenshot paths as applicable
- focused DOM/accessibility/console/network/performance evidence when relevant
- governing Refero reference, Caisson design rule, Impeccable principle, or behavior contract
- clean-session replay attempts and reproduction result

Evidence paths are relative to `outputs/browser-audit/<run-id>/`; absolute paths, `..`, null bytes, credentials, personal data, and browser-profile contents are forbidden.

P0/P1 behavior findings require clean-session replay. Design findings require a cited reference lock or Caisson/Impeccable rule. A blocked prerequisite makes later steps `not-covered`, never pass.
