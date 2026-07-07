// @caisson/audit-worm/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root (`.`) never re-exports this tree, so importing
// `@caisson/audit-worm` pulls no React. Composes the `@caisson/ui` floor.
export { ChainViewer, previewPayload } from "./chain-viewer.tsx";
export type { ChainViewerProps } from "./chain-viewer.tsx";
