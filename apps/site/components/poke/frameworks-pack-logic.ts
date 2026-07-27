// Deterministic client-side mirror of @caisson/frameworks-pack's canonical-control model
// (packages/frameworks-pack/src/registry/control.ts) plus @caisson/oscal-spine's OSCAL
// catalog export (packages/oscal-spine/src/evidence/oscal-catalog-export.ts +
// oscal-export.ts) for the "frameworks-pack" poke (ADR-0378 lock 2, kimi CANDIDATES.md section B
// build baseline). Nothing here fetches, persists, measures, or uses Date.now / Math.random in a
// rendered-output path.
//
// Why mirrored instead of imported: frameworks-pack's own registry/control.ts imports
// "@caisson/kernel" (parseStrict, strictObject) at module scope; kernel's barrel index.ts also
// re-exports crypto.ts / audit-chain.ts / migration-assembly.ts (node:crypto) and gate.ts / ssrf.ts
// (node:fs / node:dns/promises). Neither package exposes a subpath export around those files (see
// both package.json `exports` maps), so importing the real control model does not resolve in a
// browser bundle (the same reasoning guardrails-logic.ts documents for the same kernel barrel).
// toOscalCatalog (oscal-spine/src/evidence/oscal-catalog-export.ts) additionally imports
// `randomUUID` from "node:crypto" directly at module scope, and that whole file depends on
// "@caisson/frameworks-pack" -- doubly unresolvable client-side. `toOscalCatalog` below is a
// line-for-line port of that function; the one substitution is the UUID source (the browser's
// global `crypto.randomUUID()` instead of node:crypto's imported `randomUUID` -- both mint
// RFC-4122 v4 UUIDs, and this poke always supplies its own deterministic `newId` seam anyway, so
// the default is never actually reached in a rendered path). Parity is pinned in
// frameworks-pack-logic.test.ts against the real `toOscalCatalog` + the real `soc2Tsc` pack, both
// imported by relative path -- apps/site depends on neither @caisson/frameworks-pack nor
// @caisson/oscal-spine as a workspace package.

// ---- Canonical control model (packages/frameworks-pack/src/registry/control.ts -- the real file's
// runtime is a Zod `.strict()` schema; the shapes below are its inferred output, types only). -----

