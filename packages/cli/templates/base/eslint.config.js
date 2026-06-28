// Minimal flat ESLint config for the generated repo (green from clone — lints nothing until
// you add rules). Extend with your own ruleset as the project grows.
export default [
  {
    ignores: ["dist/", "node_modules/"],
  },
];
