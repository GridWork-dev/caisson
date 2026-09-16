# S8 full-backlog Changesets plan — 2026-09-15

Source candidate: **05081a20091d3a7971609daab94008c8d352688e**, reconciled to main **7e11672c29d21b57a12cf1ad1d4758abbd12b66b**. Bun **1.4.2**; installed **@changesets/cli 2.31.1**. Commands: `bun node_modules/@changesets/cli/bin.js status` and the same command with `--output /home/gw/lab/briefs/estate-2026-09/handoff/S8-R352-RELEASE-PLAN.json`, both exit 0, neither with --since. No changesets consumed or package versions changed.

**35 input changesets: 22 nonempty, 13 empty; 60 effective workspace bumps: 57 patch, 3 minor, 0 major.** Twenty releases have explicit changeset entries; forty are dependency-induced (empty changesets arrays in the CLI release plan). A package may have several contributing changesets, so these denominators differ. The privatePackages.version setting is true; a version bump is not itself publication eligibility. The two delisted packages and private/services/tooling workspaces remain subject to the separate publisher filter.

Of the 52 currently eligible package tarballs, 44 have planned version bumps. Unchanged eligible versions: `@caisson/agentic-dev`, `@caisson/ai-production`, `@caisson/ds-manifest`, `@caisson/everything`, `@caisson/local-first`, `@caisson/provenance`, `@caisson/registry-schema`, `@caisson/ui`. These must still satisfy sibling-churn byte reproduction. No final sidecar row count or upload total is inferred from this plan; derive them from the actual later version PR.