export interface CrosswalkVerification {
  readonly status: "unreviewed" | "reviewed" | "expert-reviewed";
  readonly relationship: "related" | "partial" | "equivalent";
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceDigest: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

export interface CrosswalkReference {
  readonly framework: string;
  readonly reference: string;
  // `| undefined` (not just `?`) so a real zod-inferred optional (explicitly `T | undefined` under
  // this repo's `exactOptionalPropertyTypes`) is assignable here without a cast -- see the parity
  // test, which assigns the real `soc2Tsc` export straight into this shape.
  readonly note?: string | undefined;
  readonly verification?: CrosswalkVerification | undefined;
}

export interface CanonicalControl {
  readonly id: string;
  readonly title: string;
  readonly family: string;
  readonly statement: string;
  readonly guidance?: string | undefined;
  readonly crosswalk: readonly CrosswalkReference[];
}

export interface Framework {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly controls: readonly CanonicalControl[];
}

// ---- Sample data: six of the SOC2-TSC pack's seventeen own-authored controls, copied verbatim
// from packages/frameworks-pack/src/frameworks/soc2-tsc.ts -- a genuine subset, not the full pack
// (parity-pinned field-for-field against the real `soc2Tsc` export in
// frameworks-pack-logic.test.ts). Labeled as a sample in the UI. ----------------------------------

export const SAMPLE_FRAMEWORK: Framework = {
  id: "soc2-tsc",
  title: "SOC 2 — Trust Services Criteria",
  version: "2024.1",
  description:
    "Own-authored Trust Services Criteria coverage pack: Common Criteria (CC1–CC9) plus the " +
    "Availability, Confidentiality, and Processing Integrity categories, crosswalked to the " +
    "AICPA criterion identifiers. Control text is clean-room Caisson prose; references are citations.",
  controls: [
    {
      id: "GOVERNANCE.SECURITY-RESPONSIBILITY",
      title: "Assigned security responsibility and accountability",
      family: "Governance",
      statement:
        "A named individual or role holds documented accountability for the information security " +
        "program, and security responsibilities are assigned across the organization with " +
        "sufficient authority and resources to execute them.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC1.3" },
        {
          framework: "HIPAA-Security",
          reference: "164.308(a)(2)",
          note: "Equivalent assigned-security-responsibility safeguard.",
        },
      ],
    },
    {
      id: "ACCESS-CONTROL.LOGICAL",
      title: "Logical access provisioning and least privilege",
      family: "Access Control",
      statement:
        "Logical access to systems and tenant data is granted through an authorized request, " +
        "provisioned on the principle of least privilege, and recertified periodically; access " +
        "rights are matched to a documented role rather than granted ad hoc.",
      guidance:
        "Enforce tenant isolation at the data layer (fail-closed row-level security) so least " +
        "privilege holds even when an application bug would otherwise widen scope.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        { framework: "SOC2-TSC", reference: "CC6.2" },
        { framework: "SOC2-TSC", reference: "CC6.3" },
      ],
    },
    {
      id: "ACCESS-CONTROL.MFA",
      title: "Multi-factor authentication for privileged access",
      family: "Access Control",
      statement:
        "Privileged access to production systems and the tenant data plane requires a second " +
        "authentication factor beyond a password; single-factor privileged sessions are denied.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        {
          framework: "HIPAA-Security",
          reference: "164.312(d)",
          note: "Person-or-entity authentication strengthened by a second factor.",
        },
      ],
    },
    {
      id: "DATA-PROTECTION.ENCRYPTION",
      title: "Encryption of sensitive data at rest and in transit",
      family: "Data Protection",
      statement:
        "Sensitive and confidential data is encrypted at rest and in transit using current, " +
        "industry-accepted algorithms, with keys managed under controlled custody and rotated on a " +
        "defined schedule; plaintext sensitive data is never persisted outside an encrypted column.",
      guidance:
        "Bind ciphertext to its row and tenant (row-scoped AAD) so a relocated ciphertext fails " +
        "authentication rather than decrypting under another record.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        { framework: "SOC2-TSC", reference: "CC6.7" },
        { framework: "SOC2-TSC", reference: "C1.1" },
      ],
    },
    {
      id: "DATA-PROTECTION.DISPOSAL",
      title: "Secure retention and disposal of confidential data",
      family: "Data Protection",
      statement:
        "Confidential data is retained only as long as required and then disposed of so that it is " +
        "rendered unrecoverable; for encrypted data, destruction of the governing key (crypto-shred) " +
        "is an accepted disposal mechanism.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.5" },
        {
          framework: "SOC2-TSC",
          reference: "C1.2",
          verification: {
            status: "reviewed",
            relationship: "equivalent",
            sourceId: "packages/field-crypto/src/crypto-shred.test.ts",
            sourceVersion: "2026.1",
            sourceDigest:
              "e57977329145a27f8054314141f56b22bd9ea4d39001b998d47a630899d1cbe0",
            reviewedBy: "operator",
            reviewedAt: "2026-07-13T00:00:00.000Z",
          },
        },
      ],
    },
    {
      id: "AUDIT.IMMUTABLE-LOG",
      title: "Immutable, hash-chained audit log",
      family: "Audit & Accountability",
      statement:
        "Security-relevant events are written to an append-only, hash-chained log that cannot be " +
        "altered or deleted after the fact; integrity is verifiable against a trusted anchor so " +
        "tampering, truncation, or rewriting is detectable.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC4.1" },
        { framework: "SOC2-TSC", reference: "CC7.2" },
        {
          framework: "HIPAA-Security",
          reference: "164.312(b)",
          note: "Satisfies the audit-controls technical safeguard.",
        },
      ],
    },
  ],
};

