export * from "./workspace";
export * from "./checks";
// The registry contract is the open @caisson/registry-schema (ADR-0097) — sourced from the package,
// not the commercial @caisson/registry shim path, so tsc resolves it and turbo orders the build.
export {
  ModuleManifest,
  defineModule,
  SPDX_LICENSES,
  RegistryIndex,
  loadRegistryIndex,
  moduleAllowlist,
  assertKnownModule,
  assertKnownVersion,
} from "@caisson/registry-schema";
