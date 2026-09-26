# AGENTS — @caisson-sh/cli (create-caisson)

Agent-facing contract for driving generation.

## Invariants (do not violate)

- **Catalog check BEFORE side effects.** Always go through `generate`: every module id + version is
  validated against the registry index (`assertKnownModule` / `assertKnownVersion`, slug regex
  re-asserted) **before any path is constructed or any subprocess spawned**. Never build a path
  from an unvalidated id/version — a raw version string is a traversal surface.
- **Write through the writer.** `createFileSetWriter` re-asserts path safety and writes atomically;
  never write a generated file set by hand.

## Selection shape

```
{ projectName: <lowercase-slug>,
  modules: [{ id: "@caisson-sh/<slug>", version: "<semver>" }, …],
  deployTarget?: "railway"|"fly"|"vercel",
  framework?: "next" }
```

Zod `.strict()` rejects unknown fields. `projectName` is a strict slug (it becomes a directory at
generation time — no traversal).
