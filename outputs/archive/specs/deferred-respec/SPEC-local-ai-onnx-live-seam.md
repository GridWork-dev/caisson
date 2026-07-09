# SPEC — `@caisson/local-ai` ONNX on-device inference live seam (availability-gate resolution)

**Status: DRAFT — operator lock required (no ADR filed). Does NOT authorize building.**
Three operator gates are open below and must be locked before any task runs: **G1**
(throwaway-install carve-out from ADR-0201's Rejected clause), **F1** (disposition after
the proof), **F2** (shared-guard unification). This SPEC deliberately keeps the pre-lock
proposal shape of the locked harvest-slice2 SPECs (Goal → Scope → Design → Tasks → Verify
→ Effort/Value), adding an **Open gates** subsection under Design for the un-locked forks.

- **Package:** `packages/local-ai` (commercial edition, `LicenseRef-Caisson-Commercial`, Local-first AI).
- **Type:** VERIFICATION + DISPOSITION — **no product code.** Proves the already-shipped
  ONNX backend live end-to-end, then flips the state docs (or records a blocker). Resolves
  ADR-0201 §3's `availability-gated ONNX` bet.
- **Relates:** ADR-0064 (InferenceBackend port + ONNX design, "T13"); ADR-0184
  (transports-deferred / non-literal dynamic-import posture); **ADR-0201** (live-transports
  go-live — the governing availability bet, §3). The `skipIf` availability-probe precedent
  is **code**, not an ADR: `packages/compliance/src/evidence/oscal-export-xml.test.ts` (see
  Design — ADR-0201 miscites ADR-0180 for this).
- **Tags:** `ai`, `security`, `external-system`.

## Goal (WHAT + WHY)

The on-device ONNX embedding backend is **fully written and its live proof already ships** —
`packages/local-ai/src/inference/onnx-backend.ts` (the guarded, SHA-pinned
`OnnxEmbeddingBackend`) plus `packages/local-ai/live/onnx.live.test.ts` (the three-leg
tamper/real/egress-block suite). ADR-0201 §3 deferred exactly one thing: **actually running
that proof.** It chose "availability-gated proof; the dep stays out of the tree" —
`@huggingface/transformers` (~270 MB native onnxruntime) stays an uninstalled optional peer,
CI never runs the path, and the open question was left as a bet: _is `bun` + `onnxruntime`
viable enough that the operator can flip `CAISSON_ONNX_LIVE`, install the peer, and get a
green real proof?_

