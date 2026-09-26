# @caisson/artifact-render

The shared render seam for public-facing compliance artifacts. Three concerns, deliberately no more:

- **Readiness-language filter** (`assertReadinessLanguage` / `isReadinessLanguage`) — the ADR-0080 copy
  law ("compliant" / "certified" / "verified" is never claimed for Caisson itself) as one reusable
  guard, instead of every render path re-deriving the banned-word regex.
- **Allowlist-based redaction** (`redactToAllowlist`) — a field absent from an explicit allowlist never
  renders. The opposite posture from `@caisson/kernel`'s `scrubDeep` (a denylist by key-name pattern):
  this is opt-in, for a curated, operator-controlled public artifact rather than an unstructured egress log.
- **Citation-row rendering** (`renderCitationRow`) — the one canonical `{control, claim, justification,
evidencePointer?}` shape a "control cites evidence" row takes, with `justification` gated by the
  readiness-language filter at construction.

```ts
import {
  assertReadinessLanguage,
  redactToAllowlist,
  renderCitationRow,
} from "@caisson/artifact-render";
```

Consumed by the ISO 27001 Statement of Applicability generator (`@caisson/frameworks-pack` +
`@caisson/compliance-core`) and the trust-page generator (`@caisson/trust-page`), so both share
one legal-gate + redaction implementation rather than two divergent copies.

Apache-2.0 render plumbing. Sits on `@caisson/kernel` alone — down-only, composed by other
packages, never the reverse.
