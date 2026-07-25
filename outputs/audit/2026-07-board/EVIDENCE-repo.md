# EVIDENCE-repo — Phase-0 Evidence Collector A (repo inventory + branch digest)

Source: read-only snapshot `/home/gw/lab/caisson-audit-ro`, detached at `main`,
SHA `f6df03f9a11cd12060b0c6e2b6fd7c62404424cf` (2026-07-23 06:55 -0400). Branch
digest (stage i) reads live refs from `/home/gw/lab/caisson` via the two
sanctioned `git` commands only.

## Stage a — Repo inventory

- **E-A1**: Bun/Turborepo monorepo, workspaces = `tooling/*`, `packages/*`,
  `apps/*`, `registry` (+ likely `services/*`, `infra/*` outside the workspaces
  array — they carry their own `package.json`/Dockerfiles and are built/deployed
  independently). Top-level: `apps/`, `packages/` (61), `services/` (5),
  `infra/` (5), `registry/`, `tools/`, `tooling/`, `scripts/`, `specs/` (5
  product-foundation docs), `docs/`, `knowledge/decisions/` (302 ADR files),
  `outputs/` (specs/plans/reviews/archive), `.changeset/` (23 pending release
  notes), `.github/workflows/`. Evidence: `package.json:1-10`, `ls` of repo root.
- **E-A2**: `apps/` = 7 reference/product surfaces — `admin` (internal ops
  console: intel/catalog/architecture/decisions/business/ops/support/product
  routes, `apps/admin/src/app/*`), `site` (public marketing + marketplace +
  cart + trust/compliance pages, 407 files / ~78k LOC — by far the largest
  single app), `agent-dev` (Agentic-Dev edition CLI reference app),
  `ai-kit` (AI-Production reference app, Next.js wiring shell over the
  `infer()` gateway), `compliance` (Compliance edition reference app, WORM +
  chain-anchor demo), `local-ai` (Local-first edition reference app, offline/
  zero-egress), `base` (framework-agnostic Bun.serve reference, app framework
  deferred per edition). Evidence: `apps/*/package.json` descriptions,
  `apps/admin/src/app/*`.
- **E-A3**: `packages/` (61 dirs) is dominated by two shapes: (1) real
  implementation packages (`kernel`, `agent-kernel`, `field-crypto`,
  `audit-worm`, `cli`, `ui`, `ui-pro`, `mcp-server`, `registry-schema`, …) and
  (2) **pure "bundle" packages** that are only a `manifest.ts` pricing/
  membership pin-map with no implementation code — `agentic-dev` (34 LOC),
  `ai-production` (35 LOC), `everything` (84 LOC), `local-first` (32 LOC),
  `provenance` (28 LOC) are the clearest examples; several other packages
  (`brand`, `demo-registry`, `trust-page`) are similarly thin. These are a
  deliberate product-packaging mechanism (ADR-0257/0077: an edition/persona
  "bundle" is a frozen `members` pin-map, no composition code), not dead code
  — but they inflate the 61-package count for anyone scanning the tree without
  that context. Evidence: `packages/agentic-dev/manifest.ts`,
  `packages/ai-production/manifest.ts`, `packages/everything/manifest.ts`,
  `packages/local-first/manifest.ts`, `packages/provenance/manifest.ts`.
- **E-A4**: `services/` (5) = independently deployed backends: `license`
  (merchant-of-record billing webhook + entitlement store + Ed25519 license
  issuer HTTP surface, 57 TS files / ~23k LOC), `intel` (standing compliance-
  framework watcher daemon, 52 files / ~8.9k LOC), `docs` (AI-native docs
  corpus + retrieval service, 28 files / ~4k LOC), `support-bot` (Discord RAG
  support bot — **Python**, not TS: `pyproject.toml`/`uv.lock`, ~7k LOC across
  `src/caisson_support_bot/*` + a substantial `tests/`/`tests/evals/`/
  `tests/live/` suite — the earlier TS-only LOC pass under-counted this
  service as empty), `betterstack-adapter` (small single-purpose webhook
  reshaper, 3 files / 544 LOC). Evidence: `services/*/package.json` or
  `pyproject.toml` descriptions, `services/support-bot/src/`.
