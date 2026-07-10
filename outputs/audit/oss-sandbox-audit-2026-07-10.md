# OSS W1 sandbox validation — audit (2026-07-10)

**Program:** ADR-0318 / `outputs/specs/oss-launch/SPEC-oss-launch-program.md`, Kickoff M
(`kickoff/m-oss-launch`). **Gate:** zero open P0/P1 in the mirror sandbox → W2 (history
cut-over) unblocks. **Method:** exporter run at source commit `6656c3be` (final re-run
`386118cf`), then three independent validation tracks in Docker `oven/bun:1.3.14` clean-rooms
plus a two-layer leak scan — an OSS-track buyer simulation (tokenless), a commercial-track
buyer simulation (licensed, against the LIVE registry), and a docs/prose audit panel.

## Verdict

**PASS for the mirror. The exported tree is leak-clean, self-contained, and green on its own
documented commands** (`bun install` → `bun run build` → `bun run test`, exit 0 across 19
packages, final run v4). Every P0/P1 found in the mirror itself was fixed in-branch and
re-validated. **Separately, the commercial track found the LIVE registry's buyer install path
broken (two P0s)** — pre-existing production defects outside this kickoff's tree, recorded
below with a disposition fork for the operator; they do not gate W2 (the cut-over pushes to a
still-private repo and publishes nothing to buyers) but MUST be resolved before W3/announce.

## Leak scan (two layers) — CLEAN

- **trufflehog** (filesystem mode, verified+unverified) over the full export: **0 findings**.
- **Internal-reference grep battery** (private package names, commercial slugs, `caisson.sh`
  internal hosts, ADR paths, operator identifiers, entitlement-token material): **0 lines** in
  v4 (one v3 hit — a `billing-orchestration` prose mention — eliminated by the prose-allowlist
  rewrite, commit `a0d731a6`). The exporter's own entitlement-token scan (dev-keypair exempt)
  and self-containment gate both pass.

## OSS-track findings (tokenless buyer) — all fixed in-branch

