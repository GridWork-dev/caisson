import config from "@caisson/eslint-config";

// The public site is a Next app; lint it with the shared standards config (bun-resolved,
// like every other workspace member) rather than the deprecated `next lint`. Ignore Next's
// generated output, the static-export dir, the fumadocs-mdx codegen dir, and ambient types.
export default [
  { ignores: [".next/**", "out/**", ".source/**", "next-env.d.ts"] },
  ...config,
  // Build tooling runs on Node — give the .mjs scripts the Node globals they use.
  {
    files: ["scripts/**"],
    languageOptions: {
      globals: { process: "readonly", URL: "readonly", console: "readonly" },
    },
  },
];
