/**
 * Module manifest schema — the typed declaration every registry module carries (ADR-0020).
 * Imported + enforced by `@caisson/standards-gate`. package.json stays the source of truth for the
 * fields npm + changesets read; the gate asserts manifest↔package.json agreement on
 * id/version/license/dependencies.
 */
import { z } from "zod";

export const STABILITY = ["alpha", "beta", "stable"] as const;

/**
 * Curated SPDX allowlist (a free string lets "Apache 2.0"/"MITT"/"Proprietary" through). Every
 * module ships Apache-2.0; no AGPL/copyleft license is on the list, so the standards gate's AGPL
 * boundary stays a dormant tripwire. Extend deliberately.
 */
export const SPDX_LICENSES = ["Apache-2.0"] as const;

const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semver",
  );
const moduleId = z
  .string()
  .regex(/^@caisson\/[a-z0-9-]+$/, "must be @caisson/<slug>");

export const ModuleManifest = z
  .object({
    id: moduleId,
    version: semver,
    /** SPDX from the allowlist; MUST mirror package.json `license`. */
    license: z.enum(SPDX_LICENSES),
    /** Workspace module ids; MUST mirror package.json's `@caisson/*` runtime dependencies. */
    dependencies: z.array(moduleId).default([]),
    description: z.string().min(1),
    stability: z.enum(STABILITY).default("alpha"),
  })
  .strict();

export type ModuleManifest = z.infer<typeof ModuleManifest>;
/** The authoring shape — fields with Zod defaults (dependencies/stability) are optional. */
export type ModuleManifestInput = z.input<typeof ModuleManifest>;

/** Per-module `manifest.ts` calls this; throws on an invalid manifest at build time. Accepts the
 * input shape (defaulted fields optional) and returns the fully-defaulted, validated manifest. */
export function defineModule(m: ModuleManifestInput): ModuleManifest {
  return ModuleManifest.parse(m);
}
