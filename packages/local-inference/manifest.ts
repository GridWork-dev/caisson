// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/local-inference",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel", "@caisson/local-privacy"],
  description:
    "Local-first inference seam: deterministic stub, guarded ONNX embeddings, and rented transport drivers sharing the local privacy gate.",
});