| ID        | Sev                       | Finding                                                                                                                                                                                                                                  | Fix                                                                                                                                                                                            |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-C4      | **P0**                    | Flagship tokenless sample `eu-ai-act-sample` hardcoded `@caisson-sh/kernel: ^0.1.0` vs real `0.4.2` — unsatisfiable range, sample `bun install` permanently broken                                                                       | Pin bumped to `^0.4.2` (`56206fb3`); `sample-templates.test.ts` now reads the kernel version dynamically so future version cuts fail loud instead of shipping stale                            |
| L-A1      | P1                        | `registry-schema/src/entitlement-expansion.test.ts` reads repo-root `registry/index.json` (commercial, correctly absent) → mirror's documented `bun run test` fails ENOENT                                                               | Added to the exporter's `EXCLUDE_TEST_FILES` + `MIRROR-MANIFEST.json` excludedTests (`a0d731a6`)                                                                                               |
| L-A2      | P1                        | `registry-schema/src/bundle-manifests.test.ts` dynamically imports five commercial bundle packages absent from the mirror                                                                                                                | Same exclusion mechanism                                                                                                                                                                       |
| L-C1      | P1                        | Root README quickstart said `bunx create-caisson` — a package name that will never exist on npm (the bin ships inside `@caisson-sh/cli`); contradicted cli's own README                                                                  | README rewritten (`7e8eed4f`): quickstart is `bunx @caisson-sh/cli@latest --sample eu-ai-act-sample …`                                                                                         |
| L-C3      | P3                        | cli README example pinned `kernel@1.0.0` (never published)                                                                                                                                                                               | Corrected to `0.4.2`                                                                                                                                                                           |
| —         | P1 (progressive)          | `cli.test.ts` (e2e needs `registry/index.json`) and `framework-next.compose.test.ts` (typechecks against `@caisson/*` resolved from cli's node_modules — fails by construction under the `@caisson-sh/*` rename) failed the mirror suite | Both added to `EXCLUDE_TEST_FILES` (`a0d731a6`, `386118cf`); exporter also emits a root `bunfig.toml` with `pathIgnorePatterns` for `dist/`                                                    |
| L-B1/L-C2 | environmental (P0-shaped) | Nothing under `@caisson-sh/*` exists on real npm yet, so any cross-package install / `bunx @caisson-sh/cli` from npm fails — publish is deliberately gated                                                                               | Not a code bug: validates the ADR-0318 R2 "everything rides" design — the W4 train's npm leg publishes the mirror at first release. Clone-path (`bun install` in the mirror) fully works today |
| X1        | P2 (deferred)             | No `"files"` allowlist in package.json across the open set — `bun pm pack` would include test files/fixtures in published tarballs                                                                                                       | **Open follow-up**, named below; does not gate W2                                                                                                                                              |

**Final re-validation (v4, task `ba3c49mu7`):** export at `6656c3be` → Docker clean-room
`bun install && bun run build && bun run test` → `BUILD_OK`, `TEST_EXIT=0`, internal-ref grep
`0`. Exporter's own unit suite: 16/16.

## Docs/prose audit — all P0/P1 fixed in-branch

A multi-agent panel read every exported README/AGENTS/prose file against the built reality.
~20 findings, the material ones: stale four-editions vocabulary (→ six-bundle), a **credits
row still listed as open** in my first README rewrite (P0 — credits went commercial,
ADR-0259; row deleted), `expandEntitlements` examples using dissolved edition ids (→
`["everything"]`), mcp-server README describing a stub, billing/migrate/ai-config docs drift,
ADR-citation parentheticals leaking decision-record paths into public prose (stripped —
exporter now also strips them mechanically), `local-ai` → `local-first` renames. Landed as
`6656c3be` (17 files) + the README/CONTRIBUTING rewrite (`7e8eed4f`). LICENSE files restamped
**Caisson Software LLC** across all 18 open packages + the sample template (operator lock,
this session).

## Commercial-track findings (LIVE registry — outside this kickoff's tree)

Full report in the session transcript; core claims **independently re-verified** with
anonymous probes before recording:

1. **P0 — advertised versions have no tarballs.** `dist-tags.latest` for `@caisson/kernel` is
   `0.4.2`; `kernel-0.4.2.tgz` 404s (0.4.0/0.4.1 exist). `tenancy-rls`, `ui`, `auth` 404 at
   every probed version. Root cause: republish waves (ledger/index rebuilds, the PR #131
   version cut) advanced metadata while the tarball pack+R2-upload leg stayed behind the
   `CAISSON_PUBLISH_DRY_RUN` gate — only the single 2026-07-04 live consume ever uploaded
   tarballs. **0/33 catalog installs succeeded in the licensed clean-room.**
2. **P0 — stale exact transitive pins.** Published module manifests pin exact member versions
   (e.g. `@caisson/kernel: 0.3.0`) that no longer resolve — proven by the `compliance@0.3.0`
   control (own tarball present, all 7 transitive deps unresolvable).
3. **P1 — rate-limit semantics.** ~30–90 requests tripped a sustained all-requests `403`
   (not `429`/`Retry-After`) for ~1 min; a normal `bun add`'s concurrent tarball fetches can
   trip it alone.
4. **P2 — `--edition` doesn't auto-expand** to the bundle's module list and `--help` doesn't
   say so.
5. **Working correctly:** the auth boundary (commercial metadata 401s tokenless; base serves
   anonymous), the `.npmrc` contract, the generator's file materialization (generated
   `.npmrc` byte-identical to the docs), and the entitlement filtering (16 modules anonymous
   vs 46 with the everything token — proven with the standing test license).

**Disposition:** structural fix = the W4 release train's registry leg (a live
`publish.yml` run packs+uploads on every release) **plus a one-time backfill/repair of
already-advertised versions** — that repair is an operator-gated act (live R2 writes +
registry commit) and is surfaced in the session picker, alongside Linear filings.

## Standing test license (operator lock, 2026-07-10 picker)

Minted against prod and **kept — no teardown** — as the permanent testing credential:

- **licenseId:** `39604d2d-7461-4a4c-9e4a-34b32e7c6b5f` · **bundle:** `everything` ·
  **expiry:** none (perpetual, major 0) · **account:** `00000000-0000-4000-8000-00000000c0de`
  (synthetic proof account, sim-webhook grant)
- Token value lives only in the operator's env/secret store — never in git, never printed.
- Proof at mint: registry index filtering 16 (anonymous) vs 46 (entitled) modules.

## Riders + named follow-ups

- **OA rider (before W3):** an IP-assignment / entity sweep must accompany the Caisson
  Software LLC restamp before the public flip (LICENSE headers changed this session; the
  entity's chain-of-title paperwork is an operator act).
- **X1:** add `"files"` allowlists across the open set before the first npm publish rides.
- **Commercial-prose tail:** 202 ADR citations across 55 commercial-package files remain
  in-repo (not exported — mirror unaffected); clean up opportunistically.
- **Registry P0s/P1/P2 above** → Linear (this session).
- Retrieval follow-ups CAISSON-83 (fusion ranking) / CAISSON-84 (docs coverage) — from the
  battery verdict note, `outputs/audit/retrieval-battery-v2-2026-07-10.md`.

## Gate call

**W2 unblocked** (mirror-side zero open P0/P1; the one-time force-push to
`caisson-sh/caisson-oss` awaits the operator picker). **W3/announce remains gated** on the
registry P0 repair + the OA rider.
