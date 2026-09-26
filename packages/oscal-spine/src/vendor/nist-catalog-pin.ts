// src/vendor/nist-catalog-pin.ts — the ONE pinned-source-bundle constant for the vendored NIST SP
// 800-53 rev5 OSCAL catalog (SPEC outputs/specs/oscal-spine, binding requirement 1). Every
// consumer — the re-vendor script (packages/oscal-spine/scripts/vendor-nist-catalog.ts), the
// nist80053Crosswalk's `seedProvenance` (crosswalks/nist-800-53.ts), and the drift-guard unit test
// (nist-catalog-pin.test.ts) — reads THIS module. Never a second, independently-drifting copy of
// these values (the exact WR-08 failure the SPEC names).
//
// usnistgov/oscal-content is CC0 1.0 Universal (public domain worldwide) — the ADR-0057/ADR-0333
// licensing floor permits vendoring public-domain/CC0 material verbatim. The catalog bytes are
// committed byte-exact at the sibling `nist-800-53-rev5-catalog.json` — never reformatted, never
// mutated in place (excluded in .prettierignore).

/** The upstream repository the catalog is vendored from. */
export const NIST_CATALOG_REPO = "usnistgov/oscal-content";

/** The upstream path within that repo (never `main` as a fetch target — a pinned commit is). */
export const NIST_CATALOG_UPSTREAM_PATH =
  "nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json";

/** The commit SHA the vendored bytes were fetched at — resolved from the repo's `main` tip at the
 *  moment of vendoring (2026-07-18), never re-resolved implicitly on a later run. */
export const NIST_CATALOG_COMMIT_SHA =
  "78650f02ad9321bb7b817846f8fbd4f2bcd620de";

/** The exact raw-content URL the vendored bytes were fetched from, pinned to the commit above. */
export const NIST_CATALOG_SOURCE_URL = `https://raw.githubusercontent.com/${NIST_CATALOG_REPO}/${NIST_CATALOG_COMMIT_SHA}/${NIST_CATALOG_UPSTREAM_PATH}`;

/** The catalog's own internal `catalog.metadata.version` at this commit (verified at vendor time). */
export const NIST_CATALOG_VERSION = "5.2.0";

/** The catalog's own internal `catalog.metadata["oscal-version"]` — must match the ADR-0179
 *  `OSCAL_VERSION` CI pin (`@caisson-sh/oscal-spine`'s `oscal-export.ts`). */
export const NIST_CATALOG_OSCAL_VERSION = "1.2.2";

/** SHA-256 (lowercase hex) of the exact committed bytes of the sibling vendored JSON file. */
export const NIST_CATALOG_SHA256 =
  "01f37cf90ea99d92242c936cbfbdebcc338eef1f71454e2acac36cc56e9bc062";

/** Filename of the vendored catalog, sibling to this module (`src/vendor/`). */
export const NIST_CATALOG_VENDORED_FILENAME = "nist-800-53-rev5-catalog.json";

/** The coherent pinned-source bundle every consumer imports (binding requirement 1) — catalog
 *  commit + internal version + oscal-version + content hash, travelling together. */
export interface NistCatalogPin {
  readonly repo: string;
  readonly upstreamPath: string;
  readonly commitSha: string;
  readonly sourceUrl: string;
  readonly catalogVersion: string;
  readonly oscalVersion: string;
  readonly sha256: string;
  readonly vendoredFilename: string;
}

export const NIST_CATALOG_PIN: NistCatalogPin = {
  repo: NIST_CATALOG_REPO,
  upstreamPath: NIST_CATALOG_UPSTREAM_PATH,
  commitSha: NIST_CATALOG_COMMIT_SHA,
  sourceUrl: NIST_CATALOG_SOURCE_URL,
  catalogVersion: NIST_CATALOG_VERSION,
  oscalVersion: NIST_CATALOG_OSCAL_VERSION,
  sha256: NIST_CATALOG_SHA256,
  vendoredFilename: NIST_CATALOG_VENDORED_FILENAME,
};
