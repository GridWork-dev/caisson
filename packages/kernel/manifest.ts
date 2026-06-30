// Registry manifest (ADR-0020). Loaded by @caisson/standards-gate; must agree with package.json on
// id/version/license/dependencies. `kind: "base"` — the governance kernel is the zero-dependency
// foundation; every other base and edition package depends on it. Open Base: Apache-2.0, oss tier (ADR-0094 open-core).
//
// Open Base ships free: tier `oss`, no priceCents (ADR-0094 open-core). `dependencies: []` — kernel has no @caisson/*
// workspace runtime dependencies (the only external dep is `zod`). DOWN-ONLY (ADR-0003).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest.ts";

export default defineModule({
  id: "@caisson/kernel",
  version: pkg.version,
  kind: "base",
  tier: "oss",
  priceCents: null,
  license: pkg.license,
  dependencies: [],
  description:
    "Governance kernel: typed config loader, CaissonError hierarchy (ADR-0019), security primitives (timingSafeEqual/randomUUID), and the standards gate (ADR-0016).",
});
