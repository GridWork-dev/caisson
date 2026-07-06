// Registry manifest (ADR-0020). Local privacy is a commercial local-first module carved out of
// @caisson/local-ai by ADR-0258: the EgressGuard and strict privacy-policy boundary depend only on
// kernel's fetchWithTimeout and Zod validation.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-privacy",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 9900,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Local-first privacy gate: strict zero-egress policy parsing plus EgressGuard over the kernel fetchWithTimeout chokepoint.",
});
