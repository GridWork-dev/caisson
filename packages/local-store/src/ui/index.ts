// @caisson-sh/local-store/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root never re-exports this tree, so importing
// `@caisson-sh/local-store` pulls no React. Composes the `@caisson-sh/ui` floor.
export { StoreSearch } from "./store-search.tsx";
export type { StoreSearchProps, StoreSearchResult } from "./store-search.tsx";
