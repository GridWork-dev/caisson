// src/evidence/oscal-iso27001-soa.ts — OSCAL expression of the ISO/IEC 27001:2022 Statement of
// Applicability (SoA). Sibling pattern to `oscal-catalog-export.ts`: a PLAIN, PURE, SEAM-TESTED
// FUNCTION — no I/O, no network, no file write. Input is `SoaRow[]` from
// `@caisson-sh/frameworks-pack`'s `computeIso27001SoaRows` (the pure control/applicable/justification/
// status/evidencePointer computation); this module's only job is the OSCAL shape.
//
// MODEL CHOICE: OSCAL has no dedicated "Statement of Applicability" model. The closest fit —
// the one the OSCAL ecosystem itself uses to represent "control X is applicable via mechanism Y,
// implementation status Z" — is `component-definition`'s `control-implementations` /
// `implemented-requirements` (NIST tutorial: "Creating a Component Definition"). One `component`
// (the Caisson technical-control mapping) carries one `control-implementation` (source = a stable
// Caisson URN, never a resolvable HTTP URL — mirrors `oscal-assessment-plan.ts`'s `import-ssp`
// placeholder idiom; schema-only validation per ADR-0180 never resolves it) with one
// `implemented-requirement` per SoA row.
//
// CITATION-ROW RENDERING (SPEC piece 2 item 3): every row is passed through
// `@caisson-sh/artifact-render`'s `renderCitationRow` before it reaches the OSCAL shape — the same
// readiness-language gate (ADR-0080) and field bounds the buyer trust page's rows carry, so a
// justification string can never smuggle a "compliant"/"certified"/"verified" claim into the export.
//
// DETERMINISM (mirrors oscal-catalog-export.ts): `now` + `newId` are injected; rows are sorted by
// control id regardless of input order, so the same row set always produces byte-identical output.
import { randomUUID } from "node:crypto";
import {
  canonicalize,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel";
import {
  assertReadinessLanguage,
  renderCitationRow,
} from "@caisson-sh/artifact-render";
import {
  CAISSON_OSCAL_NS,
  OSCAL_VERSION,
  type OscalSoaRow,
} from "../contracts.ts";
import type { OscalMetadata, OscalProp } from "./oscal-export.ts";

/** A stable Caisson URN identifying the ISO/IEC 27001:2022 Annex A crosswalk this SoA is sourced
 *  from — an honest identifier, never a fake resolvable URL (mirrors `oscal-assessment-plan.ts`'s
 *  `AP_IMPORT_SSP_HREF`). Schema-only conformance (`--disable-constraint-validation`) never resolves
 *  it, matching the CI oscal-conformance gate. */
export const ISO27001_SOA_SOURCE_URN =
  "urn:caisson:crosswalk:iso-27001-annex-a";

interface OscalImplementedRequirement {
  readonly uuid: string;
  readonly "control-id": string;
  readonly description: string;
  readonly props: readonly OscalProp[];
}

interface OscalControlImplementation {
  readonly uuid: string;
  readonly source: string;
  readonly description: string;
  readonly "implemented-requirements": readonly OscalImplementedRequirement[];
}

interface OscalComponent {
  readonly uuid: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly "control-implementations": readonly OscalControlImplementation[];
}

interface OscalComponentDefinitionBody {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly components: readonly OscalComponent[];
}

/** An OSCAL `component-definition` document — the file root wraps the body under its model key. */
export interface OscalIso27001SoaDocument {
  readonly "component-definition": OscalComponentDefinitionBody;
}

export interface OscalIso27001SoaOptions {
  /** Injected wall-clock instant. Must be a valid `Date`; stamped on `metadata["last-modified"]`. */
  readonly now: Date;
  /** OSCAL UUID source. Defaults to `crypto.randomUUID`; a fixed sequence makes output deterministic. */
  readonly newId?: () => string;
  /** Document title, e.g. "Caisson ISO/IEC 27001:2022 Statement of Applicability". */
  readonly title: string;
  /** Crosswalk data version stamped in `metadata.version` (the `iso27001Crosswalk.crosswalkVersion`). */
  readonly version: string;
}

/** Locale-independent lexicographic comparator (mirrors crosswalk-rollup.ts's own `cmp`). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Map ISO/IEC 27001:2022 Statement-of-Applicability rows to an OSCAL `component-definition` document.
 * Every row renders through `@caisson-sh/artifact-render`'s `renderCitationRow` (readiness-language
 * gate + field bounds) before it reaches the OSCAL shape. Sorted by control id for determinism. Fails
 * closed on an invalid clock or an empty `rows` list (an OSCAL export with zero requirements is not
 * a meaningful SoA — the caller's scope was empty, which is a caller bug, not a valid export).
 */
export function toOscalIso27001Soa(
  rows: readonly OscalSoaRow[],
  options: OscalIso27001SoaOptions,
): OscalIso27001SoaDocument {
  if (Number.isNaN(options.now.getTime())) {
    throw new ValidationError(
      "oscal ISO 27001 SoA export requires a valid `now` instant",
    );
  }
  if (rows.length === 0) {
    throw new ValidationError(
      "oscal ISO 27001 SoA export requires at least one row",
    );
  }
  // Caller-supplied prose gates through the same claim filter every citation row carries below —
  // a document title is a claim surface too (a caller could otherwise stamp "ISO 27001 certified").
  assertReadinessLanguage(options.title, "oscal ISO 27001 SoA options.title");
  const newId = options.newId ?? randomUUID;
  const lastModified = options.now.toISOString();

  const implementedRequirements: OscalImplementedRequirement[] = [...rows]
    .sort((a, b) => cmp(a.control, b.control))
    .map((row) => {
      const citation = renderCitationRow({
        control: row.control,
        claim: row.applicable,
        justification: row.justification,
        ...(row.evidencePointer !== undefined
          ? { evidencePointer: row.evidencePointer }
          : {}),
      });
      const props: OscalProp[] = [
        {
          name: "caisson-soa-applicability",
          ns: CAISSON_OSCAL_NS,
          value: citation.claim,
        },
        { name: "caisson-soa-status", ns: CAISSON_OSCAL_NS, value: row.status },
      ];
      if (citation.evidencePointer !== undefined) {
        props.push({
          name: "caisson-evidence-pointer",
          ns: CAISSON_OSCAL_NS,
          value: citation.evidencePointer,
        });
      }
      return {
        uuid: newId(),
        "control-id": citation.control,
        description: citation.justification,
        props,
      };
    });

  return {
    "component-definition": {
      uuid: newId(),
      metadata: {
        title: options.title,
        "last-modified": lastModified,
        version: options.version,
        "oscal-version": OSCAL_VERSION,
      },
      components: [
        {
          uuid: newId(),
          type: "software",
          title: "Caisson technical-control mapping",
          description:
            "The Caisson technical mechanisms mapped against ISO/IEC 27001:2022 Annex A, expressed as an OSCAL Statement of Applicability.",
          "control-implementations": [
            {
              uuid: newId(),
              source: ISO27001_SOA_SOURCE_URN,
              description:
                "Caisson technical-control crosswalk against ISO/IEC 27001:2022 Annex A.",
              "implemented-requirements": implementedRequirements,
            },
          ],
        },
      ],
    },
  };
}

/** The fixed archive-entry name for the SoA, when attached to an evidence pack (mirrors
 *  `external-anchor.ts`'s `EXTERNAL_ANCHOR_RECEIPT_ENTRY`). */
export const ISO27001_SOA_ARCHIVE_ENTRY = "soa/iso-27001.json";

/**
 * Build the DETACHED archive entry for an already-generated SoA document — canonical bytes under the
 * fixed entry name, ready for `generateEvidencePack`'s optional `iso27001Soa` input (an additive
 * evidence-pack section, never a field merged into the canonical manifest body — the generator does
 * not know what an SoA IS, only that it is bytes under a name, exactly like the external-anchor
 * receipt). Byte-stable: `canonicalize` over the same document always yields the same bytes.
 */
export function buildIso27001SoaArchiveEntry(doc: OscalIso27001SoaDocument): {
  readonly name: string;
  readonly data: Uint8Array;
} {
  return {
    name: ISO27001_SOA_ARCHIVE_ENTRY,
    data: new TextEncoder().encode(canonicalize(doc as unknown as JsonValue)),
  };
}
