# @caisson/risk-register

A framework-agnostic risk register. Every entry carries a likelihood and an impact rating; the
residual risk score is always the computed product of the two — there is no field for writing a
residual by hand, so a register can never carry a number nobody can explain.

```ts
import { defineRiskEntry } from "@caisson/risk-register";

const entry = defineRiskEntry({
  riskId: "R-14",
  subject: "default model lane",
  likelihood: "possible",
  impact: "major",
  treatmentPlan:
    "Rate-limited with a human-review fallback on repeated failures.",
  owner: "safety@example.com",
  evidenceDigest: "…sha-256 of the supporting evidence…",
  crosswalk: [],
});

entry.residual; // computed from likelihood x impact — never supplied by the caller
```

When a human needs to override the computed score — a documented business call to treat a risk as
more or less severe than the model says — that override is never a silent edit to the entry. It is
recorded as its own exception on the tenant's write-once audit chain (`recordResidualOverride`,
composing `@caisson/audit-worm`): who asserted it, why, when, and the computed value it is
overriding, so the original score stays recoverable even after an override is in force.

Every entry can point at any shipped framework pack's canonical controls, reusing
`@caisson/frameworks-pack`'s crosswalk-reference shape rather than a second one of our own. A
register can also be exported as a `risk-treatment-plan` artifact — a canonical, byte-stable
summary of every entry's current treatment state — via `buildRiskTreatmentPlan`.

Apache-2.0. Consumes `@caisson/kernel`, `@caisson/frameworks-pack`'s crosswalk shape, and
`@caisson/audit-worm`'s chain primitive — down-only, composed by the compliance evidence engine,
never the reverse.
