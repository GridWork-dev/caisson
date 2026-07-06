// Registry manifest (ADR-0020). Local inference is a commercial local-first module carved out of
// @caisson/local-ai by ADR-0258. It depends down on @caisson/local-privacy for the EgressGuard seam.
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/local-inference",
  version: pkg.version,
  kind: "base",
  tier: "paid",
  priceCents: 24900,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/local-privacy"],
  description:
    "Local-first inference seam: deterministic stub, guarded ONNX embeddings, and rented transport drivers sharing the local privacy gate.",
});
