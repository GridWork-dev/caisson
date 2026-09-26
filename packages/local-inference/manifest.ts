// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/local-inference",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel", "@caisson-sh/local-privacy"],
  description:
    "Local-first inference seam: deterministic stub, guarded ONNX embeddings, and rented transport drivers sharing the local privacy gate.",
});
