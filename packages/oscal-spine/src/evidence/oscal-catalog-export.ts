// src/evidence/oscal-catalog-export.ts — OSCAL catalog-model export of the caisson canonical
// control catalog (SPEC outputs/specs/oscal-spine (a), ADR-0363/ADR-0364). Sibling pattern to
// `oscal-export.ts`: a PLAIN, PURE, SEAM-TESTED FUNCTION — no I/O, no network, no file write.
//
// Input: `Framework[]` from `@caisson-sh/frameworks-pack` (the three shipped own-authored packs).
// Output: ONE merged OSCAL `catalog` document (F4 lock) — `groups` mirror each control's own
// `family` field; controls addressed under a caisson URN namespace (`urn:caisson:control:<id>`,
// mirroring the existing `CAISSON_OSCAL_NS` prop convention) via a `link`, while the control's own
// OSCAL `id` stays the bare canonical control id (a valid OSCAL token). A canonical control shared
// verbatim across multiple packs (e.g. `AUDIT.IMMUTABLE-LOG` in both soc2-tsc and eu-ai-act — the
// existing "reuses ... verbatim" authoring pattern) is DEDUPED to one entry, keyed on its id — the
// merged catalog would otherwise carry duplicate ids across groups, which OSCAL forbids.
//
// DETERMINISM (mirrors oscal-export.ts): the wall-clock instant is INJECTED (`now`) and UUID
// minting is a SEAM (`newId`, default `crypto.randomUUID`). Groups and controls are sorted
// lexicographically by id regardless of input order, so the same catalog set always produces
// byte-identical output — golden-fixturable.
import { ValidationError } from "@caisson-sh/kernel";
import {
  CAISSON_OSCAL_NS,
  OSCAL_VERSION,
  type OscalFramework,
} from "../contracts.ts";
import type { OscalMetadata, OscalProp } from "./oscal-export.ts";

/** One prose part of a control body (`statement`, and optionally `guidance`). */
interface OscalCatalogPart {
  readonly name: string;
  readonly prose: string;
}

/** A link on a control — here the caisson URN identifier, distinct from the control's own OSCAL
 *  `id` (mirrors the `CAISSON_OSCAL_NS` prop convention already used for Caisson-namespaced data). */
interface OscalCatalogLink {
  readonly href: string;
  readonly rel: string;
}

interface OscalCatalogControl {
  readonly id: string;
  readonly class: string;
  readonly title: string;
  readonly props: readonly OscalProp[];
  readonly links: readonly OscalCatalogLink[];
  readonly parts: readonly OscalCatalogPart[];
}

interface OscalCatalogGroup {
  readonly id: string;
  readonly class: string;
  readonly title: string;
  readonly controls: readonly OscalCatalogControl[];
}

interface OscalCatalogBody {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly groups: readonly OscalCatalogGroup[];
}

/** An OSCAL catalog document — the file root wraps the body under its model key. */
export interface OscalCatalogDocument {
  readonly catalog: OscalCatalogBody;
}

export interface OscalCatalogExportOptions {
  /** Injected wall-clock instant. Must be a valid `Date`; stamped on `metadata["last-modified"]`. */
  readonly now: Date;
  /** OSCAL UUID source. Defaults to `crypto.randomUUID`; a fixed sequence makes output deterministic. */
  readonly newId?: () => string;
  /** Catalog title, e.g. "Caisson Canonical Control Catalog". */
  readonly title: string;
  /** Catalog version stamped in `metadata.version` — caller-supplied (this merges N framework
   *  packs, each with its own version, so no single version is inferred). */
  readonly version: string;
}

/** Slugify a control `family` string into an OSCAL group id (lowercase, hyphenated, alnum-only). */
function slugifyFamily(family: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "uncategorized";
}

/** Locale-independent lexicographic comparator (mirrors crosswalk-rollup.ts's own `cmp`). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Map one merged set of caisson `Framework` packs to an OSCAL `catalog` document (SPEC scope (a),
 * F4 = one merged catalog). Deduplicates controls sharing the same canonical id across packs
 * (first-seen wins — the shared-control authoring convention guarantees identical
 * id/title/family/statement across packs, so no data is lost). Groups controls by `family`,
 * sorted lexicographically for determinism. Fails closed on an invalid clock.
 */
export function toOscalCatalog(
  frameworks: readonly OscalFramework[],
  options: OscalCatalogExportOptions,
): OscalCatalogDocument {
  if (Number.isNaN(options.now.getTime())) {
    throw new ValidationError(
      "oscal catalog export requires a valid `now` instant",
    );
  }
  const newId = options.newId ?? (() => crypto.randomUUID());

  // DEDUP IS GLOBAL, BY CONTROL ID -- NOT per-family. A shared control (e.g. AUDIT.IMMUTABLE-LOG,
  // reused verbatim on id/title/statement across soc2-tsc and eu-ai-act) is NOT guaranteed to
  // carry the SAME `family` in every pack (soc2-tsc: "Audit & Accountability"; eu-ai-act:
  // "Record-Keeping" -- a real divergence in the shipped data). Deduping per-family-bucket would
  // let the same id appear in TWO groups, which OSCAL forbids (control ids are unique
  // document-wide) -- so this pass resolves one winning family per control FIRST, then groups.
  //
  // Sort frameworks by id BEFORE the dedup pass, so which pack's copy wins (id/title/family/
  // statement/guidance can all vary in the source data despite the "reused verbatim" convention
  // nominally covering id/title/statement) is a stable tie-break, never the caller's input array
  // order — the determinism guarantee this module makes (mirrors crosswalk-rollup.ts's own
  // sort-before-fold discipline).
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
      // Family title: every control routed into this group id shares the same `family` string by
      // construction (the group id is derived FROM `family`), so the first is authoritative.
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
