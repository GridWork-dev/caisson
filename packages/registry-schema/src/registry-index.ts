/**
 * Module catalog schema — the index the CLI and the MCP server validate a selection against
 * (ADR-0021/0004). `@caisson-sh/cli` derives it at build time from the workspace packages (name and
 * version from each package.json, the rest from its manifest); it is never hand-edited.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { ModuleManifest } from "./module-manifest";

const MODULE_ID_RE = /^@caisson-sh\/[a-z0-9-]+$/;
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
    /** ISO 8601 publish time. Optional: a catalog derived from the workspace has none. */
    publishedAt: z.string().datetime().optional(),
    /**
     * Provenance of the gate run that admitted this version, "<ci-run-id>@<commit-sha>". It
     * records provenance, it is not the access control. Optional: a catalog derived from the
     * workspace has none.
     */
    gateAttestation: z.string().min(1).optional(),
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

/**
 * Read + parse an on-disk catalog file. Parse-or-throw — a malformed/tampered file raises rather
 * than yielding a half-typed object. The single sanctioned file read path for `create-caisson` +
 * the MCP server.
 */
export function loadRegistryIndexFromFile(path: string): RegistryIndex {
  return loadRegistryIndex(JSON.parse(readFileSync(path, "utf8")));
}

/** The set of generatable module ids (ADR-0021/0004/0008). */
export function moduleAllowlist(index: RegistryIndex): Set<string> {
  return new Set(index.modules.map((m) => m.id));
}

/**
 * Validate a caller-supplied module id against the catalog BEFORE any path construction or
 * subprocess. Re-asserts the slug regex as defense-in-depth (do not trust the index shape alone),
 * then narrows to the branded ModuleId.
 */
export function assertKnownModule(
  index: RegistryIndex,
  id: string,
): asserts id is ModuleId {
  if (!MODULE_ID_RE.test(id)) {
    throw new Error(
      `malformed module id (failed @caisson-sh/<slug>): ${JSON.stringify(id)}`,
    );
  }
  if (!moduleAllowlist(index).has(id)) {
    throw new Error(
      `unknown module id (not in the module catalog): ${JSON.stringify(id)}`,
    );
  }
}

/**
 * Validate a caller-supplied VERSION against that module's catalog versions BEFORE it reaches a
 * path/exec arg (ADR-0021 — the catalog must cover the version, not just the id; a raw version
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
