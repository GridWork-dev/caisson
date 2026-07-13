# KICKOFF — caisson: platform (security · toolchain · product-standards)

> ## ⚠ POST-AUDIT CORRECTIONS (2026-07-13 adversarial round — READ FIRST, overrides items below)
>
> Full detail: `AUDIT-SYNTHESIS.md` §A. Verdict: needs-amendment (Codex; the dedicated Claude lane failed and returned nothing — Codex + cross-consistency are the only coverage here).
>
> 1. **Tasks 5–6: TypeScript version map INVERTED** — typescript@latest = 7.0.2 GA; 6.0 is @beta only; there is no stable 6.0 bridge and the `tsc6` package name is wrong. Re-derive from `npm view typescript dist-tags` + `npm view @typescript/native-preview dist-tags` before any catalog edit.
> 2. **Task 8: "currently rc.4" is stale** — drizzle-orm latest = 0.45.2; prereleases are 1.0.0-beta.*. GA gate stands; re-read dist-tags at PLAN.
> 3. **Task 13: shadcn GitHub registries resolve as `owner/repo/item`** — `@caisson/button` requires a configured/indexed namespace; use `bunx --bun shadcn@latest add <owner>/<repo>/button#<tag>` or document the namespace first. `npx` violates the Bun-only convention.
> 4. **Task 15: "zero-dependency" would be a false package claim** — `@caisson/ui` declares `radix-ui` + `zod`. Write "native-first"; optionally narrow radix-ui to the Slot subpackage first.
> 5. **Task 4 (Socket):** re-check bun #31028 live status first; and note the global-bunfig plan on dev machines does NOT constrain Railway (the stated exposure) — verify Railway's install path or drop the coverage claim.
> 6. **Task 10 (pgrls MCP):** the gw-core manifest/roster leg had NO owner in the gw-core kickoff — now noted there; confirm at PLAN. **Task 11 (ASSERT):** scope the gw-core Q5 fork explicitly to the case-generator runner, or sequence this after the trial.
> 7. **Tasks 17–20:** all four SPECs came back needs-amendment/rethink — PLAN only after the fork re-lock round (`AUDIT-SYNTHESIS.md` §B + FORK-LOCKS challenges section). DS SPEC's tag line must add `security` (Fork D landed commercial-gated; the A/D locks imply a new unauthenticated server).
> 8. **New HIGH gaps assigned here** (§D): email deliverability (SPF/DKIM/DMARC in terraform + DMARC reports + Resend volume-cliff alert) and public status page + /trust + subprocessor list (Better Stack free page fed by existing /health).

- **Type:** execution · **Tier:** STANDARD · **Repo:** caisson
- **Date:** 2026-07-13 · **Source:** discovery + decision-round forks (tsgo/Drizzle readiness, security wiring, product-stack vetting, graphify architecture)

## Locked decisions

