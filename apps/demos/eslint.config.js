import config from "@caisson/eslint-config";

// The demo surface is a Next app; lint it with the shared standards config (bun-resolved, like
// every other workspace member) rather than the deprecated `next lint`. Ignore Next's generated
// output and ambient types.
export default [{ ignores: [".next/**", "next-env.d.ts"] }, ...config];
