# @caisson-sh/frameworks-pack

Compliance framework catalogs as config-as-code. Ships a typed, Zod-strict canonical-control
model plus three own-authored control packs — SOC 2 Trust Services Criteria, HIPAA Security,
and the EU AI Act — with every control crosswalked to the external framework's requirement ids.

Clean-room authorship: crosswalk references are pointers to an external requirement id, never
copied control text. The evidence engine (`@caisson-sh/compliance-core`) consumes catalogs of this
shape to assemble a control-to-evidence pack.

## Entry points

- `.` — the full surface, including the complete `@caisson-sh/oscal-spine` re-export (node-capable).
- `./registry` — the control model alone (browser-safe).
- `./browser` — the model, the three packs, the regime crosswalks, the SoA computation, and the
  browser half of the OSCAL surface, safe inside a client bundle. Every name on `./browser` is
  also on `.`.

```ts
import {
  defineFramework,
  defineControl,
  soc2Tsc,
} from "@caisson-sh/frameworks-pack";
```

Apache-2.0. Sits on `@caisson-sh/kernel` only — down-only, composed by `@caisson-sh/compliance`, never
the reverse.
