# Knip evidence and adjudication

Command:

```text
bun install --frozen-lockfile
bun run knip --no-exit-code
```

Result:

| Class                  | Count |
| ---------------------- | ----: |
| Unused files           |   156 |
| Unused dependencies    |     5 |
| Unused devDependencies |    31 |
| Unused exports         |    81 |
| Unused exported types  |   118 |

Directly corroborated picker rows:

- `packages/compliance/eu-ai-act.manifest.ts` — unused file (C17).
- `packages/trust-page/package.json:30` — unused `@caisson/frameworks-pack` devDependency (C22).
- `registry/worker/handler.ts:336,340` — unused legacy type/default export; retained because the
  archived governing spec explicitly preserves the `env.REGISTRY_INDEX` contract
  (`outputs/archive/specs/deferred-respec/SPEC-registry-npm-delivery.md:525-526`).
- `apps/site/lib/attestations.ts:70` and `apps/site/lib/pricing.ts:667` — unused exports included
  only after caller/refute verification (C08/C02).

Not auto-admitted:

- Package manifests and generated templates are discovered outside Knip's normal entry model.
- CLI scripts, fixtures, skill scripts, and package entrypoints can be live without an import edge.
- Published exports require external-usage evidence that this repository does not provide.
- `@caisson/access-review` in demos is imported through a relative source path while the workspace
  declaration still supplies the Turbo/dependency edge.

Knip is supporting evidence only; every picker row also has direct caller analysis and an
independent refute verdict.
