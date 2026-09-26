# Caisson

Composable TypeScript packages for building regulated SaaS: fail-closed tenant isolation, an
append-only audit chain, field-level encryption, compliance evidence, and the production rigor
around AI features. Every package is Apache-2.0 and published under `@caisson-sh/*`.

[caisson.sh](https://caisson.sh) · [Docs](https://caisson.sh/docs) · [Demos](https://caisson.sh/marketplace)
· [Discussions](https://github.com/GridWork-dev/caisson/discussions)

## Start a project

```sh
bunx --package @caisson-sh/cli create-caisson
```

`create-caisson` scaffolds a repo from the module catalog. In a terminal it prompts for the project
name and the modules to include. To script it, pass them as flags, for example
`create-caisson my-app --module @caisson-sh/field-crypto@<version> --framework next`; `--help` lists
every flag. Every module installs from the public npm registry. You can also add any package to an
existing project:

```sh
bun add @caisson-sh/kernel @caisson-sh/tenancy-rls
```

## What is in the box

A shared base (kernel, auth, fail-closed row-level security, billing drivers, jobs, email, UI kit,
an MCP server, the generator) and five module families on top of it:

| Family            | What it covers                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Compliance**    | WORM audit storage, an audit chain, evidence packs, access reviews, an AI risk register, OSCAL export, a trust page |
| **AI-Production** | Metering, spend caps, guardrails, prompt versioning, and a CI eval harness                                          |
| **Local-first**   | On-device inference, a privacy egress gate, local vector search, and two-way sync                                   |
| **Agentic-Dev**   | A governed-agent kernel: typed agent/skill/rule schema, a guarded lifecycle, sandboxed tool execution               |
| **Provenance**    | Detached signing, an append-only audit chain, and per-tenant field encryption                                       |

Each package's README covers its API. The site's [module pages](https://caisson.sh/marketplace)
have a live demo for most of them.

## Repository layout

```
packages/            the published packages (one directory per @caisson-sh/<name>)
apps/site            caisson.sh: marketing pages and docs (static export)
apps/demos           the interactive module demos served at caisson.sh/demos
tooling/             the standards gate, lint policy, tsconfig and test helpers
specs/               the founding concept specs
knowledge/decisions/ architecture decision records (append-only)
docs/                contributor-facing design notes
```

## Develop

Requires [Bun](https://bun.sh) 1.4.

```sh
bun install
bun run check    # build, lint, typecheck, test, and the standards gate
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, including changesets.

## Maintenance

Caisson is maintained on a best-effort basis with no SLA. Dependency updates arrive in one
monthly batch; security reports are handled as described in [SECURITY.md](SECURITY.md).

## License

Apache-2.0. Copyright 2026 Caisson Software LLC. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
