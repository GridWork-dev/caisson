import config from "@caisson/eslint-config";

export default [
  ...config,
  {
    // The standalone evidence-pack verifier is a plain (non-TypeScript) CLI script a third party runs
    // directly, on Node or Bun (T-K4) — it needs the Node/WebCrypto runtime globals TS-aware configs
    // elsewhere in this repo get from `types: ["bun"]`, which a `.mjs` file has no type info for.
    files: ["src/evidence/standalone-verifier.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        atob: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
];
