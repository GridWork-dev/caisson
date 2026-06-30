// Registry manifest (ADR-0020/0021). Loaded by @caisson/standards-gate; must agree with package.json
// on id/version/license. `kind: "base"` — @caisson/migrate is foundational tooling (the migration
// assembler + runner that @caisson/cli and @caisson/compliance COMPOSE; ADR-0090); it is not an
// edition, a compliance primitive, or a per-app template.
//
// Commercial under the open-core model (ADR-0094/0097): the assembler/runner is NOT among the
// enumerated open Base packages (kernel·auth·tenancy-rls·ui·billing·credits·jobs·email·ai-config·
// mcp-server·registry-schema), so it ships LicenseRef-Caisson-Commercial — and the license⟺tier rule
// therefore forces `paid`. `priceCents` mirrors the established pre-launch placeholder anchor (4900,
// the same anchor @caisson/cli carries) — final pricing is the still-open Pricing board fork, out of
// scope here; it must only be a positive integer (ADR-0007). Dependencies are DOWN-ONLY (ADR-0003):
// migrate depends on @caisson/kernel (the pure merge algorithm) and nothing "up" — never on the cli
// or an edition.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/migrate",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 4900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  golden: "src/__golden__",
  description:
    "Base migration assembler + runner: merges each selected package's forward-only migrations into ONE renumbered sequence + single schema_version ledger (kernel merge), emits the generated-app file set, and applies it forward-only + idempotent through an injected runner port.",
});
