# Release audit — v2026.08.06.1 (the clean-main wave: ADR-0396 browser entries, dep wave, scan-baseline repair)

- **Scope:** the cumulative diff since the last shipped release tag, `v2026.07.30..aa6f4f17`
  — 451 files, ~21k insertions across PRs #398–#405: the Aug-2 clean-main wave (billing/credits
  reconcile, prompt-registry), the ADR-0396 Wave B browser entries (kernel browser subset,
  guardrails/local-privacy/local-inference `./browser`, site poke retirement), the four renovate
  groups (#398–#401), the anti-slop css engine (#403), the deterministic-scan baseline repair
  (#404), and the version consume (#405) — plus the repair commits this audit forced, which ride
  the successor tag `v2026.08.06.1`.
- **Context:** the entire wave shipped during a GitHub Actions **major outage**. Under the
  operator's "merge on local green" lock, all five required checks ran locally per PR with the
  exact commands the workflow files define; no check-runs exist on any of these SHAs.
- **Lanes:** the R4 SHIP-audit workflow — `gw-security-auditor` (fable, money/license/crypto
  seams) + `gw-code-reviewer` (opus, correctness and release integrity) over the full cumulative
  diff, independently and in parallel; every finding then adversarially verified by an
  independent opus verifier (default-refute). 9 findings raised → **6 confirmed, 3 refuted.**
  Then a mechanical byte-gate pass that found more than the lanes did (§3).

## 1. Verdict

**PASS for `v2026.08.06.1`, after one P1 repair.** No live exploit, over-grant, money defect, or
secret leak found in the diff. The blocker was release-mechanical — six tarball sidecar rows
recorded over bytes that are not the tag tree's bytes — and is repaired in this PR, with a
51/51 re-pack byte proof. The original tag `v2026.08.06` is a dud: never ridden, no Release
published on it, superseded by `v2026.08.06.1` (tag mutation is operator-only, so it stays).

## 2. What the lanes checked and found clean

| Seam                                        | Result                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credits FIFO carve (Aug-2 wave)             | Single-implementation with NaN-closed guards; `planFifoDebit` reproduces the old waterfall exactly; `assertPositiveInt` still runs before any insert; the `::int` cast keeps the new integer check safe on live rows |
| Billing-orchestration claim-key carve       | Pure move; `:`-aliasing rejection stays in one place (`event-keys.ts`); DB claim server-only                                                                                                                         |
| ai-meter browser entry                      | Exports only pure pricebook/estimator/402-vocabulary; reserve/reconcile/breaker stay behind `TenantExecutor`                                                                                                         |
| Admin internal-proof bearer                 | Legacy bare-hex branch closed — timestamp mandatory, ±300s window, length-checked `timingSafeEqual`; issuer already timestamped-only since v2026.07.30, seam coherent                                                |
| Crypto splits (field-crypto / signing-prim) | Byte-parity-pinned WebCrypto twins; `hexToBytes` stricter than `Buffer` (throws on invalid — closes a forged-short-signature path); `canonicalize` untouched, signature payloads stable                              |
| Browser-entry safety                        | 122 browser-safety/parity/fifo tests pass in this tree; all 18 `./browser` entries walk clean; site poke imports of node-tainted barrels are statement-level type-only                                               |
| Version-consume coherence                   | Every bumped package.json matches its CHANGELOG head, index latest, ledger row, sidecar row — zero mismatches; module id set unchanged; cli template pins match real released versions                               |
| Dep wave                                    | bullmq@6 API matches every call site, ioredis correctly a direct dep now; undici/ip-address overrides resolve to single fixed copies; targeted suites 343 + 682 pass                                                 |
| Scan baseline (#404)                        | All five acceptances dated, scoped to dev/build-only surfaces, claimed fixed-bumps real in the locks; hono absent from the deployed Worker                                                                           |
| Deploy workflow rework                      | `deploy-worker.yml` dispatch-only, ancestry-gated, contents:read, env-var interpolation; `--only` parsing closes the past fail-open class                                                                            |

## 3. The blocker — six stale sidecar rows, and who found what

**The review lane found one:** `@caisson/cli@0.7.9`. The ride-along commit `09ec8e13` (template
pins + golden, forced by the pin tests on every version cut) edited three files that `bun pm pack`
packs into the cli tarball, _after_ the consume commit `17d66efc` recorded the row. Proven with
`bun pm pack --dry-run` and `git archive` at both commits; the delta is shasum-only (~1 byte of
size), invisible to an eyeball check.

**The byte gate found five more.** Re-running `ci-publish-step.ts --mode version` for the repair
tripped the sibling-churn guard on `kernel@0.8.0`, `guardrails@0.4.12`, `local-inference@0.1.9`,
`local-privacy@0.1.9`, and `field-crypto@1.1.0` — the Wave B packages, with recorded sizes ~pre-Wave-B
(guardrails recorded 27,276B vs 31,908B from the tree). Root cause: the version branch was cut from
`04cf1ff4`, _before_ Wave B's #402 merged; the consume then packed pre-Wave-B source for five
packages whose changesets were already pending on main, and the squash landed those bumps on top of
post-Wave-B main. The lane's commit-topology reasoning ("only `09ec8e13` sits after the consume")
could not see cross-branch drift; the mechanical gate could.

**Repair (this PR):** the script's own documented stale-row remedy — all six never-published rows
deleted from `tarballs.json` + `ledger.jsonl` and re-recorded from the true tree
(`local-20260806-repair@aa6f4f17`), index rebuilt. **Proof:** an independent re-pack of all 54
workspace packages against the sidecar — 51/51 catalog rows byte-identical (ai-kit / local-ai /
agent-dev are dissolved-edition packages, absent from the index by design). Safe because none of
the six versions was ever uploaded: the train never rode `v2026.08.06`, R2 and the Worker still
serve the v2026.07.30 catalog.

**The rules this hardens** (both now in the release playbook): a version consume must be cut from
the final post-all-merges main tip, and the local byte-gate proof must run before any tag is cut —
this ride's tag was cut first, which is why the repair needed a successor tag at all.

Worth stating plainly, again (v2026.07.30 §4 said the same): the decisive finding was mechanical.
Review found one stale row of six; the gate found all six in two seconds.

## 4. Confirmed non-blocking findings and their dispositions

- **P2 — local attestation provenance.** 49 ledger rows carry `local-20260806@…` instead of a CI
  `run_id@sha`. This is the outage substitution, disclosed in the release checklist; the branch
  name (`release/version-local-20260806`) says the same thing. Follow-up queued: a
  `ci-publish-step` guard refusing non-numeric run-ids without an explicit local flag.
- **P2 — `nodeGlobalTaint` matches inside string literals and only 6 of 18 browser entries assert
  it.** Test-layer weakness, no shipped-byte impact. Queued as a Linear follow-up: strip
  string/template literals in the walker, then add the assertion to all 18 `browser-safety.test.ts`
  files with the kernel-config allowlist shape credits already uses.
- **P2 — sot frontmatter stale on the release commits** (`package-catalog`, `architecture`,
  `compatibility-matrix` vs their own grounds). Fixed in this PR — all three restamped 2026-08-06;
  `bun run sot` green here.
- **P3 — the four new osv-scanner acceptances had no expiry** while their trivy mirror
  self-revokes. Fixed in this PR: `ignoreUntil = 2026-08-12` on all four (the day after the
  2026-08-11 dep wave each reason commits to, matching the trivy `expired_at`).
- **P3 — stale uv pin comment** in `services/support-bot/Dockerfile` (named 0.11.18 above the
  0.12.2 pin). Fixed in this PR — the comment now names the invariant, not a version.

## 5. Refuted findings (adversarial verify, default-refute)

- **apps/site tsconfig `.next` subdirectory enumeration is fail-open** — mechanism false: the
  wildcard include does not pull unknown `.next` output the way the finding claimed.
- **Lob detector exclusion is permanent with no re-review trigger** — facts confirmed (the
  exclusion is real and undated) but the defect does not hold; the playbook's dated acceptance
  row covers the revisit convention.
- **Worker parity leg blind to commercial-only releases** — the disclosed limitation is real in
  general but false for this gate's purpose: the anonymously-served base entries transitively
  fingerprint the whole baked bundle, so a stale commercial catalog cannot ride a green worker leg.

## 6. Not covered

- `apps/site` visual/UI regression — no browser lane ran this ride.
- CI check-runs on any SHA in the wave — GitHub Actions was in a major outage the entire window;
  the substitution (full local runs of the five required checks, per PR) is documented in the
  checklist and in each merge.
- Runtime behavior of the deployed fleet — probed post-deploy per the checklist's post-release
  section, not part of this diff audit.