// ---- Clause-to-control lookup (composition over the model above -- original to this poke, not a
// mirror of any single package function). ----------------------------------------------------------

/** Sentinel Select value for "type your own clause" -- never a real (framework, reference) pair. */
export const CUSTOM_CLAUSE_KEY = "__custom__";

/** Encode a (framework, reference) pair as one opaque Select option value. */
export function clauseKey(framework: string, reference: string): string {
  return `${framework}::${reference}`;
}

export interface ClauseOption {
  readonly key: string;
  readonly framework: string;
  readonly reference: string;
  readonly controlCount: number;
}

/**
 * Every distinct (framework, reference) crosswalk pair cited anywhere in `framework`'s controls,
 * with how many controls cite it. Sorted by reference then framework for a stable render order.
 */
export function listClauses(framework: Framework): ClauseOption[] {
  const counts = new Map<
    string,
    { framework: string; reference: string; count: number }
  >();
  for (const control of framework.controls) {
    for (const x of control.crosswalk) {
      const key = clauseKey(x.framework, x.reference);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          framework: x.framework,
          reference: x.reference,
          count: 1,
        });
      }
    }
  }
  return [...counts.entries()]
    .map(([key, v]) => ({
      key,
      framework: v.framework,
      reference: v.reference,
      controlCount: v.count,
    }))
    .sort(
      (a, b) =>
        a.reference.localeCompare(b.reference) ||
        a.framework.localeCompare(b.framework),
    );
}

export interface ClauseLookupResult {
  readonly clauseFramework: string;
  readonly clauseReference: string;
  readonly matches: readonly CanonicalControl[];
}

/** Every control in `framework` whose crosswalk cites `(clauseFramework, clauseReference)` exactly. */
export function findControlsByClause(
  framework: Framework,
  clauseFramework: string,
  clauseReference: string,
): ClauseLookupResult {
  const fw = clauseFramework.trim();
  const ref = clauseReference.trim();
  const matches = framework.controls.filter((c) =>
    c.crosswalk.some((x) => x.framework === fw && x.reference === ref),
  );
  return { clauseFramework: fw, clauseReference: ref, matches };
}

// ---- OSCAL v1.2.2 catalog export (packages/oscal-spine/src/evidence/oscal-catalog-export.ts
// `toOscalCatalog` + oscal-export.ts `OSCAL_VERSION`/`CAISSON_OSCAL_NS` -- verbatim port). --------

/** Locked to NIST OSCAL v1.2.2 by ADR-0179 -- mirrors oscal-spine's `OSCAL_VERSION` exactly. */
export const OSCAL_VERSION = "1.2.2" as const;

/** The Caisson property/extension namespace stamped on OSCAL `prop` extensions. */
export const CAISSON_OSCAL_NS = "https://caisson.sh/ns/oscal";

export interface OscalProp {
  readonly name: string;
  readonly value: string;
  readonly ns?: string;
  readonly class?: string;
}

interface OscalCatalogPart {
  readonly name: string;
  readonly prose: string;
}

interface OscalCatalogLink {
  readonly href: string;
  readonly rel: string;
}

export interface OscalCatalogControl {
  readonly id: string;
  readonly class: string;
  readonly title: string;
  readonly props: readonly OscalProp[];
  readonly links: readonly OscalCatalogLink[];
  readonly parts: readonly OscalCatalogPart[];
}

export interface OscalCatalogGroup {
  readonly id: string;
  readonly class: string;
  readonly title: string;
  readonly controls: readonly OscalCatalogControl[];
}

export interface OscalCatalogBody {
  readonly uuid: string;
  readonly metadata: {
    readonly title: string;
    readonly "last-modified": string;
    readonly version: string;
    readonly "oscal-version": string;
  };
  readonly groups: readonly OscalCatalogGroup[];
}

/** An OSCAL catalog document -- the file root wraps the body under its model key. */
export interface OscalCatalogDocument {
  readonly catalog: OscalCatalogBody;
}

