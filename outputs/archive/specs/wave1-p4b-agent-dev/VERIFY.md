# VERIFY — Wave 1 / P4b: Agentic-Dev edition (goal-backward)

Act 4. Re-asks the SPEC's stated goal against the merged diff + tests — not a task checklist.
Closes the documented VERIFY-debt: P4b merged green via PR#11 carrying only SPEC + PLAN.

## Goal restated

Ship Agentic-Dev as a governed, **engine-neutral** TS kernel + a thin multi-harness emitter: author
once in one typed Caisson schema → (1) run a deterministic, policy-guarded lifecycle whose every
governed step is a **tamper-evident** record (reusing `kernel/audit-chain.ts` + `versioning.ts`), (2)
retrieve from a **local hybrid memory** (vec0 + FTS5 + RRF) that works **fully offline**, (3) **emit
per-harness bundles** (`.claude/` + Codex `AGENTS.md` + Cursor) from that one schema. Binding
constraint: the kernel **governs/validates/records — it does NOT run the LLM and is NOT coupled to any
harness; Claude Code is one emit target, never the substrate** (ADR-0066). Plus: extract two reusable
primitives (agent-kernel, local-store) to **base**, consumed **down-only** (ADR-0065/0067).

## Did the code achieve the goal? — PARTIAL (core goal met; live transports stubbed by design)

| Goal claim                                                                       | Evidence (read)                                                                                                                                 | Verdict |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| One typed engine-neutral schema (agent/skill/rule) via `.strict()` + builders    | `agent-kernel/src/schema.ts:24-71` (discriminated union, `parseArtifact`); `validate.ts:53-65` (`define*()`)                                    | ✅      |
| Reference-integrity (ghost-ref) rejects a dangling cross-ref, never guesses      | `validate.ts:28-44` (allowlist Set → first ghost THROWS); golden `__golden__/validate.json`                                                     | ✅      |
| Deterministic policy-guarded lifecycle FSM; illegal edge throws                  | `lifecycle.ts:24-83` (adjacency, `transition` throws); golden `lifecycle-trace.json`; unified `HookResult` `governance.ts:19-115` (fail-closed) | ✅      |
| Hooks dispatcher: fail-open isolation, no-secret-log, pluggable sink, safe shell | `hooks.ts:91-160` (per-handler isolation, secret-free `#report`), `:184-222` (`commandHandler` execFile argv); `hooks.test.ts` (8 threat tests) | ✅      |
| Each governed step recorded as a **tamper-evident** record (reuses ADR-0006)     | `audit-lifecycle.ts:149-194` (reuses `chainEntry`/`anchorChain`/`verifyChain` + `validateVersionSet`); fail-closed on `deny` `:117`             | ✅      |
| A tampered / truncated / rewritten step fails `verifyChain` against the anchor   | `audit-lifecycle.test.ts:125-210` (interior, tail-truncation vs WORM anchor, wholesale rewrite); `apps/agent-dev/test/exit.test.ts:63-87`       | ✅      |
| Hybrid memory: vec0 + FTS5 + RRF (RRF_K=60), degrade to FTS5-only                | `local-store/src/store.ts:132-153` (RRF fold), `:173`/`:194` (vec leg skip/catch → FTS floor); golden `rrf-ranking.json`; `store.test.ts`       | ✅      |
| Returns results **fully offline** (no embedder) AND via RRF when embedded        | `embedder.ts:48-56` (`embedOrSkip` ⇒ FTS floor); `exit.test.ts:89-103` (`fts-only` + `rrf` both non-empty)                                      | ✅      |
| Cloud-embed path scrubs credential content; **no live cloud call in CI**         | `egress-guard.ts:61-69` (`scrubForEgress`), `:139-175` (`createCloudEmbedder`, injectable `fetchWithTimeout`); `egress-guard.test.ts` (doubled) | ✅      |
| Dedup-on-write + TTL/GC decay default, pure + deterministic                      | `gc.ts:127-253` (`decideWrite` reinforce, `planGc` expired/decayed/overflow); `gc.test.ts`                                                      | ✅      |
| Multi-harness emit from ONE schema; Claude Code one target, not the substrate    | `agent-dev/src/emitter.ts:213-283` (`.claude/` + `AGENTS.md` + `.cursor/` from the same `Artifact[]`); golden `__golden__/emit/` tree           | ✅      |
| Path-safe write (reject `..`/abs/null, root-prefix assert); no secret emitted    | `emitter.ts:333-409` (`assertSafeRelativePath` + `startsWith(root+sep)`), `:319-331` (`detectSecret`, fail-closed); `exit.test.ts:134-155`      | ✅      |
| CLI reference app drives one lifecycle act end-to-end, offline (ADR-0044 exc.)   | `apps/agent-dev/src/demo.ts:85-168` (governed FSM → audited record → memory → emit); `README.md:22-29` (CLI exception); `exit.test.ts`          | ✅      |
| Two primitives extracted to **base**, consumed **down-only** (no base→edition)   | `manifest.ts` (agent-kernel/local-store `kind:base`, dep `@caisson/kernel`); `.dependency-cruiser.cjs:23` (`BASE_PKGS`), `:50-55` (down-only)   | ✅      |
| All goldens matched **BLESS unset**; each new pkg has manifest + golden + AGENTS | `golden.test.ts` (×3 pkgs, byte-equality; `agent-dev/golden.test.ts` drives live `renderHarnessBundles`); manifests/AGENTS.md present           | ✅      |

## Acknowledged seams (by-design — NOT failures)

- **Live cloud-embed transport** — `createCloudEmbedder`'s real `fetchWithTimeout` POST is the ONE
  un-exercised path (CI injects a double; `egress-guard.ts:122` seam). Scrub-before-egress + the
  https/dim gates ARE exercised; the live socket is not. Analogous to Wave-0's unwired live-KMS seam.
- **Real shell-hook spawn** — `defaultRunner` (`hooks.ts:184-202`, `execFile` argv) is never invoked
  in CI; `hooks.test.ts` injects a `CommandRunner` double. The argv-array no-injection contract is
  proven structurally; the actual `execFile` exit-code path is un-exercised.
- **Embedder is a seam, not a model** — no bundled local embedding model; the FTS5 floor is the always-on
  default (`embedder.ts:21-26`). Inference is the consuming edition's to wire.
- **agent-dev is a labeled-roadmap edition** (ADR-0082 §4) — typed schema + governed lifecycle + offline
  memory + multi-harness emitter are present and exercised; the edition is roadmap-labeled, not GA.
- **macOS** needs Homebrew sqlite for vec0 (`store.ts:26-39` `setCustomSQLite`); **multi-tenant RLS on
  memory** is documented-not-wired (`schema.ts:17-23`; file-per-tenant floor `tenant-db.ts`, ADR-0073).

## Gaps / follow-ups (non-blocking)

- No goal-relative GAP: every acceptance criterion has a passing test. The only un-exercised surfaces
  are the **live transports above**, which the SPEC exit-gate itself scopes to test-doubled (no live CI call).
- Registry publish / topological backfill deliberately out of scope — manifests + goldens + depcruise rows only.

## Verdict: PARTIAL — the binding goal (engine-neutral governed kernel + offline memory + multi-harness emit) is fully achieved and exercised end-to-end; PARTIAL (not PASS) because the live cloud-embed + real shell-spawn transports are stubbed-by-design and the edition is roadmap-labeled. Proceed to SWEEP. No re-PLAN needed.
