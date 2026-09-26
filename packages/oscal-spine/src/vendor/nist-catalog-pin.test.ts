// src/vendor/nist-catalog-pin.test.ts — the drift guard (SPEC oscal-spine binding requirement 1):
// the committed vendored catalog's bytes must always hash to the pinned SHA-256, and its own
// internal `version`/`oscal-version` must always match the pin. Rides the `check` gate (plain `bun
// test ./src`) — no new CI job required (a bad overwrite of the vendored file fails here).
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NIST_CATALOG_PIN } from "./nist-catalog-pin.ts";
import {
  extractControlIds,
  loadVendoredNistControlIds,
  type NistCatalogDocument,
} from "./nist-catalog-controls.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED_PATH = join(HERE, NIST_CATALOG_PIN.vendoredFilename);

describe("vendored NIST SP 800-53 rev5 catalog — pin drift guard", () => {
  test("the committed bytes hash to the pinned SHA-256", () => {
    const bytes = readFileSync(VENDORED_PATH);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).toBe(NIST_CATALOG_PIN.sha256);
  });

  test("the committed catalog's own internal version + oscal-version match the pin", () => {
    const doc = JSON.parse(
      readFileSync(VENDORED_PATH, "utf8"),
    ) as NistCatalogDocument;
    expect(doc.catalog?.metadata?.version).toBe(
      NIST_CATALOG_PIN.catalogVersion,
    );
    expect(doc.catalog?.metadata?.["oscal-version"]).toBe(
      NIST_CATALOG_PIN.oscalVersion,
    );
  });

  test("the pin's oscal-version matches the ADR-0179 OSCAL_VERSION CI pin", () => {
    // Kept as a literal (not an exporter import) so a future OSCAL_VERSION bump in
    // @caisson-sh/oscal-spine's oscal-export.ts is caught by a human re-reading this assertion,
    // not silently drifted.
    expect(NIST_CATALOG_PIN.oscalVersion).toBe("1.2.2");
  });

  test("the vendored catalog resolves 1000+ control ids (sanity floor on the walk)", () => {
    const ids = loadVendoredNistControlIds();
    expect(ids.size).toBeGreaterThan(1000);
    expect(ids.has("AC-2")).toBe(true);
    expect(ids.has("AU-9")).toBe(true);
  });
});

describe("extractControlIds — pure walk (fixture, no I/O)", () => {
  test("collects base controls and nested enhancements, uppercased", () => {
    const doc: NistCatalogDocument = {
      catalog: {
        groups: [
          {
            controls: [
              {
                id: "ac-2",
                controls: [{ id: "ac-2.1" }, { id: "ac-2.2" }],
              },
              { id: "ac-3" },
            ],
          },
        ],
      },
    };
    expect([...extractControlIds(doc)].sort()).toEqual([
      "AC-2",
      "AC-2.1",
      "AC-2.2",
      "AC-3",
    ]);
  });

  test("an empty/missing catalog shape returns an empty set, never throws", () => {
    expect(extractControlIds({})).toEqual(new Set());
    expect(extractControlIds({ catalog: {} })).toEqual(new Set());
  });
});