- **E-A5**: `infra/` (5) is thin by design — `terraform/` (16 `.tf` files:
  DNS/CAA/DMARC, WAF, bot-management, status-page, web-analytics — Cloudflare-
  shaped), `kms/`, `discord/`, `worm/` each a single `provision.ts` script,
  `license-issuer/` holds only `ISSUER_PUBLIC_KEY.md` (no code — the public
  key artifact for the license service in E-A4, not a duplicate service).
  Evidence: `infra/*/` file listings.
- **E-A6**: `registry/` is the module/pricing/entitlement source of truth: a
  large generated `index.json` (~390KB), an append-only `ledger.jsonl`
  (~429KB) recording every publish, `tarballs.json` (~160KB), a `schema/`
  package (`module-manifest.ts` referenced by every bundle manifest in E-A3),
  and a `worker/`. Scale here (400KB+ JSON/ledger files) is expected for an
  append-only registry, not bloat. Evidence: `registry/` file sizes.
- **E-A7**: Decision/doc surface is large: 302 ADR files under
  `knowledge/decisions/` (numbering runs past ADR-0373, with an explicit "GTM
  renumber map" and "supersession chains" section in `docs/adr-index.md`
  meaning some numbers were retired/superseded rather than sequential — 300
  ADRs in a single-product repo is a high decision-governance volume worth the
  board's attention regardless of code size). `docs/build-state.md` (601
  lines / 182KB — long lines, a running build-history log) and
  `docs/adr-index.md` (1105 lines / 234KB) are both large accreted logs.
  `specs/00..04-*.md` (5 files) are the frozen product-foundation docs;
  `outputs/specs/` (19 phase-SPEC dirs) is the separate per-phase SPEC log —
  not a duplicate of `specs/`, different purpose (foundation vs. per-change).
  `outputs/archive/` is ~11MB (gitignored-scale accreted audit/review history).
  Evidence: `ls knowledge/decisions | wc -l` → 302, `docs/adr-index.md`
  headers, `wc -l docs/{adr-index,build-state}.md`, `du -sh outputs/archive`.
- **E-A8**: LOC-scale summary (TS/TSX/JS/JSX only, `find | wc -l`, no
  node_modules): `apps/site` ~78k LOC (407 files, largest single unit in the
  repo by a wide margin), `apps/admin` ~15k LOC (113 files), `packages/`
  totals roughly 130k LOC across 61 packages with wide variance (`ui` 130
  files/~7.9k LOC, `audit-worm` 49 files/~11k LOC, `compliance-core` 51
  files/~9.5k LOC down to the near-zero bundle packages in E-A3),
  `services/license` ~23k LOC is the largest service. Evidence: per-directory
  `find … -exec cat {} + | wc -l` pass over `apps/*`, `packages/*`,
  `services/*`, `infra/*`.
- **E-A9**: Consolidation/verification candidates for the board to weigh
  (naming proliferation, not confirmed dead code — each pairing below has a
  plausible separation-of-concerns rationale visible in the tree, but the
  count is worth a deliberate look):
  - **License, 4 homes**: `packages/license-issue` (signing), `packages/
license-verify` (client verification), `services/license` (billing
    webhook + issuer HTTP surface + entitlement store), `infra/license-issuer`
    (public-key doc only). Each has a distinct role by file contents, but a
    reader has to visit 4 directories to understand "how licensing works."
  - **`compliance` vs `compliance-core`** (packages/) — both ship a
    `manifest.ts`; relative purpose split not fully verified in this pass
    (compliance also carries an `eu-ai-act.manifest.ts`), flag for stage-b/c
    to confirm no overlapping responsibility.
  - **`billing` vs `billing-orchestration`** (packages/) — same flag: both
    exist as separate packages, split not independently verified here.
  - **Six `agent-*` packages**: `agent-dev`, `agentic-dev` (bundle, aliases
    to agent-dev per ADR-0257), `agent-kernel`, `agent-runner`,
    `agent-trajectory`, `agent-usage` — naming reads like organic growth
    around one concern; `agentic-dev`'s manifest comment confirms it is the
    "new-vocabulary successor" to `agent-dev`, i.e. intentional but adds a
    second live name for the same edition.
  - **Six `local-*` + `ai-*` families** (`local-ai`(app)/`local-first`/
    `local-inference`/`local-privacy`/`local-store`/`local-sync`; `ai-config`/
    `ai-evals`/`ai-kit`(app+pkg)/`ai-meter`/`ai-production`) — code comments
    (`packages/local-first/manifest.ts`, `packages/ai-kit/src/providers.ts`)
    confirm these are a deliberate layered carve (config vs. transport vs.
    metering vs. eval vs. bundle), not accidental duplication — noted for
    completeness since the raw name list looks redundant at a glance.
  - Apps/packages name overlap (`agent-dev`, `ai-kit`, `compliance`,
    `local-ai` each exist as both an `apps/*` reference app and a
    `packages/*` library) is the edition pattern (app = thin reference wiring
    shell that composes the same-named package) and is not duplication.
