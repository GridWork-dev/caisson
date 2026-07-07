// @caisson/prompt-registry/ui — optional embeddable frontend surface (ADR-0250 G2c). Imported ONLY
// via the `./ui` subpath; the package root never re-exports this tree, so importing
// `@caisson/prompt-registry` pulls no React. Composes the `@caisson/ui` floor.
export { PromptBrowser, firstMessagePreview } from "./prompt-browser.tsx";
export type { PromptBrowserProps } from "./prompt-browser.tsx";
