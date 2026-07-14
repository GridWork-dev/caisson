# VERIFY — Agent-ready design-system surface for `@caisson/ui`

- **Date:** 2026-07-13 · **Act:** 4 (VERIFY) · **Verdict: PASS (v1 scope), with 3 items SEQUENCED behind the `packages/ui` freeze (not failed)**
- **SPEC:** `outputs/specs/agent-ready-ds-surface/SPEC.md` (LOCKED, amended 2026-07-13)
- **Locks:** ADR-0330 (forks A–E + re-cut v1) · ADR-0345 (Fork F = option (a), open CLI thin client)
- **Branch:** `feature/exec-ds-surface` · diff base `feature/kickoff-t-platform` (17 commits `10ff7f22..a3821260`)

## Method

Goal-backward, not task-box checking. Re-read the SPEC Goal + the three-run acceptance test + ADR-0330/0345, then interrogated the committed code and ran the actual suites. The SPEC's own acceptance is an executable test set plus one live-agent marketing run; the executable half is verified in full offline, the live-agent screen build is verified by proxy (the doctor's correct-usage fixture is exactly that screen).

Ground-truth runs (this session, `snip proxy`, fresh `--force` where noted):

- `turbo build lint test` for `@caisson/{ds-manifest,mcp-server,cli}` → **21/21 tasks green**.
- Forced `test`: `@caisson/ds-manifest` **21 pass / 0 fail**, `@caisson/mcp-server` **81 pass / 0 fail**; `@caisson/cli` **198 pass / 0 fail**.
- `standards-gate` → **73 packages · 0 error · 4 warn** (the 4 warns are pre-existing `manifest-pending` on unrelated packages), exit 0.
- `changeset status --since=origin/main` → exit 0; `@caisson/{ds-manifest,cli,mcp-server}` all recognized.

---

## SPEC Goal clauses (goal-backward)

