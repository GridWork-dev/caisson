// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license. `kind: "base"` — @caisson/migrate is foundational tooling (the migration
// assembler + runner that @caisson/cli and @caisson/compliance COMPOSE; ADR-0090); it is not an
// edition, a compliance primitive, or a per-app template.
//
// Open Base under the open-core model (ADR-0094/0097 + the license-based registry gating ADR-0136):
// @caisson/cli composes migrate into every generated repo, so the assembler/runner ships with each
// buyer and joins the open Apache-2.0 set alongside @caisson/cli + @caisson/license-verify — free
// `oss` tier, no `priceCents` (the license⟺tier rule requires oss carry no price). Dependencies are
// DOWN-ONLY (ADR-0003) and open-only (ADR-0094): migrate depends on @caisson/kernel (the pure merge
// algorithm, Apache-2.0) and nothing "up" — never on the cli or an edition.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/migrate",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Base migration assembler + runner: merges each selected package's forward-only migrations into ONE renumbered sequence + single schema_version ledger (kernel merge), emits the generated-app file set, and applies it forward-only + idempotent through an injected runner port.",
});
