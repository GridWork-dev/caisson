# ADR-0224 — live-verification harness: six seam-proof fork locks

**Status:** accepted · 2026-07-02 (deferred-respec picker round, operator-locked).
**Relates:** SPEC `outputs/specs/deferred-respec/SPEC-live-harness-production-seams.md` (the locked
draft — the harness is test files + `test:live` scripts only, no product code) · **extends
ADR-0201** (the `live/` + `skipIf`-on-env convention this applies from packages to service-level
seams) · relates ADR-0223 (the same-day distribution/registry round; both close a 2026-07-02
launch-readiness fork) · ADR-0108/0116/0200 (Paddle MoR verify + sole buyer webhook mount) ·
ADR-0203 (Discord role-grant push) · ADR-0206 (Linear Triage sink) · ADR-0207 (Grafana Cloud
`/ops` query) · ADR-0118 (PostHog + Plausible analytics).

## Context

The 2026-07-02 credential-readiness sweep found five external seams wired to production and
exercised only by unit doubles or dormant env-gates — the Paddle checkout→webhook→grant money
path, the Discord role-grant, the Linear Triage sink, the Grafana Cloud query surface, and the
`NEXT_PUBLIC_*` analytics inlining. None has an automated proof against its real remote, so a
pre-launch key rotation (wrong scope, stale webhook secret, an un-mirrored regenerated token) is a
silent break that passes every double-backed unit test and fails only in production on a real
purchase. The SPEC designs the missing layer — one self-skipping `live/` proof per seam that, run
after every rotation, goes green when the launch creds are wired correctly and names the one seam
that broke otherwise. Six operator forks gated the build; all six are locked here.

## Decision (six forks, operator-locked)

- **F1 = C (BOTH — operator override of the simulator-only recommendation):** the Paddle
  simulator API (`POST /simulations` + `/simulations/{id}/runs`) is the routine, re-runnable,
  headless webhook→grant proof; a rarely-run Playwright sandbox-checkout leg drives the real
  Paddle.js overlay with a sandbox test card for a full-fidelity check incl. a genuine
  checkout-produced signature. The A1 signature probe (Task 1) still runs first to record whether
  the simulator's delivery is signed under `verifyPaddleWebhook`.
- **F2 = A (deployed Railway fleet):** seams 1–2 prove against the live
  `license.caisson.sh/webhook` + the deployed bot's `/billing-grant`, using a **reserved proof
  tenant** with a **per-run UUID** segment (the WORM proof's `PROOF_ACCOUNT_ID` + `randomUUID()`
  pattern) and an explicit **teardown leg** per seam so no real customer row or lingering state
  survives. Seams 3–4 stay read-only (Linear archive-after, Grafana pure read).
- **F3 = B (FULL Discord grant + teardown — operator override of the 404-only recommendation):**
  the proof POSTs a real `/billing-grant`, asserts the role landed, then removes it. Fixtures: the
  operator's **main Discord account (the guild owner)** is the standing test member, and a
  throwaway role **`caisson-proof`** (id `1522364538790350980`, created 2026-07-02 via the bot,
  which holds Administrator) is the grant target. This exercises the final `member.add_roles` +
  bot role-hierarchy path that the 404-only leg (F3-A) leaves unit-covered.
- **F4 = A (build-grep):** the analytics proof `next build`s `apps/site` with the `NEXT_PUBLIC_*`
  envs set and greps the built client bundle for the inlined key/domain + the posthog/plausible
  init — the cheap headless proof that a rotated analytics key reaches the bundle. Provider-side
  ingestion stays dashboard-verified (only PostHog/Plausible can confirm receipt).
- **F5 = A first (local command):** `bun run test:live:all` (fanning out every package/service
  `test:live`) + the support-bot pytest live marker is the post-rotation runbook command. A
  `workflow_dispatch`-only CI job (F5-B) is a **later, separately-audited** step — it puts the full
  launch credential set on a runner (a `secrets`/`external-system` change), so it is not part of
  this lock.
- **F6 = A (`~/.gridwork/caisson.env` is the launch credential SOT):** the harness reads its creds
  from — and asserts env-parity against — `~/.gridwork/caisson.env` (the Railway-var mirror,
  source-chained from `~/.gridwork/env`), matching the standing no-1Password practice. A 1Password
  vault, **if** stood up, is a durable **recovery store** the env files stay in parity with, not
  the runtime SOT and not what the harness reads. This narrows the 2026-07-02 launch-vault intent
  (global memory `caisson-1password-launch-vault.md`) and keeps `no-1password-env-creds.md` from
  going stale.

Zero product code changes: the harness adds `live/` / `tests/live/` proofs + `package.json`
scripts + a `docs/state/live-harness.md` runbook only. Every leg self-skips without creds; the
default suites (`bun test ./src`, `pytest tests`) and every push/PR job are unchanged; a live run
is a deliberate act.

## Rejected

- **F1-A simulator-only** — the SPEC recommendation; drops the overlay + a real-signature path
  from the automated suite. The operator wanted both.
- **F1-B Playwright-only** — flaky third-party iframe + test-card entry as the _routine_ proof.
- **F2-B locally-booted + tunnel** — proves the code + creds but not the DEPLOYED wiring/DNS,
  which is the whole point of a post-rotation proof; adds a cloudflared/ngrok dependency.
- **F3-A 404-only** — proves auth + guild resolution without a fixture but never exercises
  `add_roles`; the operator wanted the grant itself covered.
- **F4-B network-fire** — pulls a headless browser into a marketing-analytics seam and still
  can't prove ingestion; **F4-C dashboard-only** — zero regression signal on the inlining.
- **F5-B as the lock** — durable run history, but injects the launch credential set into a CI
  runner unaudited; deferred to a separate `secrets` change.
- **F6-B 1Password-as-SOT** — stands up a tooling class the operator has rejected everywhere else
  and would have made `no-1password-env-creds.md` stale; kept as an optional recovery store only.
