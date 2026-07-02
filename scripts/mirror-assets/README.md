# Caisson

**Compliance-grade infrastructure for regulated SaaS** — fail-closed Postgres RLS, S3
Object-Lock WORM, an append-only audit chain, and an evidence-pack generator. Caisson is a
production-grade codebase library: the load-bearing infrastructure cheap boilerplates skip —
the parts that matter when you get audited, when the AI bill spikes, when a tenant's rows leak
across RLS, when a regulator asks for evidence.

Compliance is the front door. Each edition is a composition of the same audited base — never a
fork. This repository is the **open (Apache-2.0) base**: the substrate every edition builds on.

## Quickstart

```bash
bunx create-caisson --name my-app --edition compliance
```

`create-caisson` composes a tailored repo from the versioned registry: pick an edition and the
modules you want, and it materializes a typed, gated workspace. Requires [Bun](https://bun.sh)
`>= 1.3`.

The open base publishes to npm under the **`@caisson-sh/*`** scope:

```bash
bun add @caisson-sh/kernel @caisson-sh/tenancy-rls
```

> The commercial registry at [caisson.sh](https://caisson.sh) serves the **`@caisson/*`**
> namespace (editions and edition-only modules). The in-product registry module-ids are unchanged;
> only the open packages' public npm scope differs.

Working from a clone of this mirror instead:

```bash
bun install
bun run test
```

## Packages

The open base is Apache-2.0. Every package is composable — a package never depends "up" on an
edition.

| Package                       | Purpose                                                                                                    | License    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| `@caisson-sh/kernel`          | Governance kernel: typed config loader, the `CaissonError` model, security primitives, the standards gate. | Apache-2.0 |
| `@caisson-sh/tenancy-rls`     | Fail-closed multi-tenant Postgres RLS: FORCE policies, `withTenant`, a missing-filter proof.               | Apache-2.0 |
| `@caisson-sh/auth`            | Auth seam: EdDSA-JWT account tokens (the RLS seam) + session contract.                                     | Apache-2.0 |
| `@caisson-sh/billing`         | Stripe + Paddle behind a `BillingProvider` port: HMAC raw-body webhook verify + domain events.             | Apache-2.0 |
| `@caisson-sh/credits`         | Integer credit wallet + append-only ledger + debit-before-spend (402, idempotent).                         | Apache-2.0 |
| `@caisson-sh/ai-config`       | Provider-agnostic AI config resolver + buyer settings file.                                                | Apache-2.0 |
| `@caisson-sh/mcp-server`      | Auth-gated buyer MCP: timing-safe Bearer, entitlement-scoped reads, allowlist + credit-gated generate.     | Apache-2.0 |
| `@caisson-sh/jobs`            | Provider-agnostic background-job queue port + in-memory test driver.                                       | Apache-2.0 |
| `@caisson-sh/email`           | Transactional email port: `Emailer` + capture / Resend / Postmark / SMTP / SES drivers.                    | Apache-2.0 |
| `@caisson-sh/migrate`         | Base migration assembler + runner: reads each package's on-disk migrations.                                | Apache-2.0 |
| `@caisson-sh/cli`             | `create-caisson` generator: composes a tailored repo from the versioned registry.                          | Apache-2.0 |
| `@caisson-sh/license-verify`  | Offline license-token verification: wire codec + Ed25519 verify.                                           | Apache-2.0 |
| `@caisson-sh/registry-schema` | Open registry contract: module-manifest + index schema + allowlist helpers.                                | Apache-2.0 |
| `@caisson-sh/observability`   | Vendor-neutral OpenTelemetry bootstrap: env-gated NodeSDK + OTLP/HTTP exporter.                            | Apache-2.0 |
| `@caisson-sh/ui`              | Design-system kit: OKLCH token floor + the component recipe (Radix base).                                  | Apache-2.0 |
| `@caisson-sh/tsconfig`        | Shared strict TypeScript base config.                                                                      | Apache-2.0 |
| `@caisson-sh/testing`         | Shared test harness: golden-file regression + the PGlite fail-closed-RLS harness.                          | Apache-2.0 |

## The commercial editions

The open base opens into four editions — **Compliance**, **AI Production Kit**, **Local-first
AI**, and **Agentic-Dev** — each a composition of audited base packages plus edition-only
modules (field-level crypto, WORM audit storage, OSCAL evidence packs, metered AI, guardrails,
and more).

- Browse the modules: [caisson.sh/modules](https://caisson.sh/modules)
- Editions and pricing: [caisson.sh/pricing](https://caisson.sh/pricing)
- Documentation: [caisson.sh/docs](https://caisson.sh/docs)

## Support

- Docs and self-serve purchase: [caisson.sh](https://caisson.sh)
- Bugs in the open base: open an issue on this repository's tracker.

## License

Apache-2.0. Each package carries its own `LICENSE`. The commercial editions and their
edition-only modules are licensed separately — see [caisson.sh](https://caisson.sh).