export interface OscalCatalogExportOptions {
  /** Injected wall-clock instant. Must be a valid `Date`; stamped on `metadata["last-modified"]`. */
  readonly now: Date;
  /** UUID source. Defaults to the browser's `crypto.randomUUID`; override for deterministic output. */
  readonly newId?: () => string;
  /** Catalog title, e.g. "Caisson Canonical Control Catalog". */
  readonly title: string;
  /** Catalog version stamped in `metadata.version`. */
  readonly version: string;
}

/** Slugify a control `family` string into an OSCAL group id. Verbatim: oscal-catalog-export.ts. */
function slugifyFamily(family: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "uncategorized";
}

/** Locale-independent lexicographic comparator. Verbatim: oscal-catalog-export.ts. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Map one merged set of caisson `Framework` packs to an OSCAL `catalog` document. Verbatim port of
 * compliance-core's `toOscalCatalog`: dedups controls sharing the same id across packs (first-seen,
 * after sorting frameworks by id for a stable tie-break), groups by `family`, and sorts groups and
 * controls lexicographically for determinism. Fails closed on an invalid clock.
 */
export function toOscalCatalog(
  frameworks: readonly Framework[],
  options: OscalCatalogExportOptions,
): OscalCatalogDocument {
  if (Number.isNaN(options.now.getTime())) {
    throw new Error("oscal catalog export requires a valid `now` instant");
  }
  const newId = options.newId ?? (() => crypto.randomUUID());

  const controlsById = new Map<string, OscalCatalogControl>();
  for (const framework of [...frameworks].sort((a, b) => cmp(a.id, b.id))) {
    for (const control of framework.controls) {
      if (controlsById.has(control.id)) continue;
      const parts: OscalCatalogPart[] = [
        { name: "statement", prose: control.statement },
      ];
      if (control.guidance !== undefined) {
        parts.push({ name: "guidance", prose: control.guidance });
      }
      controlsById.set(control.id, {
        id: control.id,
        class: "caisson-canonical-control",
        title: control.title,
        props: [
          {
            name: "caisson-family",
            ns: CAISSON_OSCAL_NS,
            value: control.family,
          },
        ],
        links: [
          { href: `urn:caisson:control:${control.id}`, rel: "canonical" },
        ],
        parts,
      });
    }
  }

  const byFamily = new Map<string, OscalCatalogControl[]>();
  for (const control of controlsById.values()) {
    const family = control.props.find(
      (p) => p.name === "caisson-family",
    )?.value;
    const groupId = slugifyFamily(family ?? "");
    const bucket = byFamily.get(groupId) ?? [];
    bucket.push(control);
    byFamily.set(groupId, bucket);
  }

  const groups: OscalCatalogGroup[] = [...byFamily.entries()]
    .sort(([a], [b]) => cmp(a, b))
    .map(([groupId, controls]) => {
      const title = controls[0]?.props.find(
        (p) => p.name === "caisson-family",
      )?.value;
      return {
        id: groupId,
        class: "caisson-control-family",
        title: title ?? groupId,
        controls: [...controls].sort((a, b) => cmp(a.id, b.id)),
      };
    });

  return {
    catalog: {
      uuid: newId(),
      metadata: {
        title: options.title,
        "last-modified": options.now.toISOString(),
        version: options.version,
        "oscal-version": OSCAL_VERSION,
      },
      groups,
    },
  };
}

// ---- Deterministic sample clock/id seam for the poke's rendered output ---------------------------

/** A fixed sample instant -- never `Date.now()` / an argless `new Date()` in a rendered path. */
export const SAMPLE_NOW = new Date("2026-07-18T00:00:00.000Z");

/**
 * A deterministic UUID sequence -- mirrors the real test suite's own `counterIds()` helper
 * (oscal-spine/src/evidence/oscal-catalog-export.test.ts) so the rendered catalog is
 * reproducible across renders instead of drawing a fresh UUID on every keystroke.
 */
export function makeCounterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}
