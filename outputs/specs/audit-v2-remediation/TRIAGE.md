# Audit v2 remediation — triage doc

> **EXECUTED 2026-07-04.** All four execution specs below shipped to `main` in parallel
> sessions: **P0 → PR #110** (agent side; the operator-cred rotations remain operator acts) ·
> **P1 → PR #111** · **P2 prose → PR #112** (218 findings + the shipped-prose gate) ·
> **P2 D1 → PR #113** (SHIP security+auth audit: PASS). The live-verification pass that
> followed found and fixed a fifth, launch-critical item the same day: the strict webhook
> envelope schemas rejected every real Paddle/Stripe delivery (**PR #114**), proven fixed by a
> live Paddle-signed simulation (webhook 200 → entitlement grant → PostHog capture). The
> ledger rows the specs enumerate are flipped to `fixed`; the prose wave's ~194 rows are
> enforced go-forward by the standards-gate shipped-prose check rather than row-by-row flips.
> Sections below are preserved as written (pre-execution disposition record).

**Session 2026-07-03.** ADR ceiling **0238**. Source: whole-repo audit v2 (ADR-0233, PR #100) —
the 941-finding advisory ledger at `outputs/audit/ledger.toml` (302 open / 111 open-high).

This doc is the **disposition**: which open findings became execution specs (written, **NOT
executed**), which are roadmap-only, and the operator-gated DEPLOY residue that stays
operator-owned. This was a specs-only session — no remediation code was executed. The
operator-gated forks were locked via picker before any spec was written.

The 941-finding ledger is **advisory** (ADR-0233 Fork-E): it informs the build, never gates a
merge. Open-highs are **candidates, not verdicts** — ~29 refuted round-3 highs may linger from a
confirm-filter bug (object-identity compare across a structured-clone boundary); verify before
fixing.

---

## 1. Clean state executed this session

- **PR #98** (`feat/catalog-drop-core-rows`, ADR-0238) — merged squash, CI fully green
  (greptile-gate / check / standards-gate / oscal-conformance / registry-index / eval / changes
  all `pass`), branch deleted. Ceiling bumped 0237 → 0238.
- **21 stale 0-ahead branches deleted** — 19 `worktree-agent-*` / `worktree-wf_*` orphans + the
  two merged `docs/adr-0222-distribution` + `docs/spec-post-wave-hardening`. Only `main`,
  `feat/glossary-batch-1`, `feat/site-rework` remain (the site-rework effort — untouched).
- **Stale-ref sweep** — `docs/state/stage2-deploy-plan.md:102` runbook pointed `gh secret set` at
  the pre-org-move repo; corrected `GridWork-dev/caisson` → `caisson-sh/caisson`. `build-state.md`
  lead banner was stale at ceiling 0228; prepended a current-state banner (0238 + audit-v2
  baseline pointer + spec/triage locations), historical banners preserved as timeline.
- **Refuted as intentional** (not swept): `GridWork-dev/caisson` mentions in `launch-runbook.md`
  / `public-surface.md` / `operations.md` are correct migration auto-redirect notes;
  `media-pipeline` / `gridwork-core` refs are sibling repos under the GridWork-dev org (correct);
  `.playwright-mcp/` is gitignored (the matched artifact is untracked).

---

## 2. Execution specs written (NOT executed)

| Spec                                                                        | Wave                                | Findings covered                                                                                                                                                    | Tags                                           | Status                                                      |
| --------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| [`p0-license-token-cred-incident/`](p0-license-token-cred-incident/SPEC.md) | P0 security/economic incident       | 5 open-high (3 prod license-token D2 + 2 operator-cred rotation)                                                                                                    | `security` `secrets` `external-system`         | spec-only — **HARD BLOCKER** on the caisson-oss public flip |
| [`p2-prose-tooling-wave/`](p2-prose-tooling-wave/SPEC.md)                   | P2 internal-prose leakage + tooling | ~194 opens (~140 D3 + 55 D4 + 33 SS-12 + 8 oss-mirror reflections — the biggest ROI, closes well over half the open ledger)                                         | untagged (REVIEW-only)                         | spec-only                                                   |
| [`p1-buyer-breaking-fixes/`](p1-buyer-breaking-fixes/SPEC.md)               | P1 buyer-breaking                   | 7 eu-ai-act-sample scope + 4 manifest-price drift + ~10 exporter-tooling                                                                                            | untagged (display/manifest sync — not billing) | spec-only                                                   |
| [`p2-d1-security-floor/`](p2-d1-security-floor/SPEC.md)                     | P2 D1 security-floor gaps           | 8 opens (apps/site email HTML-injection · apps/admin confirm-bypass + raw-JSON token · apps/base bare-`as` Zod bypass · mcp-server CORS wildcard + missing headers) | `security` `auth`                              | spec-only                                                   |

Per-spec finding-ID tables + verify commands live in each `SPEC.md`. _Inventory counts are the
designed coverage; agent summaries may have reclassified individual findings (noise/reconcile) —
see each spec's Findings-covered table for the authoritative disposition._

---

## 3. Roadmap-only audit buckets (deliberately NOT specced this wave)

- **D6 stale-docs long tail (root-docs, internal-only)** — `apps/studio` orphan, package count
  24-vs-35, ADR range cap 0137-vs-0237, Cloudflare-Pages claim. P4 — developer-onboarding, not
  buyer-facing. Re-open if the public README is reworked.
- **Missing-README wave** — `ai-evals`, `ai-meter`, `guardrails`, `registry-schema` ship without
  a README (D3 SS-10, ~5 open-high). P3 — cheap; natural follow-on to the P2 prose wave.
- **D7 hygiene residue** — `apps/studio` orphan dir, `turbo.json` `.next/` outputs,
  `packages/billing` dead LemonSqueezy/Polar exports (contradicts its own D6 — see §5). P4
  mechanical.
- **oss-mirror source-side prose reflection** — **closed by the P2 prose wave** (fixing source
  prose closes both the source-package D3/D4 row and the oss-mirror reflection row); not a
  separate spec.
- **`packages/*` D5 license-tier** — fully fixed (0 open). The mirror license-mislabeling
  sibling is owned by the P1 exporter-tooling spec.

---

## 4. Operator-gated DEPLOY residue (unchanged — stays operator-owned)

From `docs/state/opportunity-backlog.md`, post-wave. These are ops/deploy actions, not code
specs — they stay operator-gated runbook entries:

1. **Registry npm-delivery Task-1/5 DEPLOY** — R2 tarball bucket + `registry.caisson.sh` route +
   CF token widen + a live `bun install` proof.
2. **Registry Worker redeploy** for the 0.2.0 / ADR-0228 index (+ the REVOCATIONS R2 binding).
3. **Cred-sweep execution** (ADR-0226) — **folds into the P0 spec** (license-token rotation +
   OPENROUTER/DISCORD/MIRROR_PUSH rotation; MIRROR_PUSH_TOKEN rotation is MUST — it transited a
   transcript).
4. **`caisson-oss` public flip** + first `confirm=publish` npm dispatch (ADR-0222) — **hard
   blocked on P0 spec execution** (the prod license tokens ship in the public mirror today).
5. **WORM lock-mode posture reconcile** — GOVERNANCE mode is live; COMPLIANCE-mode text in the
   runbook flips at the launch flip via the ADR-0202 gated path.
6. **Mac-mini `gw-macos-arm64` runner restart** — `native-ext (macos)` CI leg is queued
   (non-required; restart the scale set before the next native-ext-sensitive PR).

Plus buyer-journey: production Paddle account flip, Paddle MoR/refund copy on `/legal/{terms,privacy}`,
Discord privileged-intent verify.

---

## 5. Noise / reconcile-needed

- **~29 refuted round-3 highs may linger** (confirm-filter bug) → every open-high is a candidate,
  not a verdict. Verify the finding still reproduces before fixing.
- **`packages/billing` LemonSqueezy/Polar CONTRADICTION** — `7187ceba82df7646` ("dead exports")
  vs `8a94468dbc3385e6` ("drivers live but undocumented"). Reconcile which is true before either
  is touched (called out in the P2 spec).
- **D3 "judgement-call" + trailing-ADR-citation findings** (SS-12, ~25 opens on package.json
  descriptions) — mechanically identical; sweep as a class in the P2 wave, do not adjudicate
  one-by-one.
- **D5 license-tier** — 0 open; the mirror mislabeling sibling is in P1.

### Authoring-time reconcile flags (from the spec agents)

- **P0** — the golden-token `_note` framing names the wrong threat (it says "detached signature
  reveals nothing about the private key" — true, but the actual leak is the **live entitlement
  token**, not the private key). The fix is correct under either framing; new comments should
  state the entitlement-token invariant.
- **P1 — `b5d180701c0e3069` operator fork**: local-ai manifest `priceCents: 34900` ($349) vs
  ADR-0129-locked $399. The comment fix ships in-PR; the NUMBER change waits on a one-line
  operator confirm (which price is canonical for local-ai).
- **P2** — `packages/billing` dead-export finding reclassified **out** of the prose wave (it's a
  D7 code-vs-doc contradiction, not a prose leak); parked in that spec's Non-goals. The
  changeset-formatter choice (custom formatter vs changeset-source gate) is an **open operator
  fork** — parked in the SPEC, promotes to `decisions-and-forks.md` on execution.
- **P2 D1** — `473e43578bcaee72` is ledger-tagged D2 but grouped with the D1 admin findings
  (shared `apps/admin` render locus); the spec notes the dimension-vs-locus distinction so no
  ledger row needs editing.

---

## 6. Cross-cutting themes (fix-once-at-root)

- **Internal-prose leakage** (~140 opens) → P2 standards-gate guard + changeset-formatter strip
  - one prose sweep. The single highest-leverage root fix in the ledger.
- **Manifest-vs-locked-ADR drift** → P1 manifest reconciliation + a standards-gate
  manifest-vs-ADR check (catches the next drift at PR time).
- **Real secrets in shipped surfaces** → P0 secret-scan gate on `__golden__/` + `app/demo/`.
- **AGENTS.md under-documents actual exports** → fold into the P2 prose wave (gate AGENTS.md
  against the package's real exports — auth, agent-kernel, ai-config, ai-meter, compliance,
  retention-runner, observability all flagged).

---

## 7. Next

These 4 specs are **written, not executed**. Execution is operator-gated: on approval, each spec
runs the 7-act loop (PLAN → EXECUTE → VERIFY → SWEEP → SHIP; SECURITY + auth audits fire on the
tagged specs). **P0 is the sequencing constraint** — it blocks the caisson-oss public flip and
folds the cred-sweep. Recommended execution order: **P0 → P1 (buyer-breaking) → P2 prose+tooling
→ P2 D1 security-floor** (P1/P2 can parallelize where disjoint; P0 first and alone).

### Execution disposition (operator picker, 2026-07-03)

- **All 4 specs execute this wave.** Merge-queue order: P0 agent-side → P1 → P2 prose → P2 D1.
- **P0 split (operator lock: agent-side first):** tasks 2/3/5 + the task-4 runbook ship now
  (branch `audit-fix/p0-agent-side`); the task-1 key-bake + license/Worker redeploys land as a
  follow-up PR once the operator mints the new keypair (`launch-runbook.md` §1.1).
- **caisson-oss public flip + first npm publish: HELD** by operator decision — stays gated on the
  §1.1 sequencing gate even after P0 merges.
- **P1 + both P2s run as parallel worktree workflows** (builders → adversarial opus review →
  fixes), merged serially behind P0.
- **Both spec-parked forks closed by later locks, no picker needed:** local-ai priceCents —
  ADR-0240 makes $349 canonical (the manifest number stands; comment fix only); changeset
  formatter — ADR-0241 locked the SOURCE gate (option 2b; the 2a formatter is rejected) and it
  already shipped in the wave-6b standards-gate, so the P2 prose wave executes as
  sweep-against-existing-gate.
