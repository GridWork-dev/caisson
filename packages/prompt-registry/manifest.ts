// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/prompt-registry",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/tenancy-rls", "@caisson/ui"],
  description:
    "Append-only versioned prompts + name@version / name@alias addressing + a mutable alias pointer + injection-safe templating (ADR-0061).",
});
