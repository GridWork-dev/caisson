// src/vendor/nist-catalog-controls.ts — extracts every control id (base controls + enhancements)
// from a parsed NIST SP 800-53 rev5 OSCAL catalog document. This is the existence-check surface
// the nist80053Crosswalk's own unit tests read (every cited 800-53 id must resolve to a real
// vendored control) and the re-vendor script's structural diff reuses (added/removed/renumbered
// ids between the currently-committed catalog and a freshly refetched one).
//
// `extractControlIds` is a PURE walk over an already-parsed document (no I/O, testable with a
// small fixture). `loadVendoredNistControlIds` is the one I/O seam — reads + parses the committed
// vendored file via the pin's own filename, so callers never hardcode a second path.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NIST_CATALOG_PIN } from "./nist-catalog-pin.ts";

interface OscalCatalogControl {
  readonly id: string;
  readonly controls?: readonly OscalCatalogControl[];
}

interface OscalCatalogGroup {
  readonly controls?: readonly OscalCatalogControl[];
}

export interface NistCatalogDocument {
  readonly catalog?: {
    readonly metadata?: {
      readonly version?: string;
      readonly "oscal-version"?: string;
    };
    readonly groups?: readonly OscalCatalogGroup[];
  };
}

/** Recursively collect every control id (a base control's own id plus every nested enhancement's
 *  id, e.g. `ac-2` and `ac-2.1`), uppercased — the vendored catalog's own ids are lowercase
 *  (`ac-2`); crosswalk rows cite the conventional uppercase form (`AC-2`), so the existence check
 *  compares case-insensitively by normalizing both sides to uppercase here. */
function walkControls(
  controls: readonly OscalCatalogControl[] | undefined,
  out: Set<string>,
): void {
  if (controls === undefined) return;
  for (const control of controls) {
    out.add(control.id.toUpperCase());
    walkControls(control.controls, out);
  }
}

/** Every control id declared anywhere in a parsed OSCAL catalog document, uppercased. Pure. */
export function extractControlIds(
  doc: NistCatalogDocument,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const group of doc.catalog?.groups ?? []) {
    walkControls(group.controls, out);
  }
  return out;
}

const HERE = dirname(fileURLToPath(import.meta.url));

/** Read + parse the committed vendored catalog and return its full control-id set (uppercased). */
export function loadVendoredNistControlIds(): ReadonlySet<string> {
  const bytes = readFileSync(
    join(HERE, NIST_CATALOG_PIN.vendoredFilename),
    "utf8",
  );
  return extractControlIds(JSON.parse(bytes) as NistCatalogDocument);
}
