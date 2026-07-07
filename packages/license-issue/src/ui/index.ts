// @caisson/license-issue/ui — optional embeddable admin surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root never re-exports this tree, so importing
// `@caisson/license-issue` pulls no React. Composes the `@caisson/ui` floor.
export { IssuanceLog, licenseStatus } from "./issuance-log.tsx";
export type { IssuanceLogProps, IssuedLicenseRecord } from "./issuance-log.tsx";