| Workspace                              | Bump  | Current | Planned | Origin    |
| -------------------------------------- | ----- | ------- | ------- | --------- |
| `@caisson/access-review`               | patch | 0.3.4   | 0.3.5   | dependent |
| `@caisson/admin`                       | patch | 0.1.4   | 0.1.5   | explicit  |
| `@caisson/agent-dev`                   | patch | 0.6.9   | 0.6.10  | dependent |
| `@caisson/agent-kernel`                | minor | 0.7.1   | 0.8.0   | explicit  |
| `@caisson/agent-runner`                | patch | 0.3.1   | 0.3.2   | explicit  |
| `@caisson/agent-trajectory`            | patch | 0.6.0   | 0.6.1   | dependent |
| `@caisson/ai-config`                   | patch | 0.3.9   | 0.3.10  | dependent |
| `@caisson/ai-evals`                    | patch | 0.5.1   | 0.5.2   | dependent |
| `@caisson/ai-kit`                      | patch | 0.6.4   | 0.6.5   | explicit  |
| `@caisson/ai-meter`                    | patch | 1.1.2   | 1.1.3   | dependent |
| `@caisson/alerting`                    | patch | 0.3.1   | 0.3.2   | dependent |
| `@caisson/artifact-render`             | patch | 0.2.4   | 0.2.5   | dependent |
| `@caisson/audit-harness`               | patch | 1.0.2   | 1.0.3   | explicit  |
| `@caisson/audit-worm`                  | patch | 2.2.3   | 2.2.4   | explicit  |
| `@caisson/auth`                        | patch | 0.4.4   | 0.4.5   | dependent |
| `@caisson/billing`                     | patch | 0.6.8   | 0.6.9   | dependent |
| `@caisson/billing-orchestration`       | patch | 0.4.1   | 0.4.2   | dependent |
| `@caisson/cli`                         | patch | 0.8.0   | 0.8.1   | explicit  |
| `@caisson/compliance`                  | patch | 1.0.3   | 1.0.4   | dependent |
| `@caisson/compliance-core`             | patch | 0.7.1   | 0.7.2   | dependent |
| `@caisson/credits`                     | patch | 0.6.2   | 0.6.3   | dependent |
| `@caisson/demo-registry`               | patch | 0.2.15  | 0.2.16  | dependent |
| `@caisson/demos`                       | patch | 0.1.0   | 0.1.1   | explicit  |
| `@caisson/email`                       | patch | 0.5.7   | 0.5.8   | explicit  |
| `@caisson/field-crypto`                | patch | 1.1.1   | 1.1.2   | dependent |
| `@caisson/frameworks-pack`             | patch | 0.8.1   | 0.8.2   | dependent |
| `@caisson/guardrails`                  | patch | 0.5.0   | 0.5.1   | dependent |
| `@caisson/jobs`                        | patch | 0.7.3   | 0.7.4   | dependent |
| `@caisson/kernel`                      | minor | 0.9.0   | 0.10.0  | explicit  |
| `@caisson/license-issue`               | patch | 1.0.8   | 1.0.9   | dependent |
| `@caisson/license-verify`              | patch | 0.3.9   | 0.3.10  | explicit  |
| `@caisson/local-inference`             | patch | 0.2.0   | 0.2.1   | dependent |
| `@caisson/local-privacy`               | patch | 0.2.0   | 0.2.1   | dependent |
| `@caisson/local-store`                 | patch | 1.1.1   | 1.1.2   | explicit  |
| `@caisson/local-sync`                  | patch | 0.2.1   | 0.2.2   | dependent |
| `@caisson/mcp-server`                  | patch | 0.6.10  | 0.6.11  | dependent |
| `@caisson/migrate`                     | patch | 0.2.13  | 0.2.14  | dependent |
| `@caisson/observability`               | patch | 0.3.8   | 0.3.9   | explicit  |
| `@caisson/org-controls`                | patch | 0.4.1   | 0.4.2   | dependent |
| `@caisson/oscal-spine`                 | patch | 0.2.1   | 0.2.2   | dependent |
| `@caisson/platform-migrations`         | patch | 0.3.4   | 0.3.5   | dependent |
| `@caisson/platform-reads`              | patch | 0.3.0   | 0.3.1   | dependent |
| `@caisson/pricebook`                   | patch | 0.8.4   | 0.8.5   | dependent |
| `@caisson/prompt-registry`             | patch | 1.1.1   | 1.1.2   | dependent |
| `@caisson/rate-limit`                  | patch | 0.2.0   | 0.2.1   | dependent |
| `@caisson/registry`                    | patch | 0.0.25  | 0.0.26  | dependent |
| `@caisson/retention-runner`            | patch | 0.2.1   | 0.2.2   | dependent |
| `@caisson/risk-register`               | patch | 0.3.4   | 0.3.5   | dependent |
| `@caisson/service-betterstack-adapter` | patch | 0.0.10  | 0.0.11  | explicit  |
| `@caisson/service-docs`                | patch | 0.0.15  | 0.0.16  | explicit  |
| `@caisson/service-intel`               | patch | 0.0.10  | 0.0.11  | explicit  |
| `@caisson/service-license`             | patch | 0.1.4   | 0.1.5   | explicit  |
| `@caisson/signing-primitive`           | patch | 0.4.1   | 0.4.2   | dependent |
| `@caisson/site`                        | patch | 0.4.0   | 0.4.1   | explicit  |
| `@caisson/standards-gate`              | patch | 0.1.4   | 0.1.5   | dependent |
| `@caisson/tenancy-rls`                 | patch | 0.6.0   | 0.6.1   | explicit  |
| `@caisson/tool-exec`                   | minor | 0.3.1   | 0.4.0   | explicit  |
| `@caisson/trust-page`                  | patch | 0.3.4   | 0.3.5   | dependent |
| `@caisson/ui-pro`                      | patch | 0.3.7   | 0.3.8   | dependent |
| `@caisson/verify-pack`                 | patch | 0.2.3   | 0.2.4   | dependent |

The local-store egress guard is planned for 1.1.2; betterstack-adapter for 0.0.11. Site session-hint hardening is an application deployment effect (site 0.4.1), not proof that the dependent auth bump publishes that change. Consumers have not moved as a result of this status calculation.

## R378 inventory readback — 2026-09-16

Installed @changesets/cli 2.31.1 full-backlog status confirms 37 pending files and
60 workspace bumps (57 patch, 3 minor, no major). The two additional pending files
are the approval and egress repairs; the effective version plan below is unchanged.
No files consumed or package versions written. See s8-r378-changesets.log.
