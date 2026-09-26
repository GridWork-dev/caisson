// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/agent-trajectory",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson/ai-meter",
    "@caisson/field-crypto",
    "@caisson/kernel",
    "@caisson/tenancy-rls",
  ],
  description:
    "Engine-neutral trajectory contract: an append-only, replayable event log (runs, steps, model calls, tool proposals/approvals, usage, checkpoints) with digest-ref payload discipline (sensitive bodies referenced by sha256 digest, never inlined) and a deterministic projection over shuffled arrival.",
});
