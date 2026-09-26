# Caisson is now open source

Caisson is a set of composable TypeScript packages for building regulated SaaS: fail-closed
tenant isolation, an append-only audit chain, field-level encryption, compliance evidence
generation, and the production rigor that AI features need once they leave a demo. As of this
release, all of it — every package, the generator, the whole catalog — is Apache-2.0 and
published on public npm under `@caisson-sh/*`. The source lives at
[github.com/GridWork-dev/caisson](https://github.com/GridWork-dev/caisson).

## What changed

We built Caisson as a commercial product: a licensed base plus paid module bundles, a checkout
flow, an entitlement-gated private registry, a buyer dashboard, the works. That machinery ran
for a while, but no buyer ever came through it, and keeping a license issuer, a hosted registry,
and an admin control plane alive cost more than the product earned. Rather than let the code rot
behind a paywall nobody was paying into, we relicensed the entire repository Apache-2.0, deleted
the sales machinery, and moved the source to the open. There is no checkout, no license key, no
private registry, and no pricing page. Every package installs the same way any other npm package
does.

None of the engineering changed. The row-level-security tenancy model, the WORM audit chain, the
per-tenant field encryption, and the AI metering and guardrail layers are the same code that ran
in the commercial product — we didn't strip anything out to make it giveable away. What changed
is who can read it, fork it, and ship it without asking us first.

## What's in it

A shared base substrate — kernel, auth, tenancy RLS, billing provider ports, jobs, email, a UI
token floor, an MCP server, and the `create-caisson` generator — plus five module families built
on top of it:

- **Compliance** — WORM audit storage, an audit chain, signed evidence packs mapped to named
  framework clauses (SOC 2, HIPAA Security, the EU AI Act), access reviews, an AI risk register,
  OSCAL export, and a trust-page generator.
- **AI-Production** — token metering with per-tenant spend caps, a CI eval gate that fails a
  build on a real quality regression, PII and moderation guardrails, and a versioned prompt
  registry.
- **Local-first** — on-device inference, a default-deny privacy egress gate, local hybrid vector
  and full-text search, and two-way offline sync.
- **Agentic-Dev** — a governed kernel for AI coding agents: a typed agent/skill/rule schema, a
  seven-act lifecycle state machine, and a default-deny tool-execution gate so an agent never
  reaches a bare shell.
- **Provenance** — detached Ed25519 signing over evidence, the same append-only audit chain
  Compliance uses, and per-tenant field encryption.

A sixth grouping, Everything, is just the full catalog named as one thing. None of the five
families are forks of each other or of the base; a package that's useful in more than one family
(field-crypto, for instance) is one package, composed into whichever family needs it.

## Getting started

The fastest way in is the generator:

```sh
bunx --package @caisson-sh/cli create-caisson
```

Run interactively it prompts for a project name and which modules to include. Scripted, it takes
flags:

```sh
create-caisson my-app --module @caisson-sh/field-crypto@<version> --framework next
```

`--help` lists the rest. Every module resolves from public npm, so there's no `.npmrc` to edit
and no token to provision. You can also skip the generator and add any package straight into an
existing project:

```sh
bun add @caisson-sh/kernel @caisson-sh/tenancy-rls
```

The docs are the manual: what each package does, how it composes, and the contract it upholds.

## How we're maintaining it

Honestly: best-effort, no SLA. This is not a company-backed open-source project with a support
team behind it. Dependency updates land in one monthly batch rather than a stream of individual
bumps. Security reports get a real process — private reporting through GitHub or
security@caisson.sh, an acknowledgement within 7 days, and coordinated disclosure — but a feature
request or a "when will you fix this" issue may sit for a while before anyone gets to it. Small,
focused pull requests with tests are the ones most likely to land quickly; a larger change is
worth opening a Discussion about before writing the code, so we can agree on the shape first.

## Questions

We're not running a Discord or a support inbox for this.
[GitHub Discussions](https://github.com/GridWork-dev/caisson/discussions) is the place to ask
how something works, propose a change, or report that something in the docs doesn't match the
code. Bugs go in an issue with a minimal reproduction. Security issues never go in a public
issue — see `SECURITY.md`.

If you build something with it, we'd like to hear about it, but that's the extent of the ask.
