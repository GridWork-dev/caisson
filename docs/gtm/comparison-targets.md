---
updated: 2026-07-07
status: live
grounds:
  - outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md
  - knowledge/decisions/ADR-0080-copy-messaging-expansion.md
  - docs/gtm/positioning.md
  - docs/state/decisions-and-forks.md
---

# Comparison-page target list — "Caisson vs X"

The strongest single AEO lever the pre-launch research found (SYNTHESIS §4.1): 15–20
`Caisson vs X` pages, each with an answer capsule in the first 30%, comparison tables over
prose, FAQPage schema, a visible last-updated date, and **honest** trade-offs. This is the
verified target list. Every product below was confirmed real and current via web search
(2026-07); the honesty rule (ADR-0080) is binding — a comparison page that overclaims
against a real competitor is worse than no page.

**Build discipline:** `gw-gtm-copywriter` drafts each page (claims scraped + dated,
PAL-challenged) and stops at a committed branch; the operator publishes. Do not invent a
number a competitor doesn't publish. Where Caisson and the competitor solve different
problems (the compliance platforms), the page's job is to draw the honest line, not to
declare a winner.

## Group A — SaaS boilerplates / starter kits (position: the compliance-first alternative)

The honest frame: these ship auth + billing + a landing page fast. Caisson ships the
compliance and multi-tenant-isolation substrate they mostly don't — fail-closed RLS, WORM
audit logs, evidence packs. A team picking a kit _and_ facing an audit is the buyer.

| Target               | Real?                                                       | Angle                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ShipFast**         | Yes ($199, Next.js)                                         | The speed-to-launch default. Frame: ship fast vs ship auditable — Caisson adds the compliance substrate ShipFast leaves to you.                                                                       |
| **Makerkit**         | Yes ($299, Next.js/Supabase)                                | Deep B2B multi-tenancy via Supabase. Frame: app-layer tenancy vs database-enforced fail-closed RLS + WORM evidence.                                                                                   |
| **Supastarter**      | Yes ($299, Next/Nuxt/TanStack)                              | The most feature-rich kit. Frame: features breadth vs compliance depth + own-the-source licensing.                                                                                                    |
| **SaaS Pegasus**     | Yes ($249, Django/Python)                                   | The Django incumbent. Frame: stack contrast (Python vs TypeScript) + the compliance layer Pegasus doesn't carry.                                                                                      |
| **TurboStarter**     | Yes (multi-client, Next.js)                                 | Cross-client/monorepo scope. Frame: client breadth vs regulated-backend depth.                                                                                                                        |
| **Open SaaS (Wasp)** | Yes (free, MIT, Wasp)                                       | The free open-source kit. Frame: free-but-Wasp-framework-bound vs Apache-2.0 base you own on plain Next/Postgres, plus compliance.                                                                    |
| **Bedrock**          | Yes (Next.js, "SOC 2-compliant audit logging + SSO + RBAC") | The closest boilerplate on positioning. Frame: SOC 2 _feature checkboxes_ vs a control registry crosswalked to clauses + deterministic OSCAL evidence packs. The sharpest honest contrast in Group A. |
| **Shipixen**         | Yes (Next.js)                                               | Codegen-style boilerplate generator. Frame: generated scaffold vs composable audited packages.                                                                                                        |
| **SaaSRock**         | Yes (Next.js/Remix)                                         | Admin-heavy kit. Frame: admin CRUD vs compliance substrate.                                                                                                                                           |
| **Divjoy**           | Yes (React codegen)                                         | The React code generator. Frame: front-end scaffold vs full regulated backend.                                                                                                                        |

## Group B — Compliance automation platforms (position: complement + contrast, honestly)

