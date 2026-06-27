# Options — library architecture (Phase 4 → Gate 3)

Three concrete architectures for the **monorepo**, given the Phase-3 locks. Pick one at
**Gate 3**; Phase 5 specs the choice. (`@stack/*` = working namespace; **real name TBD at
Phase 6**.)

## Locked constraints (Phase 3 picker)

- **Monorepo**, one base + editions as packages, **per-module à-la-carte commerce**.
- **Positioning:** "your **AI production codebase starter**" — production-grade, AI-native.
- **v1 = base + ALL FOUR editions** (full depth): **Compliance** (lead, broad base + SOC2/HIPAA evidence kit), **AI Production Kit**, **Local-first AI** (open-core flank), **Agentic-Dev framework**.
- **Generic-competitive base** (beats ShipFast/MakerKit as a base) framed _under_ the differentiators.
- **Ship a buyer-facing MCP server (with auth)** + **AGENTS.md config bundle** in base + editions.
- **Custom self-built support system** (`services/support-bot`): Discord bot + Python LLM dispatch + codebase RAG + hosted inference (API) on cloud runners.
- **Rebuild clean** from proven strategies (Wardfile / gridwork / tessera / gridwork-core / health-service); **pro-private `media-pipeline` = patterns only, zero code.**
- Standardized principles + coding strategies, ground-up (a **separate session** deep-dives production standards + the module/item pipeline — leave a clean seam).

---

## The four editions (constant across all options)

| Edition                              | What it is                                                                                                                                                                                                                              | Seeds (harvestable, rebuild-clean)                                                                                                | Lead net-new                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Compliance** (hero)                | Regulated-app framework: fail-closed RLS + S3 WORM Object-Lock + append-only SHA-256 audit chain + per-tenant KMS field-enc + config-as-code module registry + **SOC2/HIPAA evidence-pack generator**                                   | Wardfile (+il-dbui)                                                                                                               | SOC2/HIPAA control mappings + evidence-pack emitter + framework-update feed |
| **AI Production Kit**                | Production AI-infra: provider-agnostic AI config (all providers) + settings file + **agent-assisted setup** + token-metering (PG atomics) + per-tenant spend caps/circuit-breaker + eval harness/CI gate + prompt registry + guardrails | gridwork (credit quad, metering spine) + prospector (rubric-as-code, cost discipline) + gridwork-core (hooks, fresh-context eval) | unified provider-config layer + the agent-setup coach                       |
| **Local-first AI** (open-core flank) | On-device AI app kit: provider-agnostic compute seam + privacy gate + sqlite-vec ANN + offline Ed25519 license + local canonical store                                                                                                  | tessera + health-service                                                                                                          | clean compute-seam + license kit                                            |
| **Agentic-Dev**                      | Claude-Code-native governed-agent kernel: typed agent/skill/rule schema + lifecycle state machine + local hybrid memory + hooks dispatcher + self-improvement loop                                                                      | gridwork-core                                                                                                                     | decoupled-from-operator kernel                                              |

