/**
 * Module manifest schema — the typed declaration every registry module carries (ADR-0020).
 * Canonical home: registry/ (the registry defines what a module IS). Imported + enforced by
 * `@stack/standards-gate` (which provides `zod`). package.json stays the source of truth for the
 * fields npm + changesets read; this manifest carries the richer, registry-only declaration. The
 * gate asserts manifest↔package.json agreement on id/version/license (ADR-0020/0021).
 */
import { z } from "zod";

export const MODULE_KINDS = [
  "base",
  "edition",
  "primitive",
  "app-template",
] as const;
export const COMMERCE_TIERS = ["oss", "paid"] as const;
export const STABILITY = ["alpha", "beta", "stable"] as const;
export const EDITIONS = [
  "compliance",
  "ai-kit",
  "local-ai",
  "agent-dev",
] as const;

/**
 * Curated SPDX allowlist (a free string lets "Apache 2.0"/"MITT"/"Proprietary" through). The model
 * is FULLY COMMERCIAL (ADR-0023, supersedes ADR-0010's open-core base): every module is the
 * proprietary `LicenseRef-Stack-Commercial` EXCEPT the AGPL Local-first flank — the one deliberate
 * open community play. No permissive/free tier (Apache/MIT removed). Extend deliberately.
 */
export const SPDX_LICENSES = [
  "LicenseRef-Stack-Commercial",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
] as const;

const isAgplSpdx = (l: string): boolean => l.startsWith("AGPL");

const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semver",
  );
const moduleId = z
  .string()
  .regex(/^@stack\/[a-z0-9-]+$/, "must be @stack/<slug>");

export const ModuleManifest = z
  .object({
    id: moduleId,
    version: semver,
    kind: z.enum(MODULE_KINDS),
    /** Edition membership; [] for pure base. An `edition` kind names itself here. */
    editions: z.array(z.enum(EDITIONS)).default([]),
    /** Commerce lever (distinct from the SPDX `license` legal lever). */
    tier: z.enum(COMMERCE_TIERS),
    /** Integer minor units, never floats (ADR-0007); null only for oss / non-priced. */
    priceCents: z.number().int().nonnegative().nullable().default(null),
    /** SPDX from the allowlist; MUST mirror package.json `license` (drives the AGPL gate). */
    license: z.enum(SPDX_LICENSES),
    /** Workspace module ids; down-only — never depends "up" on an edition (ADR-0003). */
    dependencies: z.array(moduleId).default([]),
    entry: z.string().default("src/index.ts"),
    /** Agent-facing authoring/usage contract the buyer MCP/agent reads (distinct from README). */
    agents: z.string().default("AGENTS.md"),
    /** Golden-fixture dir, or null until the module has golden-able output (harness = ADR-0013). */
    golden: z.string().nullable().default(null),
    stability: z.enum(STABILITY).default("alpha"),
    description: z.string().min(1),
  })
  .strict()
  .refine((m) => (m.tier === "oss" ? m.priceCents === null : true), {
    message: "oss modules must not carry a priceCents (ADR-0007/0010)",
    path: ["priceCents"],
  })
  .refine(
    (m) =>
      m.tier === "paid" ? m.priceCents !== null && m.priceCents > 0 : true,
    {
      message:
        "paid modules must carry a positive integer priceCents (ADR-0007)",
      path: ["priceCents"],
    },
  )
  .refine((m) => (m.kind === "edition" ? m.editions.length > 0 : true), {
    message: "an edition module must declare its edition membership",
    path: ["editions"],
  })
  // AGPL ⟺ local-first: in this product AGPL is the local-ai flank ONLY (ADR-0010). Both
  // directions — a local-ai module must be AGPL; an AGPL module must be local-ai.
  .refine((m) => m.editions.includes("local-ai") === isAgplSpdx(m.license), {
    message:
      "AGPL license ⟺ local-ai edition membership (ADR-0010): local-ai modules must be AGPL, and only they may be",
    path: ["license"],
  });

export type ModuleManifest = z.infer<typeof ModuleManifest>;

/** Per-module `manifest.ts` calls this; throws on an invalid manifest at build time. */
export function defineModule(m: ModuleManifest): ModuleManifest {
  return ModuleManifest.parse(m);
}