| #   | Goal clause                                                                               | Verdict              | Evidence                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-a | Agent discovers components + reads props/variants/tokens as typed JSON, **no human docs** | **PASS**             | Committed `packages/ds-manifest/src/base-manifest.json` (schema-validated on read, `read.ts`); `listComponents`/`describeComponent`/`getTokens` pure readers (`manifest-tools.ts`); CLI `describe --json` / `describe <name> --json` (`describe.ts`, 6 tests); local stdio discovery MCP over a real MCP Client, no bearer (`discovery-stdio.test.ts`).             |
| G-b | Verify correct usage **mechanically** (`doctor`), no browser                              | **PASS**             | `checkUsage` static core (`doctor.ts`) — imports, version-skew, token-misuse, `data-*` variant validity, aria wiring, contrast (reuses `contrast.ts`, the kit's own gate — not re-implemented). Pure regex over untrusted input: no exec/fs/network/renderer. Guard grep for `axe`/`jsdom`/`render`/`react-dom` in the doctor lib → only prose comments, zero code. |
| G-c | Paid verify + pro metadata stay **entitlement-gated** behind the buyer MCP                | **PASS**             | `check_usage` gated on the dedicated `ds-doctor` slug; `describe_pro_component` gated on `@caisson/ui-pro`, registered only when a pro manifest is supplied (`manifest-tools.ts`). Runtime gate = the ADR-0216 seam, identical to `coach.ts`.                                                                                                                       |
| G-d | `@caisson/ui` gains **zero runtime deps**                                                 | **PASS (trivially)** | The generator (G1) is freeze-deferred; `packages/ui` is untouched in the diff. `@caisson/ds-manifest` runtime deps = `culori` + `zod` only; `@caisson/ui` is a **devDep** edge (tokens passed as args, no cycle).                                                                                                                                                   |

## SPEC three-run acceptance test (the marketing demo)

| Run | Clause                                                                            | Verdict  | Evidence (offline simulation)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Open discovery, no credentials** → build a ≥3-component brand-conformant screen | **PASS** | `discovery-stdio.test.ts`: real MCP Client, no bearer, lists exactly `[describe_component, get_tokens, list_components]`, returns the base roster + tokens. `describe.test.ts`: `describe --json` full + single, deterministic. The ≥3-component screen is the doctor's `CORRECT_SCREEN` (Button + Card + FormField) → **zero findings** (`doctor.test.ts`), the executable proxy for the live agent build.                                                           |
| 2   | **Authed verify** → zero findings on correct, typed findings on broken            | **PASS** | `doctor.test.ts`: correct screen → `[]`; broken screen → `unknown-component` + `token-override` + `raw-color-literal` + `invalid-variant` + `missing-aria-describedby`; `version-skew` from a mismatched `package.json`; `contrast` on a flattened theme (and none on the live dark theme). Wired through the authed tool in `manifest-tools.test.ts` (doctor-slug buyer gets `unknown-component`) and end-to-end through the CLI thin client (`cli/doctor.test.ts`). |
| 3   | **Denied when unentitled** → outright denial, never a partial pro-shaped response | **PASS** | `manifest-tools.test.ts` #2/#3: base + pro tiers denied `check_usage` (invisible `NotFoundError`, not in `listTools`); `describe_pro_component` denied to non-pro, and the denial is asserted to carry **no** pro payload (`not` `aria-sort`); entitled tiers resolve. CLI thin client rethrows the invisible-404 as a clear `/not_found/` error, never a silent empty result (`cli/doctor.test.ts`).                                                                 |

## Three mandatory entitlement-boundary tests (SPEC §Entitlement boundary — non-negotiable)

| #   | Requirement                                                                               | Verdict  | Location                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Discovery server's set is a **strict subset** of base; can never resolve a pro component  | **PASS** | `discovery-stdio.test.ts` — every resolvable name ∈ base set; a pro name → `isError`/`not_found`; **guard**: a pro component injected into a _separate_ manifest is still unknown to the base-pinned server (proves "resolves only its own manifest", not "anything not pro"). |
| 2   | Unentitled caller on pro metadata denied outright, no silent downgrade / partial response | **PASS** | `manifest-tools.test.ts` — `describe_pro_component` invisible to non-pro + rejection carries no pro payload.                                                                                                                                                                   |
| 3   | Cross-tenant/cross-tier `check_usage` denial matching the existing gate pattern           | **PASS** | `manifest-tools.test.ts` — base and pro (wrong-slug) tiers both denied `check_usage`; only the `ds-doctor` slug resolves.                                                                                                                                                      |

## Fork compliance

- **Fork D (ADR-0330):** discovery free (committed manifest + stdio server, no auth), `check_usage` gated. **HONORED.**
- **Fork F (ADR-0345, option a):** `describe --json` + `doctor` both in the Apache-2.0 `@caisson/cli` as a **second `caisson` bin** (`caisson.ts`); `doctor` is a **thin client** calling the buyer-MCP `check_usage` over **local stdio** (`doctor.ts`, `StdioClientTransport`); doctor logic = Apache source in `ds-manifest`/`mcp-server`, gated by the **dedicated `ds-doctor` slug** (`DEFAULT_DOCTOR_ENTITLEMENT`, overridable). The open CLI carries **no** gated logic. **HONORED as locked.**
- **CR-09 (no hosted unauthenticated HTTP MCP):** the only unauthenticated tier is the local stdio server; guard grep for `.listen(`/`createServer(`/`.bind(` across the new files → **NONE**. **HONORED.**

## Engineering + open-core floor

- **Open-core:** `@caisson/ds-manifest` is Apache-2.0 (`package.json` + Apache `LICENSE`), added to `standards-gate` `OPEN_BASE_NAMES` and `.dependency-cruiser.cjs` `BASE_PKGS`. Standards-gate 0-error confirms the license split + no-depend-up boundary. **PASS.**
- **TS strict / Zod `.strict()` / no `any` / no `console.log` in product src:** schema + doctor input are `.strict()` with bounded strings (`doctor.ts` file ≤512 path / ≤200k contents, ≤500 files); `console.log` grep in product src → NONE (bins print, allowed). **PASS.**
- **Changesets:** `.changeset/exec-ds-{manifest-package,cli-describe,mcp-tools}.md` — all present, all `exec-ds-` prefixed. **PASS.**

---

## Sequenced behind the `packages/ui` freeze (NOT failures)

These were correctly deferred per the PLAN FREEZE-SEQ marking + the EXECUTE binding (frozen `packages/ui`, `apps/site`). Each has a landing sequence; none blocks v1 shippability.

1. **G1 — real manifest generator (`packages/ui/scripts/gen-manifest.ts`) + the true 38-component base/pro manifests + drift guard (T1.1–T1.3).** `packages/ui` is FROZEN (Kickoff S). The committed `base-manifest.json` is the **hand-authored 4-component fixture** (Button, Card, FormField, Terminal — deliberately including one no-`data-*` component per P7). All consumers derive counts from the manifest at runtime (`BASE_MANIFEST.components.length`, never a hardcoded 38), so the whole surface stays green when the generator replaces the fixture with the real 38. **Sequence:** land G1 when Kickoff S lifts the freeze → regenerate → re-verify G2–G5 against real JSON.
2. **T1.4 — single-source the contrast gate** (refactor `packages/ui/src/tokens-contrast.test.ts` to consume `ds-manifest` `checkContrast`). FREEZE-SEQ, low priority; `contrast.ts` already IS the single implementation the doctor uses, so this is a cleanup, not a correctness gap.
3. **T6.1 / T6.2 — services/docs discovery pointer + apps/site copy.** T6.2 (`apps/site`) is FROZEN. T6.1 (`services/docs`) is not frozen but is gated on the real surface (G1) + the external shadcn-namespace task (P12) per the PLAN dependency graph; sequenced after G1 lands.

## SWEEP / EVAL / SHIP notes (for the acts after this one)

- `ai` tag → EVAL fires. `security` tag → SECURITY audit fires at SHIP; focus is the untrusted-buyer-source input surface (`check_usage`) — already `.strict()` + bounded + pure (no exec/fs/network), and the entitlement gate. No new secret compare, no new network sink, no new listener.
- G4 and G5 both touch `packages/mcp-server` but shipped in one worktree/PR here (not two parallel writers), so the ADR-0328 reconcile risk from the PLAN did not materialize.

## Verdict

**PASS for the v1 scope the SPEC/ADRs authorize.** All four Goal clauses, all three acceptance runs, and all three mandatory entitlement-boundary tests are satisfied by committed, green tests, and both governing forks (D locked, F per ADR-0345) are honored. The three deferred items are sequenced behind the `packages/ui` freeze exactly as the PLAN marked them — sequenced, not failed. No goal-backward gap.
