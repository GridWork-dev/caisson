import config from "@caisson/eslint-config";

// The ai-kit reference app is a Next app; lint it with the shared standards config (bun-resolved,
// like every workspace package) rather than the deprecated `next lint`. Ignore Next's generated
// output + ambient types. apps/ai-kit is provider-SDK-exempt (it wires the gateway demo directly).
export default [{ ignores: [".next/**", "next-env.d.ts"] }, ...config];
