// @caisson/local-store/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY via
// the `./ui` subpath; the package root never re-exports this tree, so importing
// `@caisson/local-store` pulls no React. Composes the `@caisson/ui` floor.
export { StoreSearch } from "./store-search.tsx";
export type { StoreSearchProps, StoreSearchResult } from "./store-search.tsx";
