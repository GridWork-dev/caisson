// @caisson-sh/audit-worm/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root (`.`) never re-exports this tree, so importing
// `@caisson-sh/audit-worm` pulls no React. Composes the `@caisson-sh/ui` floor.
export { ChainViewer, previewPayload } from "./chain-viewer.tsx";
export type { ChainViewerProps } from "./chain-viewer.tsx";
export { ProofPanel } from "./proof-panel.tsx";
export type {
  ProofPanelProps,
  ProofBundleResponse,
  ProofBundleSuccess,
  ProofBundleUnverifiable,
} from "./proof-panel.tsx";
export { useRowVerify } from "./use-row-verify.ts";
export type { RowVerifyResult } from "./use-row-verify.ts";
export { RowStateChip } from "./row-state-chip.tsx";
export type { ChipState } from "./row-state-chip.tsx";
