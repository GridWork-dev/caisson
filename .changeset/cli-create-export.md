---
"@caisson-sh/cli": patch
---

Export the generator's `main(argv)` from `@caisson-sh/cli/create`, so another package can start
`create-caisson` programmatically under Node or Bun. Running the `create-caisson` bin is unchanged.
