/**
 * Module manifest schema — the typed declaration every registry module carries (ADR-0020).
 * Canonical home: registry/ (the registry defines what a module IS). Imported + enforced by
 * `@caisson/standards-gate` (which provides `zod`). package.json stays the source of truth for the
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
 * is UNIFORM FULLY-COMMERCIAL (ADR-0050, supersedes the ADR-0023 AGPL Local-first flank): every
 * module — including Local-first AI — ships the proprietary `LicenseRef-Caisson-Commercial`. No
 * AGPL/copyleft, no permissive/free tier anywhere in the tree (the lone open flank is retired).
 * Extend deliberately.
 */
export const SPDX_LICENSES = ["LicenseRef-Caisson-Commercial"] as const;

const semver = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be semver",
  );
const moduleId = z
  .string()
  .regex(/^@caisson\/[a-z0-9-]+$/, "must be @caisson/<slug>");
// entry/agents/golden are consumed by create-caisson into paths — must be relative, no `..`
// traversal, no absolute (ADR-0021 input-validation; closes a future path surface).
const relPath = z
  .string()
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/,
    "must be a relative path without `..`",
  );

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
    /**
     * Frozen member-version pin map (ADR-0077). For `edition` manifests: maps every bundled module
     * id to its EXACT pinned semver — the generator resolves `edition@x.y.z` to this FROZEN set
     * (never `latest`, never a range; the `semver` regex already rejects both). Non-edition modules
     * may omit it (defaults to {}). The refine below enforces non-empty for `kind === "edition"`.
     */
    members: z.record(moduleId, semver).default({}),
    entry: relPath.default("src/index.ts"),
    /** Agent-facing authoring/usage contract the buyer MCP/agent reads (distinct from README). */
    agents: relPath.default("AGENTS.md"),
    /** Golden-fixture dir, or null until the module has golden-able output (harness = ADR-0013). */
    golden: relPath.nullable().default(null),
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
  .refine(
    (m) => (m.kind === "edition" ? Object.keys(m.members).length > 0 : true),
    {
      message:
        "an edition module must declare a non-empty members pin map (ADR-0077)",
      path: ["members"],
    },
  )
  // tier ⟺ license (ADR-0050 uniform-commercial, supersedes the ADR-0023 paid⟺Commercial / oss⟺AGPL
  // split): the SPDX allowlist is commercial-only, so the sole valid tier is `paid`. The `oss` tier
  // (ADR-0023) now has NO valid license and is DEAD by construction — it can never satisfy this
  // refine, so no module may ship `oss`. The former AGPL⟺local-ai carve-out is retired (ADR-0050):
  // Local-first AI ships LicenseRef-Caisson-Commercial like every other edition.
  .refine((m) => m.tier === "paid", {
    message:
      "tier must be `paid` under the uniform-commercial model (ADR-0050): every module ships LicenseRef-Caisson-Commercial; the `oss` tier is dead (no valid non-commercial license).",
    path: ["tier"],
  });

export type ModuleManifest = z.infer<typeof ModuleManifest>;
/** The authoring shape — fields with Zod defaults (editions/entry/agents/golden/…) are optional. */
export type ModuleManifestInput = z.input<typeof ModuleManifest>;

/** Per-module `manifest.ts` calls this; throws on an invalid manifest at build time. Accepts the
 * input shape (defaulted fields optional) and returns the fully-defaulted, validated manifest. */
export function defineModule(m: ModuleManifestInput): ModuleManifest {
  return ModuleManifest.parse(m);
}
