# @caisson/compliance-core

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
} from "@caisson/compliance-core";
```

Commercial module. Consumes `@caisson/kernel`, the framework catalogs in `@caisson/frameworks-pack`,
`@caisson/field-crypto`, and `@caisson/risk-register` (the generalized model the EU-AI-Act
risk-register collector runs on) — down-only, composed by the Compliance edition, never the reverse.