- **E-A10**: LLM models/providers referenced in caisson's own code (names
  only): provider transport layer `packages/ai-kit/src/providers.ts` switches
  on `openai`, `anthropic`, `google`, `openrouter`, `groq`, `mistral`,
  `together`, plus a `local` lane; `packages/local-inference/src/` has
  dedicated `azure-openai-transport.ts` and `openrouter-transport.ts`
  adapters. Concrete model IDs pinned in the pricing table
  `packages/ai-meter/src/pricebook.ts`: `openai/gpt-4o-mini`,
  `anthropic/claude-3-5-haiku`, `anthropic/claude-sonnet-4.5`,
  `google/gemini-1.5-flash`. Env var names referenced (values never read):
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`,
  `OPENROUTER_API_KEY`, `OLLAMA_API_KEY`, `STUB_API_KEY` (test lane),
  `PADDLE_API_KEY` (billing, not an LLM provider). This is a genuine
  multi-provider abstraction (one switch statement, one config shape), not
  per-app hardcoding. Evidence: `packages/ai-kit/src/providers.ts:106-156`,
  `packages/ai-meter/src/pricebook.ts:79-99`, `packages/local-inference/src/`.

## Stage i — In-flight branch digest

- **E-I1**: Only two non-`main` branches exist on the remote as of this
  snapshot — no backlog of stale/abandoned feature branches. Evidence:
  `git -C /home/gw/lab/caisson branch -a --sort=-committerdate` → `main`,
  `origin/HEAD`, `origin/main`,
  `origin/admin/caisson-145-module-schematics-design-kickoff-bespoke-blueprint-system`,
  `origin/renovate/dependency-cruiser-18.x`.
- **E-I2**: `admin/caisson-145-module-schematics-design-kickoff-bespoke-blueprint-system`
  — large active branch (145 files changed, +28,358/-2,415), last commit
  2026-07-23 06:32. `git diff main...<branch> --stat` tail shows
  `outputs/specs/module-schematics/PLAN-flagship-pokes.md` (+49) and
  `.changeset/` entries (`adr-0378-wave.md`, `flagship-pokes.md`,
  `module-schematics-pilots.md`) alongside `bunfig.toml`/`package.json`/
  `osv-scanner.toml` edits. The branch's own PLAN doc header ("PLAN —
  flagship-4 pokes (ADR-0378 slice 1)") plus the diff (new
  `apps/site/components/poke/*` files, `media-carousel.tsx`, `cart-*`,
  `decision-band.tsx`, heavy rewrite of `marketplace-diagrams.tsx`/
  `marketplace-surface.tsx`) confirm: this is an in-flight marketing-site
  redesign adding "poke" preview components (per-module interactive
  demos/screenshots) to the marketplace/hero pages, on top of a prior PR
  #326 pilot. **Board should not recommend independent marketplace-page or
  module-preview redesign work — it is already mid-flight here.** Evidence:
  `git diff main...origin/admin/caisson-145-module-schematics-design-kickoff-bespoke-blueprint-system --stat`,
  `PLAN-flagship-pokes.md` (read via `git show <branch>:outputs/specs/
module-schematics/PLAN-flagship-pokes.md`).
- **E-I3**: `renovate/dependency-cruiser-18.x` — small, mechanical, bot-
  authored dependency bump (2 files changed, `bun.lock` + `tooling/
standards-gate/package.json`, 4 insertions/16 deletions), last commit
  2026-07-20. Routine Renovate PR awaiting merge, not a design/product
  workstream — no board action implied beyond "let CI merge it." Evidence:
  `git diff main...origin/renovate/dependency-cruiser-18.x --stat`.