- Better-Auth stays 1.6.23; **org plugin permanently ignored** (in-house `account_member` + RLS is sold product). Upgrade trigger: 1.7 stable on npm `latest` (+ check `trustedProxyHeaders` behind Railway/CF); the real watch is native token hash-at-rest (unblocks outstanding-work #9).
- Radix→Base UI migration **does not exist** (kit uses only `Slot` in 2 files; everything else zero-Radix per ADR-0291). HOLD.
- Billing/metering cluster: skip all (ai-meter already beats LLM0's design; Stripe isn't MoR).
- pgrls: **CI + MCP** (picker). ASSERT: live-service lane here (case-generator lane is gw-core's).

## Task list

### Security / supply chain

1. **bunfig `[install] minimumReleaseAge = 604800`** (append under existing `[test]`). Renovate-wait interaction noted in PR.
2. **zizmor job in `security-scan.yml`** — third job alongside sast/supply-chain, Blacksmith runner; `ZIZMOR_VERSION` + sha appended to `tools/security/versions.env`; advisory → gate ramp (repo is already SHA-pinned, findings should be few).
3. **Sentrik one-shot recon** (20 min) — free-tier scan on a scratch clone as competitor intel + diff its 20-rule supply-chain checklist against `tools/security/`; never CI-wired.
4. **Socket scanner Railway check** — confirm build command for `--production` before any repo-level bunfig scanner (bug #31028 open); dev-machine global bunfig is the gw-core kickoff's lane.

### Toolchain

5. **TypeScript bridge → 6.0** (catalog 5.6/5.7 → `^6.0`); full `bun run check` green. Pin `tooling/standards-gate`'s own `typescript` to 6.x (its `ts.createScanner` waits for the 7.1 API).
6. **Advisory `tsgo --noEmit` CI job** — measure agreement + Blacksmith minute delta (feeds PF2-1). Emit cutover only after a dts-diff of one sold package (`packages/kernel`) shows byte-equivalent declarations.
7. **Turbo 2.10 config** — `--affected` + `--filter` combined in CI, `cacheMaxAge`/`cacheMaxSize` in turbo.json (~5 lines).
8. **Drizzle v1 at GA** (gate: GA, currently rc.4) — `field-crypto`: drizzle-orm → peerDependency `^0.45 || ^1.0` + dual test matrix; `tenancy-rls`: v1 integration-test leg; `apps/site`: catalog bump; `apps/admin`: **delete unused drizzle dep** (also: investigate the knip gap that missed it).

### RLS / evidence

9. **pgrls advisory CI job** — ephemeral migrated Postgres service container → `pgrls lint` + `verify` (Z3 isolation prover) + `diff` grading on migrations; SARIF artifact, non-blocking until it earns trust; **never cited in customer evidence packs yet**.
10. **pgrls MCP server** — wire for the agent loop (verify RLS the agent just wrote in-session). First real project-scoped-MCP decision: prefer a gw-core manifest + roster row for governance consistency (per the MCP-scoping review); note if project-scoped `.mcp.json` is chosen instead, record why.
11. **ASSERT live-service lane** — pre-release behavioral testing of live support-bot/docs-RAG services, outside CI (the offline-deterministic `ai-evals` gate is untouched by design).

### Product standards / distribution

12. **DTCG `tokens.json` export lens** — export-only (v2025.10 spec, OKLCH-native); `gen-tokens-css.ts` untouched; sellable buyer-interop for the theme system.
13. **shadcn GitHub registry for the Apache-2.0 base tier** — `registry.json` in a public repo → `npx shadcn add @caisson/button`; discoverability funnel toward commercial editions; ADR-0097 license-gated registry untouched.
14. **jsx-a11y** devDep in `tooling/eslint-config` (verified gap) + **Playwright `toHaveScreenshot()`** visual regression (config on existing e2e; Chromatic skipped; Lost Pixel archived).
15. **Base UI bookkeeping** — fix `packages/ui/package.json` description ("native-first, zero-dependency behavior; Radix Slot only for `asChild`" — the current text nearly caused a false migration assessment); Slot-only quarterly pin-registry watch; ADR stub: Base UI = favored donor at first Combobox/Number-Field-class need; optional vendor-Slot eval bundled into a future major.

### Knowledge layer

16. **Graphify onboarding** (per the gw-core checklist) — `graphify-out/` gitignore entry; initial `/graphify` build (~$2–5 semantic); `graphify-caisson.toml` manifest + same-commit roster row; post-merge hook on the main checkout (no second watcher — hook-based freshness); add to the 04:00 semantic-refresh set.

### Product-roadmap stubs — SPEC fanout ran 2026-07-13 (operator decision: all four SPEC'd in parallel; specs in the session scratchpad; plan fanout is a later session once forks are locked)

17. **Agent-ready DS surface** (Astryx pattern) — `npx @caisson/ui` typed-JSON CLI + MCP + `doctor` as a sellable feature of the kit. Strongest product idea of the sweep.
18. **Per-row tamperproof verification UI** (Pangea pattern) — membership-proof verification status rendered per audit-timeline row, mapped onto audit-worm's chain; + redaction highlighting in payload-viewer.
19. **Compliance crosswalk** (em-dash prior art) — NIST 800-53 shared spine with frameworks-as-filters; control→collector binding table; named-person Ed25519 attestations on evidence. Plus tweakcn-style theme playground page over `create-theme`.
20. **Rekor external anchoring** (Sectum bookmark) — transparency-log anchor for audit-worm's chain (the one thing a self-hosted WORM chain can't self-prove).

## Gates (STANDARD)

`security` tag fires on tasks 1–4/9–11 (audits at SHIP) · Drizzle task gated on GA · pgrls stays advisory until trust earned · product stubs (17–20) need SPEC before any EXECUTE.
