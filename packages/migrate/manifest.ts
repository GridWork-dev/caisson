// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/migrate",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Base migration assembler + runner: merges each selected package's forward-only migrations into ONE renumbered sequence + single schema_version ledger (kernel merge), emits the generated-app file set, and applies it forward-only + idempotent through an injected runner port.",
});
