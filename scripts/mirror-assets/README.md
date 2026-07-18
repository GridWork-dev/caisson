# Caisson

> This repository is a **generated, read-only mirror** of the open (Apache-2.0) packages in the
> private Caisson monorepo — development, history, and PRs live there; every commit here is a
> mirror sync (see `MIRROR-MANIFEST.json` for the source commit and `CONTRIBUTING.md` for how to
> report issues).

**Compliance-grade infrastructure for regulated SaaS** — fail-closed Postgres RLS, S3
Object-Lock WORM, an append-only audit chain, and an evidence-pack generator. Caisson is a
production-grade codebase library: the load-bearing infrastructure cheap boilerplates skip —
the parts that matter when you get audited, when the AI bill spikes, when a tenant's rows leak
across RLS, when a regulator asks for evidence.

Compliance is the front door. Every commercial bundle is a composition of the same audited
base — never a fork. This repository is that **open (Apache-2.0) base**: the substrate every
bundle builds on.

## Quickstart

Generate the free EU-AI-Act evidence-path sample (no license required — it depends only on the
open base):

```bash
bunx @caisson-sh/cli@latest --sample eu-ai-act-sample --name my-app --out ./my-app
```

`create-caisson` (the bin `@caisson-sh/cli` ships) composes a tailored repo from the versioned
registry; licensed buyers pick bundles and modules, and it materializes a typed, gated
workspace. Run `bunx @caisson-sh/cli@latest --help` for the full flag list. Requires
[Bun](https://bun.sh) `>= 1.3`.

The open base publishes to npm under the **`@caisson-sh/*`** scope:

```bash
bun add @caisson-sh/kernel @caisson-sh/tenancy-rls
```

> The commercial registry at [caisson.sh](https://caisson.sh) serves the **`@caisson/*`**
> namespace (bundles and commercial modules). The in-product registry module-ids are unchanged;
> only the open packages' public npm scope differs.

Working from a clone of this mirror instead:

```bash
bun install
bun run test
```

## Packages

The open base is Apache-2.0. Every package is composable — a package never depends "up" on a
commercial bundle.

| Package                       | Purpose                                                                                                    | License    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| `@caisson-sh/kernel`          | Governance kernel: typed config loader, the `CaissonError` model, security primitives, the standards gate. | Apache-2.0 |
| `@caisson-sh/tenancy-rls`     | Fail-closed multi-tenant Postgres RLS: FORCE policies, `withTenant`, a missing-filter proof.               | Apache-2.0 |
| `@caisson-sh/auth`            | Auth seam: EdDSA-JWT account tokens (the RLS seam) + session contract.                                     | Apache-2.0 |
| `@caisson-sh/billing`         | Stripe + Paddle behind a `BillingProvider` port: HMAC raw-body webhook verify + domain events.             | Apache-2.0 |
| `@caisson-sh/ai-config`       | Provider-agnostic AI config resolver + buyer settings file.                                                | Apache-2.0 |
| `@caisson-sh/mcp-server`      | Auth-gated buyer MCP: timing-safe Bearer, entitlement-scoped reads, allowlist + credit-gated generate.     | Apache-2.0 |
| `@caisson-sh/jobs`            | Provider-agnostic background-job queue port + in-memory test driver.                                       | Apache-2.0 |
| `@caisson-sh/email`           | Transactional email port: `Emailer` + capture / Resend / Postmark / SMTP / SES drivers.                    | Apache-2.0 |
| `@caisson-sh/migrate`         | Base migration assembler + runner: reads each package's on-disk migrations.                                | Apache-2.0 |
| `@caisson-sh/cli`             | `create-caisson` generator: composes a tailored repo from the versioned registry.                          | Apache-2.0 |
| `@caisson-sh/license-verify`  | Offline license-token verification: wire codec + Ed25519 verify.                                           | Apache-2.0 |
| `@caisson-sh/registry-schema` | Open registry contract: module-manifest + index schema + allowlist helpers.                                | Apache-2.0 |
| `@caisson-sh/observability`   | Vendor-neutral OpenTelemetry bootstrap: env-gated NodeSDK + OTLP/HTTP exporter.                            | Apache-2.0 |
| `@caisson-sh/analytics`       | Product-analytics port: typed event contract + PostHog / no-op drivers.                                    | Apache-2.0 |
| `@caisson-sh/rate-limit`      | Token-bucket rate limiting: per-key + global ceilings, injectable clock.                                   | Apache-2.0 |
| `@caisson-sh/ui`              | Design-system kit: OKLCH token floor + the component recipe.                                               | Apache-2.0 |
| `@caisson-sh/tsconfig`        | Shared strict TypeScript base config.                                                                      | Apache-2.0 |
| `@caisson-sh/eslint-config`   | Shared ESLint flat-config: lint rules + package-boundary enforcement.                                      | Apache-2.0 |
| `@caisson-sh/testing`         | Shared test harness: golden-file regression + the PGlite fail-closed-RLS harness.                          | Apache-2.0 |

## Copying a single UI component via shadcn

This repository also doubles as a [shadcn](https://ui.shadcn.com) GitHub-source registry, so
you can copy one `@caisson-sh/ui` component straight into your own app without adding the
package as a dependency:

```bash
bunx shadcn@latest add caisson-sh/caisson-oss/button
```

Every component depends on the `caisson-tokens` item (the `--cs-*` custom-property sheet each
component reads for light/dark styling) — `shadcn add` pulls it in automatically.

> **If you've already run `shadcn init`:** its default preset seeds its own `components/ui/button.tsx`.
> Adding the caisson `button` item overwrites that file. Rename or back up a customized preset
> component first if you want to keep both.

## The commercial bundles

The open base opens into **six commercial bundles** — Compliance, AI-Production, Local-first,
Agentic-Dev, Provenance, and Everything — each a composition of audited base packages plus
commercial modules (field-level crypto, WORM audit storage, OSCAL evidence packs, metered AI,
guardrails, a governed agent kernel, and more). Every module is also sold à la carte.

- Browse bundles and modules: [caisson.sh/marketplace](https://caisson.sh/marketplace)
- Documentation: [caisson.sh/docs](https://caisson.sh/docs)

## Release pipeline

This repository's contents are synced from the private Caisson monorepo (see
`MIRROR-MANIFEST.json` for the source commit) and published to npm as `@caisson-sh/*` from
this repo via `.github/workflows/publish.yml` — a manual, deliberate step, not automatic on
every sync.

## Support

- Docs and self-serve purchase: [caisson.sh](https://caisson.sh)
- Bugs in the open base: open an issue on this repository's tracker.

## License

Apache-2.0. Each package carries its own `LICENSE`. The commercial bundles and modules are
licensed separately — see [caisson.sh](https://caisson.sh).
