# @caisson/frameworks-pack

Compliance framework catalogs as config-as-code. Ships a typed, Zod-strict canonical-control
model plus three own-authored control packs — SOC 2 Trust Services Criteria, HIPAA Security,
and the EU AI Act — with every control crosswalked to the external framework's requirement ids.

Clean-room authorship: crosswalk references are pointers to an external requirement id, never
copied control text. The evidence engine (`@caisson/compliance-core`) consumes catalogs of this
shape to assemble a control-to-evidence pack.

```ts
import {
  defineFramework,
  defineControl,
  soc2Tsc,
} from "@caisson/frameworks-pack";
```

Commercial module. Sits on `@caisson/kernel` only — down-only, composed by the Compliance edition,
never the reverse.
