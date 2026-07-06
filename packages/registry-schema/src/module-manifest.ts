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
  // ADR-0257: the bundle model. Additive — historical `kind:"edition"` ledger/index entries stay
  // valid forever. A bundle-kind module is the meta-package for one bundle id (its `@caisson/<slug>`
  // slug IS the bundle id, per `./bundle-vocabulary`); like an edition it carries a required
  // non-empty frozen `members` pin map (the refine below), but it does NOT use `editions[]` (that
  // enum is the closed legacy set — bundles are keyed by id, never by a new editions entry).
  "bundle",
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
 * is OPEN-CORE (ADR-0094, amends the ADR-0050 uniform-commercial stance for the Base tier): the open
 * Base substrate (11 packages) ships `Apache-2.0`; the editions, the compliance primitives
 * (field-crypto/audit-worm), the generator (cli), the registry service, and every update subscription
 * ship the proprietary `LicenseRef-Caisson-Commercial`. The license⟺tier refine below pins the split
 * (Apache-2.0 ⟺ oss/free, commercial ⟺ paid). No AGPL/copyleft anywhere (the AGPL Local-first flank
 * stays retired, ADR-0050/0083). Extend deliberately.
 */
export const SPDX_LICENSES = [
  "LicenseRef-Caisson-Commercial",
  "Apache-2.0",
] as const;

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
     * may omit it (defaults to {}). The refines below enforce non-empty for `kind === "edition"`
     * and `kind === "bundle"` (ADR-0257 — a bundle composes exactly like an edition).
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
  // ADR-0257: a bundle meta-package composes exactly like an edition — its frozen members pin map
  // is the authoritative composition, so it must be non-empty (same contract as the edition refine
  // above; `editions[]` intentionally NOT required — bundles are keyed by their module-id slug).
  .refine(
    (m) => (m.kind === "bundle" ? Object.keys(m.members).length > 0 : true),
    {
      message:
        "a bundle module must declare a non-empty members pin map (ADR-0257/0077)",
      path: ["members"],
    },
  )
  // tier ⟺ license (ADR-0094 open-core, amends the ADR-0050 uniform-commercial "tier must be paid"
  // refine): the open Base ships `Apache-2.0` at the free `oss` tier; everything commercial ships
  // `LicenseRef-Caisson-Commercial` at the `paid` tier. NOTE: binary by construction (SPDX_LICENSES
  // has exactly two members) — adding a THIRD license to the allowlist MUST extend this refine to map
  // it to a tier explicitly, else it silently falls into the commercial/`paid` branch. Combined with the priceCents refines above
  // (oss ⇒ priceCents null, paid ⇒ priceCents > 0) this pins both directions: Apache-2.0 ⟺ oss ⟺ no
  // price, and LicenseRef-Caisson-Commercial ⟺ paid ⟺ a positive price. The SPDX allowlist still
  // carries no copyleft license, so the AGPL boundary stays a dormant tripwire (ADR-0050/0083).
  .refine(
    (m) => (m.license === "Apache-2.0" ? m.tier === "oss" : m.tier === "paid"),
    {
      message:
        "license⟺tier (ADR-0094): an Apache-2.0 open-Base module must ship tier `oss`; a LicenseRef-Caisson-Commercial module must ship tier `paid`.",
      path: ["tier"],
    },
  );

export type ModuleManifest = z.infer<typeof ModuleManifest>;
/** The authoring shape — fields with Zod defaults (editions/entry/agents/golden/…) are optional. */
export type ModuleManifestInput = z.input<typeof ModuleManifest>;

/** Per-module `manifest.ts` calls this; throws on an invalid manifest at build time. Accepts the
 * input shape (defaulted fields optional) and returns the fully-defaulted, validated manifest. */
export function defineModule(m: ModuleManifestInput): ModuleManifest {
  return ModuleManifest.parse(m);
}