The deliverable is **not new code** — it is closing that bet: an operator-run, NOT-in-CI
verification pass that proves the repo's own backend on the operator's real run-machine,
then the honest disposition (flip the state docs to "proven live," or — if the
machine-specific proof fails — record the blocker with evidence and re-affirm the gate).
This is the tail that closes ADR-0201's editions-go-live wave: S3 WORM and OpenRouter rented
were proven and flip-updated; ONNX was the one lane left availability-gated. The credible
risk that made the bet risky — `bun test` crashing while loading `onnxruntime-node`
(oven-sh/bun#30431: segfault on Linux x86-64 + a macOS-shutdown C++ exception on Bun 1.3.13) —
**shipped its fix in Bun 1.3.14** per the maintainer's own comment on that thread, and this
box already runs 1.3.14. An isolated scratchpad probe this session (repo untouched)
reproduced the live test's exact mechanics with zero crashes (evidence in Design), converting
the open bet into an evidence-backed "viable" — so the expected outcome is a green flip. The
SPEC still specifies the failing-machine fallback because viability was proven on ONE
architecture (linux x86_64) only.

## Scope

**In:**

- The operator-run three-leg `test:live` proof against the repo's own `onnx-backend.ts`
  (tamper fail-closed · real unit-norm 384-dim embed · egress-block).
- Re-asserting the CI-never posture (no workflow, no `CAISSON_ONNX_LIVE` in `.github/`).
- The honest disposition: on green, flip `docs/build-state.md` + `docs/state/readiness-and-backlog.md`
  to "proven live"; on a machine-specific fail, record the blocker with evidence and hold
  ADR-0201's gate.

**Out:**

- **Re-authoring the live test or the backend.** Both exist, ship, and match the requested
  shape (peer-probe self-gate, one-time pinned download, unit-norm 384-dim embed,
  privacy-guard-blocks-egress leg) almost verbatim. No `onnx-backend.ts` /
  `onnx.live.test.ts` logic change — _unless F2 locks to B._
- **Committing `@huggingface/transformers` as a dependency.** Any install here is a
  session-local throwaway, discarded before commit (see gate **G1** — this is NOT
  self-evidently compliant with ADR-0201). The peer MUST stay absent from
  `packages/local-ai/package.json` after the session.
- **Adding the ONNX path to CI.** Structurally enforced today (`test:live` is invoked by zero
  GitHub workflows); this SPEC keeps it that way.
- **Swapping the model.** `DEFAULT_ONNX_MODEL` = `Xenova/all-MiniLM-L6-v2` @ revision `main`
  (dim 384) — confirmed live + stable on HF, full `onnx/` variant set already in the test's
  candidate list. No model change.
- **A completion/generation (small-LM) backend.** The port carries a `CompletionRequest`
  shape but the live seam is embedding-only; a generative on-device backend is a separate,
  unspecced item.

## Design

The item is a **verification + disposition**, not a build. `// ponytail: the code is done —
this is a proof + a doc flip.`

### Current state (cited)

- **`packages/local-ai/src/inference/onnx-backend.ts`** (298 lines) — `OnnxEmbeddingBackend`
  against `@huggingface/transformers` v4 (transformers.js wraps `onnxruntime-node`; the
  backend does not touch bare onnxruntime). The runtime is loaded by a **dynamic import with a
  non-literal specifier** (`TRANSFORMERS_MODULE`) so tsc never resolves it and the package
  stays an uninstalled optional peer (header comment lines 8–10). Two threat controls:
  **TM-EGRESS** — a `#guardedFetch` chokepoint overwrites transformers.js's `env.fetch`,
  hard-blocking any host but the single sanctioned `modelHost`, rejecting non-https,
  fail-closed-to-offline (lines 12–18); **TM-MODEL** — every pinned file is SHA-256-verified
  (`safeEqualFixed`, constant-time) before it reaches the runtime, fail-closed on mismatch
  (lines 19–22). `offline: true` forces `allowRemoteModels=false` + `local_files_only` for
  air-gapped buyers. Exported from `packages/local-ai/src/index.ts:79-81`
  (`OnnxEmbeddingBackend`, `DEFAULT_ONNX_MODEL`, `type OnnxBackendConfig`).
- **`packages/local-ai/live/onnx.live.test.ts`** (177 lines) — the already-shipped three-leg
  suite. Self-gates on `transformersAvailable` (probed via the same non-literal dynamic
  import, line 35) **AND** `process.env.CAISSON_ONNX_LIVE` (line 39); every leg is
  `test.skipIf(!LIVE)`. Legs: **(a) TAMPER** — all `ONNX_CANDIDATES` wrong-pinned, asserts
  fail-closed + harvests the runtime-discovered filename into `discoveredFile`; **(b) REAL** —
  self-pins the discovered file via plain `fetchWithTimeout`, runs the guarded+pinned pipeline
  to a unit-norm `Float32Array(384)` (`expect(vec.length).toBe(EMBEDDING_DIM)`, line 142);
  **(c) EGRESS BLOCK** — a backend sanctioned only for `example.com` must reject the
  huggingface.co fetch (`ie.details?.allowed === "example.com"`, line 173).
  `DOWNLOAD_TIMEOUT_MS = 300_000` (line 60).
- **`packages/local-ai/package.json`** — `test: "bun test ./src"`, `test:live: "bun test
./live"`. `@huggingface/transformers` is **absent from `devDependencies`** — the
  peer-out-of-tree posture, confirmed present.
- **CI posture — enforced by construction.** `grep -rn "test:live\|CAISSON_ONNX_LIVE"
.github/` returns **zero hits**; no workflow runs the ONNX path. "Never in CI" is
  structural, not just documented.
- **`knowledge/decisions/ADR-0201-live-transports-go-live.md`** (accepted 2026-07-01) — §3
  (lines 49–53): "On-device ONNX — availability-gated proof; the dep stays out of the tree";
  pin guidance **≥ 4.2.0** (the `env.fetch` injection point merged 2026-02-21; official Bun
  support; ~270 MB native deps are why it stays out). **Rejected (lines 72–73):** "Installing
  `@huggingface/transformers` as a dev dependency — ~270 MB of native onnxruntime/sharp weight
  on every `bun install` for a path CI must never execute anyway." **This clause draws no
  temporary-vs-permanent distinction** — it is the reason gate **G1** exists.
- **`docs/state/readiness-and-backlog.md:167`** — the live deferred row: "`local-ai` ONNX
  on-device | install `onnxruntime` peer + one-time HF model download + SHA pins | ADR-0064",
  under the **needs-external (DEPLOY-class)** table. This is the row the disposition flips.
- **`docs/build-state.md:256-261`** — the per-transport live-truth block S3 WORM / OpenRouter
  were flip-updated in per ADR-0201's consequences (line 81); the ONNX line lands its "proven
  live" flip here.
- **Shared-guard gap (pre-existing, not a blocker):**
  `packages/local-ai/src/privacy/policy.ts:30` declares `SANCTIONED_SINK_KINDS =
["model-fetch", "rented-backend"]`, with `model-fetch` reserved for the ONNX backend (T13,
  doc comment lines 25–26). But the ONNX backend enforces its **own inline** `#guardedFetch`
  rather than routing through the shared `packages/local-ai/src/privacy/egress-guard.ts`
  `EgressGuard`; only the **rented** lane is proven through the shared guard
  (`packages/local-ai/live/rented.live.test.ts`'s `liveGuard()`). `onnx-backend.ts:18` itself
  flags this: "(T14's privacy/egress guard later wraps this same chokepoint with the full
  allowlist policy.)" — intended-but-not-yet-done. This is **F2**.

### skipIf precedent — cite the code, not ADR-0180

ADR-0201 (line 59) attributes the live-test self-gate to "the repo's availability-probe
precedent (oscal-cli `skipIf`, ADR-0180)." **That citation is imprecise and this SPEC does
not inherit it.** ADR-0180 ("OSCAL output format: JSON primary + oscal-cli XML converter") is
entirely about the JSON/XML dual-output decision (NIST XSLT converter, round-trip CI gate)
and contains **no** mention of `skipIf`, availability probing, or test-gating. The actual
`skipIf`-on-availability precedent lives in **code**:
`packages/compliance/src/evidence/oscal-export-xml.test.ts` (`oscalCliAvailable()` +
`test.skipIf(!HAVE_CLI)`, whose own line-5 comment likewise miscites ADR-0180). ONNX's
`transformersAvailable && CAISSON_ONNX_LIVE` self-gate follows **that code pattern** — a
reused convention, no new precedent invented, and **no ADR-0180 "extends" relationship** (the
two decisions are unrelated).

### Empirical viability evidence (isolated scratchpad, repo read-only)

`bun add @huggingface/transformers` on this box (Bun 1.3.14, linux x86_64) resolved to
**4.2.0** — exactly ADR-0201's ≥ 4.2.0 pin — pulling `onnxruntime-node@1.24.3` with prebuilt
native `.node` bindings + `libonnxruntime.so.1` bundled in the npm tarball for **both**
linux/x64 and linux/arm64 (no separate build step). Postinstall scripts were Bun-blocked by
default (`bun pm untrusted`) until explicitly trusted (`bun pm trust`) — a required
operational step. After trusting: `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2',
{revision:'main'})` loaded in ~1.3s and produced a unit-norm `Float32Array(384)`
(sumSq ≈ 0.99999984) — matches the backend's dim contract and leg (b) exactly. Re-run under
`bun test`: **1 pass, 0 fail, clean exit 0** — directly refutes oven-sh/bun#30431 (fixed in
1.3.14, which this box runs). An `env.fetch` counter confirmed the injection point fires on
**every** fetched file (5 calls: config.json, tokenizer_config.json ×2, tokenizer.json,
onnx/model.onnx) — validating the TM-EGRESS chokepoint intercepts 100 % of egress. Anticipated
discrepancy: transformers.js v4's default fetched file is `onnx/model.onnx` (87 MB), NOT
`model_quantized.onnx` as leg (b)'s fallback comment assumes (`discoveredFile ??
"model_quantized.onnx"`, line 122) — harmless, because leg (a) always runs first and populates
`discoveredFile` from the runtime error, and `model.onnx` is the first entry in
`ONNX_CANDIDATES`. **Two residual risks the probe cannot retire:** (1) _wrapper-vs-library
(medium-low)_ — the probe proved the raw library, not the repo's `onnx-backend.ts` wrapper;
task 1 (the in-repo proof) is what closes it. (2) _architecture coverage (medium)_ — proven on
linux/x86_64 only; ARM64 ships a separately-published native binding in the same tarball but
was not run. If the operator's run-machine is ARM64, task 1 IS that second-machine
verification. _(Belt-and-suspenders low risk: the Bun-fix "ships in 1.3.14" claim is from a
maintainer comment corroborated by the clean `bun test` pass, not a line-verified changelog —
spot-check the 1.3.14 release notes before the real proof.)_

### The proof (the load-bearing act)

Inside `packages/local-ai`, install the peer as a throwaway (`bun add -D
@huggingface/transformers` → 4.2.0; `bun pm trust @huggingface/transformers onnxruntime-node`
to unblock the native postinstall), then `CAISSON_ONNX_LIVE=1 bun run test:live`. All three
legs must pass green against the **repo's own** `onnx-backend.ts` (the scratchpad probe only
proved the raw library, not the wrapper). Then **discard the install** — run the whole session
in a disposable `gw start --wt` worktree so `main`'s tree is never touched, and/or `git
checkout -- package.json bun.lock` + drop `node_modules/@huggingface`. `// ponytail: the
throwaway-install-then-discard IS the design — a permanent devDependency is what ADR-0201
rejected.` **The install itself needs gate G1 — see below.**

### Open gates (operator lock required — tasks are gated on these)

**Gate G1 — throwaway-install carve-out from ADR-0201's Rejected clause (BLOCKING).**
Task 1's `bun add -D @huggingface/transformers` literally performs the action ADR-0201's
Rejected section names ("Installing `@huggingface/transformers` as a dev dependency"). That
clause draws **no** temporary-vs-permanent distinction, so a session-local install — even
inside a disposable worktree, even reverted before commit — is **not self-evidently
compliant**. Running task 1 therefore requires **one of**:

- **G1-A (Recommended)** — the operator's **explicit sign-off** recording that a session-local,
  never-committed throwaway install (dev or not, discarded before any commit) is a permitted
  scope carve-out for this one proof. Cheapest; leaves ADR-0201's text intact. _Tradeoff:_ the
  carve-out lives only in this SPEC's lock note, not in the ADR.
- **G1-B** — a **one-line amending note appended to ADR-0201** (append-only) stating the
  Rejected clause bars a _committed_ dependency, and a session-local throwaway install for the
  gated proof is permitted. _Tradeoff:_ more ceremony; but durable and self-documenting.
- **G1-C** — do NOT install at all (→ **F1 = C**): skip the in-repo proof, rest on the
  scratchpad corroboration. Avoids the carve-out entirely but never exercises the repo's own
  wrapper (leaves the wrapper-vs-library risk open by choice).

_Recommendation: **G1-A**, confidence medium-high — a never-committed install is the narrowest
possible read of "a path CI must never execute," but the operator, not this SPEC, owns that
carve-out._

**Fork F1 — disposition after the operator-run proof.**

- **Option A (Recommended)** — On green, flip `docs/build-state.md` +
  `readiness-and-backlog.md` only; **no new ADR**. ADR-0201 already governs the availability
  bet; a green proof merely realizes its consequences, exactly as S3 WORM / OpenRouter were
  flip-updated in-place. _Tradeoff:_ the proof's environment (Bun 1.3.14, transformers 4.2.0)
  lives only in a state-doc line, not a durable decision record.
- **Option B** — On green, land a new ADR (extends ADR-0201) pinning the proven dep version +
  a Bun-version floor as a permanent availability record. _Tradeoff:_ more ceremony for a bet
  ADR-0201 already owns; justified only if the operator wants the version floor codified. (If
  G1-B is chosen, its amending note can fold into this ADR.)
- **Option C** — Do NOT run the in-repo proof at all; record in `docs/build-state.md` that
  external research (this session) independently corroborated viability without an in-repo
  install. _Tradeoff:_ skips the ~270 MB transient install entirely (satisfies G1-C) but never
  exercises the repo's own wrapper — the wrapper-vs-library risk stays open.

_Recommendation: **A**, confidence medium-high. Evidence: the isolated probe passed cleanly on
this box's exact stack, mirroring the live test's mechanics. Choose B only if a durable
version/Bun-floor record is wanted; C only if the operator refuses the transient install._

**Fork F2 — wire ONNX through the shared `EgressGuard` (the T14 unification).**

- **Option A (Recommended)** — Defer. Leave the inline `#guardedFetch`; file a one-line
  backlog note. The load-bearing security property (egress fails closed to an unsanctioned
  host) is **already proven** by leg (c) at the backend layer; the shared guard is redundant
  defense-in-depth, not a missing control. _Tradeoff:_ ONNX and rented lanes prove egress at
  different layers (backend-inline vs shared `EgressGuard`) — a cosmetic inconsistency.
