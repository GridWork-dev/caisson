// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson/signing-primitive",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/kernel"],
  description:
    "Per-tenant evidence signing: detached Ed25519 signatures over a canonical, chain-anchored manifest body, with an optional RFC-3161 trusted-timestamp countersignature and a fail-closed verify path.",
});
