// @caisson-sh/audit-harness/ui — optional embeddable tooling surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root never re-exports this tree, so importing
// `@caisson-sh/audit-harness` pulls no React. Composes the `@caisson-sh/ui` floor.
export { MatrixViewer, buildMatrix } from "./matrix-viewer.tsx";
export type {
  MatrixViewerProps,
  MatrixRow,
  MatrixCell,
} from "./matrix-viewer.tsx";