- **Option B** — Do the unification in-slice: route `onnx-backend.ts`'s chokepoint through
  `packages/local-ai/src/privacy/egress-guard.ts` with the reserved `model-fetch` sink kind,
  so both lanes prove egress at the shared-policy layer (a leg mirroring
  `rented.live.test.ts`'s `liveGuard()`). _Tradeoff:_ touches shipped, security-sensitive
  backend code for a property already proven — earns a full re-audit of a working guard.

_Recommendation: **A**, confidence high. `onnx-backend.ts` already hard-blocks non-sanctioned
hosts via a `safeEqualFixed`-backed host check + SHA pin, and leg (c) proves it; unifying is
cleanliness, not a security gap. Defer unless the operator wants one-guard-per-policy parity._

## Tasks

Tasks are gated on the locks above; sizes are for bounded execution.

1. **[G1 = A/B] Operator-run three-leg proof (NOT-in-CI).** In a disposable worktree or with a
   throwaway install inside `packages/local-ai`. Verify: `bun add -D @huggingface/transformers
&& bun pm trust @huggingface/transformers onnxruntime-node && CAISSON_ONNX_LIVE=1 bun run
test:live` — legs (a) tamper, (b) real (unit-norm `Float32Array(384)`), (c) egress-block all
   pass green against repo code. Effort: S. _(G1 = C → skip; go to F1 = C.)_
2. **Discard the throwaway peer (no dependency committed).** Verify: `git checkout --
package.json bun.lock && grep -c "@huggingface/transformers"
packages/local-ai/package.json` returns `0` (peer stays out of the tree; ADR-0201 honored).
   Effort: XS.
3. **Re-assert CI-never.** Verify: `grep -rn "test:live\|CAISSON_ONNX_LIVE" .github/` returns
   zero hits (no workflow runs the ONNX path). Effort: XS.
4. **[F1 = A/B] Flip the state docs on a green proof.** Update `docs/build-state.md`'s ONNX
   line (block at `:256-261`) to "proven live" and move/annotate the
   `docs/state/readiness-and-backlog.md:167` row out of needs-external. Verify: `grep -n
"ONNX.*proven live\|proven live.*ONNX" docs/build-state.md` returns the flipped line; the
   backlog row no longer sits under needs-external. Effort: S. _(F1 = C instead → record the
   external-corroboration note in `docs/build-state.md`; verify the note is present.)_
5. **[F1 = FAIL path] Document the blocker.** If task 1 fails on the operator's run-machine
   (e.g. an ARM64 divergence the x86_64 probe couldn't see), record the failing evidence
   (arch, Bun version, error) in `docs/build-state.md` and leave ADR-0201's gate as-is.
   Verify: the blocker note cites the exact failing environment; `readiness-and-backlog.md:167`
   row unchanged. Effort: S.
6. **[F2 = A] Backlog note for the shared-guard unification.** One-line entry pointing at the
   `onnx-backend.ts:18` T14 note + `policy.ts:30` `model-fetch` sink. Verify: the note names
   both file:line refs. Effort: XS.
7. **[F2 = B only] Wire ONNX through the shared `EgressGuard`.** Route `#guardedFetch` through
   `egress-guard.ts` with the `model-fetch` sink kind; add a guard leg mirroring
   `rented.live.test.ts`'s `liveGuard()`. Verify: `bun test packages/local-ai/src` green + the
   new egress leg asserts the ONNX host allowlist fails closed at the shared-policy layer.
   Effort: M. _(Only if F2 locks to B; else skip.)_

## Verify (goal-backward)

Re-ask ADR-0201's open question — _is bun+onnxruntime viable, and can the operator get a green
real proof?_ — against the result, not the task list:

- **The bet is answered with evidence.** Either the operator-run `test:live` passed all three
  legs against the repo's own `onnx-backend.ts` (viable — flip the docs), or it failed on the
  run-machine with recorded evidence (blocker documented, gate held). No third "still unknown"
  state survives. _(An x86_64-only green is partial — a green on an ARM64 run-machine is the
  true close.)_
- **The dep never entered the tree.** `grep -c "@huggingface/transformers"
packages/local-ai/package.json` = 0 after the session; the ~270 MB peer ADR-0201 rejected is
  absent. `git status` shows no committed dependency change — and G1's carve-out (or its
  amending note) is on record for the transient install.
- **CI never runs the path.** `grep -rn "test:live\|CAISSON_ONNX_LIVE" .github/` still zero
  hits — the "never in CI" posture is intact.
- **The security property held under real load.** Leg (c) proved the guarded chokepoint
  rejects an unsanctioned host with a real model download in flight; leg (a) proved the SHA
  pin fails closed on a tamper — the two threats `onnx-backend.ts` carries (TM-EGRESS,
  TM-MODEL) are demonstrated, not just asserted.
- **State docs match reality.** On green, `docs/build-state.md` and `readiness-and-backlog.md`
  read "proven live," consistent with how S3 WORM / OpenRouter were flip-updated. On fail, they
  read the honest blocker with its environment.
- **No shipped code regressed.** `onnx-backend.ts` / `onnx.live.test.ts` unchanged (F2 = A) —
  or, if F2 = B, `bun test packages/local-ai/src` green and the added guard leg passes.

## Effort: S (a proof run + a doc flip; no product code — F2 = B adds M). Value: HIGH — closes ADR-0201's last open live lane with real evidence, or documents the blocker honestly; realizes the seam ADR-0064 designed, no supersede.