These are **not head-to-head** with Caisson and the page must say so. Vanta / Drata /
Secureframe are GRC SaaS that _monitor_ your systems and _collect evidence_ to run an
audit; Caisson is the _code that implements the controls_ those platforms look for. The
honest "own vs rent" angle: Caisson gives you the fail-closed RLS, WORM log, and
OSCAL-exportable evidence _in your own codebase, one-time_; a GRC platform is a recurring
subscription that watches whatever you built. Many buyers use both.

| Target          | Real?                                   | Angle                                                                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vanta**       | Yes (~35% share, market leader)         | The category default. Frame: rent continuous monitoring (Vanta) vs own the controls + evidence generation (Caisson); they compose.                                                                                                                                                                                          |
| **Drata**       | Yes (~25% share)                        | Deep automation + audit hub. Frame: same own-vs-rent line; Caisson emits the OSCAL evidence Drata would otherwise collect from your stack.                                                                                                                                                                                  |
| **Secureframe** | Yes (~15% share)                        | Multi-framework GRC. Frame: framework coverage as a service vs framework mappings as code you own.                                                                                                                                                                                                                          |
| **Sprinto**     | Yes (startup-focused)                   | Fast first-SOC-2 for startups. Frame: guided-onboarding SaaS vs a codebase that ships the controls pre-wired.                                                                                                                                                                                                               |
| **Scytale**     | Yes (80+ frameworks)                    | Broad framework GRC. Frame: breadth-of-frameworks vs depth-of-implementation.                                                                                                                                                                                                                                               |
| **Thoropass**   | Yes (software + audit under one roof)   | Compliance + the auditor bundled. Frame: outsourced audit path vs own-the-evidence-pipeline.                                                                                                                                                                                                                                |
| **Delve**       | Yes (AI-native newcomer)                | AI agents gather evidence. Frame (updated 2026-07-10): own-vs-verify — the 2026 fabricated-reports allegations (TechCrunch 2026-03-22, cited + dated, labeled as allegations) made "can you verify evidence without trusting the collector" the buying question; deterministic, externally anchored evidence is the answer. |
| **AuditKit**    | Yes (added 2026-07-10, CAISSON-76)      | The closest wedge-to-wedge target: subscription audit-log SDK + SOC 2 prep ($99–999+/mo, AGPLv3 core + commercial /ee). Frame: rent the audit-log service vs own the audit infrastructure (external WORM anchor, field-crypto, deterministic OSCAL). Parity research: `outputs/research/auditkit-parity-2026-07-10.md`.     |
| **Comp AI**     | Yes (open-source, AGPLv3, Bun/Postgres) | The closest philosophical comparable — open-source, self-host, dev-owned compliance. Frame: AGPLv3 GRC _platform_ to run vs an Apache-2.0 _infrastructure library_ you compose into your app. The most nuanced page; write it carefully and fairly.                                                                         |

## Group C — Build in-house

| Target                | Angle                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Build it yourself** | The real default competitor. Frame: the build-vs-buy math — the person-months to wire fail-closed RLS + WORM + a hash-chained audit log + OSCAL export correctly, against a one-time perpetual license where you still own and can read every line. Caisson already ships a `/build-vs-buy` page; the comparison page is its long-form, table-heavy sibling. |

## The 21 targets, slug list

`shipfast` · `makerkit` · `supastarter` · `saas-pegasus` · `turbostarter` · `open-saas` ·
`bedrock` · `shipixen` · `saasrock` · `divjoy` · `vanta` · `drata` · `secureframe` ·
`sprinto` · `scytale` · `thoropass` · `delve` · `auditkit` · `comp-ai` · `create-t3-app` ·
`build-in-house`

> `create-t3-app` (the free T3 scaffold) is included as a "vs a free stack scaffold" contrast
> — real and current, dev-audience relevant. Synthesis-named `compliance.tf` and `Clynova`
> were dropped: neither verified as a real, current product in the 2026-07 search, and the
> honesty rule forbids a comparison page against an unconfirmed target. The verified
> Bedrock / Comp AI / Sprinto / Scytale / Thoropass are stronger substitutes.
