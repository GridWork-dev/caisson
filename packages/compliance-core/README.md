# @caisson-sh/compliance-core

The compliance evidence engine. Runs typed collectors over live system state, assembles a
deterministic, byte-stable canonical evidence pack, and exports the result through the OSCAL seam
(assessment plan, assessment results, plan of action and milestones, and an XML round-trip).

Flag-never-guess: generation hard-blocks when any control's evidence is unresolved — there is no
partial pack. The pack body is byte-stable, so the same evidence canonicalizes to the same bytes
and is independently golden-checkable.

```ts
import {
  generateEvidencePack,
  parseEvidencePackManifest,
} from "@caisson-sh/compliance-core";
```

## Entry points

- `.` — the full surface, node-capable (the deterministic ZIP archive + SHA-256 digest, the
  chain-verify and field-crypto collectors, the drift monitor, and the complete
  `@caisson-sh/oscal-spine` re-export).
- `./browser` — the browser-safe subset, importable from a client bundle: the collector contract
  and its `passResult`/`flaggedResult`/`unresolvedResult` constructors, the four pure collectors
  (FORCE-RLS, WORM retention, risk register, impersonation dual trail), the pack format, the
  crosswalk rollup, and `assembleEvidenceManifest` — the flag-never-guess refusal plus the derived,
  schema-validated canonical body that `generateEvidencePack` itself composes. Every name on
  `./browser` is also on `.`.

Apache-2.0. Consumes `@caisson-sh/kernel`, the framework catalogs in `@caisson-sh/frameworks-pack`,
`@caisson-sh/field-crypto`, and `@caisson-sh/risk-register` (the generalized model the EU-AI-Act
risk-register collector runs on) — down-only, composed by `@caisson-sh/compliance`, never the reverse.