**Base (generic-competitive substrate, under all editions):** auth + multi-tenancy/**fail-closed RLS** + billing (Stripe/MoR) + **credit wallet/metering** + design-token floor + **AI-native config (AGENTS.md + buyer MCP server w/ auth)** + background jobs + transactional email. (Seeds: gridwork auth/tenant/tier/credits + gridworkdigital 16-FORCE-policy RLS + tessera design-token floor.)

**Cross-cutting platform services** (`services/`, all options):

- `support-bot` — custom: Discord bot + Python LLM dispatch + codebase-RAG + hosted inference on cloud runners; **doubles as a shippable value-add template**.
- `license` — Ed25519 offline-license issuer + Polar/Stripe(MoR) webhook + credit grants (seed: tessera license kit — public copy only).
- `docs` — AI-native docs (Mintlify or self-host Starlight+RAG); the docs `llms.txt` feeds support-bot AND buyers' agents.

---

## Option A — Monolithic base + edition overlays

```
apps/            # one runnable reference app per edition (compliance, ai-kit, local-ai, agent-dev)
packages/
  core/          # the ENTIRE base in one package (auth, rls, billing, credits, ai-config, mcp, ui)
  compliance/    # vertical modules on top of core
  ai-kit/  local-ai/  agent-dev/
services/        # support-bot, license, docs
```

- **Seeds:** base ← gridwork+gridworkdigital; verticals ← Wardfile/tessera/gridwork-core/health-service.
- **Net-new:** moderate — one cohesive base + four vertical layers.
- **Tradeoffs:** ✅ fastest to ship, cohesive, single version. ❌ **à-la-carte module sales hard** (base is monolithic), heavier base, weaker "buy just auth" story.
- **Build seq:** core → compliance → ai-kit → local-ai → agent-dev → services.

## Option B — Composable capability packages _(Recommended)_

```
apps/                      # runnable reference template per edition (the sellable starters)
packages/
  kernel/                  # governance: typed config/schema + lint-gate + standards (gridwork-core)
  auth/  tenancy-rls/  billing/  credits/  audit-worm/  field-crypto/
  ai-config/  mcp-server/  ui/  jobs/ email/    # base, each independently sellable
  compliance/  ai-kit/  local-ai/  agent-dev/   # editions = curated compositions + vertical logic
services/  support-bot/  license/  docs/
tooling/   eslint-config/  tsconfig/  testing/   # the standardized ground-up coding strategy
```

- **Seeds:** auth/billing/credits/tenancy ← gridwork+gwdigital; audit-worm/field-crypto/compliance ← Wardfile; ai-config/mcp/ai-kit ← gridwork+prospector+gridwork-core; local-ai ← tessera+health-service; kernel/agent-dev ← gridwork-core; ui ← tessera design floor.
- **Net-new:** higher — clean package boundaries + a shared `tooling/` standards layer + changesets versioning.
- **Tradeoffs:** ✅ **à-la-carte commerce native** (sell any package), uniform standards enforced once in `tooling/`, clean edition composition, the literal "one base, many areas" vision, best per-module LTV. ❌ more package boundaries + disciplined versioning needed.
- **Build seq:** `tooling/` standards → `kernel` → base packages (auth→rls→billing→credits→ai-config→mcp→ui) → editions → services → reference apps.

## Option C — Generator/registry on top of B (the "AI-production-codebase" play)

```
(everything in Option B)  +
packages/cli/             # `create-stack` — picks edition + modules, scaffolds a tailored repo
registry/                 # shadcn-style module registry the CLI + the buyer's AGENT pull from
```

- **Net-new:** highest — B **plus** a generator CLI + a versioned module registry the **agent-assisted setup** drives (buyer's agent composes their codebase from the registry; generation is **credit-metered** → the codegen-credits model).
- **Tradeoffs:** ✅ strongest differentiation, directly serves "the agent can help you configure", monetizes generation as credits, matches the AI-production framing. ❌ the generator+registry is itself a product to maintain; most build effort.
- **Note:** C is a **layer on B**, not an alternative — recommended as the **v1.x distribution layer once B is solid.**

---

## Recommendation

**Option B now, architected so Option C's CLI/registry drops on top in v1.x.** B delivers the
à-la-carte commerce + uniform standards + clean four-edition composition the locks demand;
C's generator is the differentiation flywheel but shouldn't block the first sellable release.
A is rejected — it forecloses per-module sales, which the operator explicitly wants.

## Templates / editions roadmap (post-v1, to round out the library)

- **Compliance vertical packs** (on the broad base): legal-doc-automation ($152 CPC), fin-ops/billing-compliance ($121–148), certified-payroll (Wardfile-proven), EU-AI-Act Annex-IV kit (regulatory urgency).
- **AI-feature packs:** RAG-starter, agent-framework, eval-harness-as-module, guardrails-module (each à-la-carte).
- **Local-first verticals:** private medical-notes, contract-review, research-corpus (swap tessera's taggers).
- **Vertical SaaS starters** on the base: marketplace, B2B-multi-tenant, agency-ops (gridwork-seeded).
- **The generator (Option C)** + a curated module marketplace (per-module commerce at scale).

---

## 🛑 Gate 3 — pick an option

- **A** monolithic base · **B** composable packages _(recommended)_ · **C** B + generator/registry.
- Confirm B (or choose), then Phase 5 writes the spec set (mirroring Wardfile's `specs/` layout) + ADRs for: monorepo tooling, the base package split, the compliance edition's evidence-engine, the credit/metering model, the buyer-MCP auth, and the custom support-bot service.
