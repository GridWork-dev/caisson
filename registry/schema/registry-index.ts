/**
 * Registry index schema — the catalog the CLI + buyer agent + docs all read (ADR-0021/0004).
 * The index is BUILT from the published registry by a CI-only writer (ADR-0021) — it is not a
 * source mirror and is never hand-appended. Each version carries a gate-provenance record.
 */
import { z } from "zod";
import { ModuleManifest } from "./module-manifest";

const MODULE_ID_RE = /^@caisson\/[a-z0-9-]+$/;
const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semver",
  );

/** Branded id — only minted after a regex check, so a raw string can't masquerade as validated. */
export type ModuleId = string & { readonly __moduleId: unique symbol };

export const RegistryVersion = z
  .object({
    version: semver,
    manifest: ModuleManifest,
    /** ISO 8601; stamped by CI at publish (never Date.now() in the build script). */
    publishedAt: z.string().datetime(),
    /**
     * Provenance of the green standards-gate run that admitted this version:
     * "<ci-run-id>@<commit-sha>". This RECORDS provenance — it is NOT the access control. The
     * index is writable only by the CI build job (branch protection + CODEOWNERS, ADR-0021); a
     * hand-edited entry never lands because the file is regenerated from the registry, not appended.
     */
    gateAttestation: z.string().min(1),
  })
  .strict();

export const RegistryModuleEntry = z
  .object({
    id: z.string().regex(MODULE_ID_RE),
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

/** Parse-or-throw. The ONLY sanctioned way to obtain a RegistryIndex — never `JSON.parse(...) as`. */
export function loadRegistryIndex(raw: unknown): RegistryIndex {
  return RegistryIndex.parse(raw);
}

/** The generator allowlist (ADR-0021/0004/0008). */
export function moduleAllowlist(index: RegistryIndex): Set<string> {
  return new Set(index.modules.map((m) => m.id));
}

/**
 * Validate a caller-supplied module id against the registry BEFORE any path construction or
 * subprocess. Re-asserts the slug regex as defense-in-depth (do not trust the index shape alone),
 * then narrows to the branded ModuleId.
 */
export function assertKnownModule(
  index: RegistryIndex,
  id: string,
): asserts id is ModuleId {
  if (!MODULE_ID_RE.test(id)) {
    throw new Error(
      `malformed module id (failed @caisson/<slug>): ${JSON.stringify(id)}`,
    );
  }
  if (!moduleAllowlist(index).has(id)) {
    throw new Error(
      `unknown module id (not in registry allowlist): ${JSON.stringify(id)}`,
    );
  }
}

/**
 * Validate a caller-supplied VERSION against that module's published versions BEFORE it reaches a
 * path/exec arg (ADR-0021 — the allowlist must cover the version, not just the id; a raw version
 * string is a path-traversal surface otherwise).
 */
export function assertKnownVersion(
  index: RegistryIndex,
  id: string,
  version: string,
): void {
  assertKnownModule(index, id);
  const entry = index.modules.find((m) => m.id === id);
  if (!entry || !entry.versions.some((v) => v.version === version)) {
    throw new Error(`unknown version for ${id}: ${JSON.stringify(version)}`);
  }
}
