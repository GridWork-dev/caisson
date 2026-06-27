/**
 * Registry index schema — the catalog the CLI + buyer agent + docs all read (ADR-0021/0004).
 * The index is built by the publish flow; it is NOT a source mirror. Each version carries a
 * gate attestation (the green standards-gate run that admitted it) — a manual index write with
 * no real attestation is rejected in CI (ADR-0021).
 */
import { z } from "zod";
import { ModuleManifest } from "./module-manifest";

const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semver",
  );

export const RegistryVersion = z
  .object({
    version: semver,
    manifest: ModuleManifest,
    /** ISO 8601; stamped by CI at publish (never Date.now() in the build script). */
    publishedAt: z.string().datetime(),
    /** The standards-gate run that admitted this version: "<ci-run-id>@<commit-sha>". */
    gateAttestation: z.string().min(1),
  })
  .strict();

export const RegistryModuleEntry = z
  .object({
    id: z.string().regex(/^@stack\/[a-z0-9-]+$/),
    latest: semver,
    versions: z.array(RegistryVersion).min(1),
  })
  .strict();

export const RegistryIndex = z
  .object({
    schemaVersion: z.literal(1),
    modules: z.array(RegistryModuleEntry),
  })
  .strict();

export type RegistryIndex = z.infer<typeof RegistryIndex>;

/**
 * The generator allowlist (ADR-0021/0004/0008): caller-supplied module/edition ids are validated
 * against this BEFORE any path construction or subprocess. No unvalidated string reaches a path
 * or exec arg.
 */
export function moduleAllowlist(index: RegistryIndex): Set<string> {
  return new Set(index.modules.map((m) => m.id));
}

export function assertKnownModule(
  index: RegistryIndex,
  id: string,
): asserts id is string {
  if (!moduleAllowlist(index).has(id)) {
    throw new Error(
      `unknown module id (not in registry allowlist): ${JSON.stringify(id)}`,
    );
  }
}
