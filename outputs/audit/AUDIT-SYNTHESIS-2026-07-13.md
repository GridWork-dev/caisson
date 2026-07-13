# ADVERSARIAL AUDIT SYNTHESIS — 2026-07-13 (late session)

Sources: 18-agent workflow (9 red-team · 5 provider · 4 gap lenses, 1.75M tokens, all returned) +
Codex `gpt-5.6-sol` @ high cross-vendor review (26 findings: 16 critical, 10 warning).
**Coverage caveat:** 3 red-team lanes (kickoff-platform, spec-verify-ui, spec-anchoring) returned
placeholder junk and contributed nothing — their surfaces are covered ONLY by the Codex review and
the cross-consistency lane. Everything below survived at least one evidence-grounded pass.

## Verdict matrix

| Doc                           | Claude red-team         | Codex                                   |
| ----------------------------- | ----------------------- | --------------------------------------- |
| KICKOFF gw-core security-ops  | needs-amendment         | **rethink** (phase-isolation violation) |
| KICKOFF caisson design-motion | needs-amendment         | needs-amendment                         |
| KICKOFF caisson platform      | (lane failed)           | needs-amendment                         |
| SPEC agent-ready DS           | needs-amendment (heavy) | **rethink**                             |
| SPEC per-row verification     | (lane failed)           | **rethink**                             |
| SPEC external anchoring       | (lane failed)           | **rethink**                             |
| SPEC compliance crosswalk     | needs-amendment         | needs-amendment                         |
| SPINE research                | needs-amendment         | needs-amendment                         |
| FORK-LOCKS                    | needs-amendment         | **rethink** (bias upgrades)             |

**Net: nothing ships to PLAN as-written.** The product ideas survive; the locked v1 scopes and
several factual premises do not.

## A. Facts overturned (live-verified; kickoffs patched in-place)

1. **MCP-probe July-28 "deadline" — premise dead.** No `server/discover` JSON-RPC method or
   `Mcp-Method` header exists in the 2026-07-28 RC; statelessness = SEP-2567 (session-id removal),
   discovery = GET `.well-known/mcp/server-card.json`. The probe (one-shot `initialize` POST →
   `res.ok`) cannot break from statelessness. Owed at most: `MCP-Protocol-Version` header +
   protocolVersion bump + optional server-card probe. **Demoted from DO-FIRST.** Also: the file
   lives in events-shipper (Codex-session-owned) — sequence after their merge regardless.
2. **Backups already exist and run green.** `events-backup.sh` does full restic init→backup→prune;
   timer active, ran today (20 snapshots); repo is on a real 916G SSD at
   `/mnt/backup-ssd/ms-a2-restic`. The "owed SSD / broken timer / interim box-disk repo" premise is
   false on all three counts → the interim-restic grill lock is **moot**, services genuinely
   un-gated, and the only real task is **extending backup scope to new service volumes**.
3. **monitor-collector cap:** RSS peak 1.8G — a 512M MemoryMax would OOM-kill mid-cycle (creating
   the exact silent restart-storm item 9 hunts). Collector swap = 16.7M; it is NOT the 5.6G swap
   driver. Fix leak first; any backstop cap ≥2G. (Already corrected in the monitor handoff prompt.)
4. **Restart-storm detector — wrong rung.** systemd already has the mechanism, misconfigured:
   `StartLimitBurst=5` can never trip at `RestartSec=5s`/`Interval=10s`, and `OnFailure=` is empty.
   Fix = tune StartLimit so storms reach `failed` + `OnFailure=gridwork-alert@%n` → tg-bridge. No
   new oneshot scanner.
5. **Postgres reclaim:** session_events = 546MB @ **2501** live rows (not 745); realistic reclaim ≈
   agent_turn's 356MB + measured bloat, not −900MB. wardfile NRestarts = **1462** and climbing (not
   673); events-shipper also loops (wardfile isn't the sole remnant).
6. **TypeScript version map INVERTED:** `typescript@latest` = **7.0.2 GA**; 6.0 exists only as
   @beta; native compiler = `@typescript/native-preview`. The "bridge via stable 6.0 → diff TS 7"
   plan and the `tsc6` package names are wrong in both repos' tasks — re-derive from
   `npm view typescript dist-tags` at PLAN.
7. **Hero lazy-load ALREADY SHIPPED** (ADR-0306, merged 07-10): dynamic-import behind
   idle/lg/no-reduced-motion gates, measured 128.2 KiB gzip vs the ≤130KB error-level budget.
   Design task 6 was duplicate work → rescoped to a headroom re-measure. Corollaries: the "529 KB"
   figure was raw-vs-gzip on an off-critical-path chunk; **the motion bundle objection is NOT
   moot** — motion's real cost is ~34–50 KB gzip into the interactive home bundle, which sits at
   128.2/130 KiB (zero headroom). A real `next build` delta must precede the moment locks. Note:
   `framer-motion@12.42.2` is already in the lockfile (motion = alias, same version).
8. **ADR-0307 cannot be "amended"** — caisson ADRs are append-only; a NEW superseding ADR is
   required, and per its current binding text (CSS-only, transform/opacity-only) even the
   "dep-free three" exceed it (SVG dash draw, scroll-fed WebGL uniform) → **nothing lands before
   the superseding ADR**, including the dep-free moments.
9. **ChainViewer is commercial-package code** (`@caisson/audit-worm`, presentational/SSR-safe by
   contract) — Living Chain motion must live in a site-local wrapper; motion never enters the
   sold package.
10. **Session-taint gate ≠ 50 lines:** hooks.py is Claude-only ingress (Codex has its own adapter;
    doctrine demands parity); `tools/lib/egress-guard.ts` already exists as the shared egress
    policy home. Real shape: one shared policy engine consumed by both hook adapters + content
    scanning + session-keyed state. Re-scoped from "build now, tiny" to a designed task.
11. **Drizzle state descriptor stale:** latest = 0.45.2, prereleases are 1.0.0-beta.* (no rc.4).
    GA gate logic stands; re-read dist-tags at PLAN.
12. **shadcn GitHub registries** resolve as `owner/repo/item` — `@caisson/button` needs a
    configured/indexed namespace; use `bunx`, not `npx`.
13. **"zero-dependency" package description would be false** — `@caisson/ui` declares `radix-ui`
    - `zod`. Say "native-first"; optionally narrow to the Slot subpackage first.
14. **Socket scoping misses its own stated exposure:** global bunfig on dev machines does nothing
    for Railway builds. Verify Railway's install path/bunfig discovery or drop the coverage claim.
    Also re-check bun bug #31028 status before scoping (it may have closed).
15. **trufflehog `--results=verified` does not "close" the gap** — unverified candidates
    (revoked/private/unverifiable formats) are skipped. State the residual honestly; gw-core also
    has **no `tools/security/versions.env` yet** (create, don't copy-into).
16. **Mini model plan:** "Gemma-4-26B" tag unverified (Gemma 3 is the current line); 26B-Q4 + 8B +
    embeddings co-resident on a shared 24GB CI node has no headroom math. RAM confirm (`ssh
gws-mac-mini 'sysctl hw.memsize'`) + tag verification + single-resident-model design first.
17. **Snyk local-only flag** must be verified on the installed 0.5.x (CHANGELOG 0.1.15 evidence is
    3 major versions stale) — if absent, the trial silently egresses the dep graph. Blocking gate.
18. **Refero "7% quota"** was never shown as executed — run `refero-usage.ts` against
    EVENTS_PG_URL and record the real number before the design trials start; >50% = hard stop.

## B. Lock challenges (operator re-lock needed at plan-fanout; locks NOT silently changed)

**Agent-ready DS:** E (runtime a11y v1) contradicts the SPEC's no-browser buyer story — jsdom
can't do the contrast check; the renderer prerequisite has no owner (Storybook is only a trial).
A/D (both servers + discovery-free) forces a NEW unauthenticated public MCP (the existing transport
is fail-closed pre-auth) → security/external-system tags MUST fire; cheaper alt on record: the
Apache CLI + committed manifest already serves free discovery with no hosted server. F targets
`packages/cli`, which is the credit-metered `create-caisson` scaffold, not a buyer CLI. Component
count is 38 not 40; variants must derive from TS prop types (data-* covers only 28/38).
**Codex CR-08/09 + Claude lane converge: re-cut v1 = manifest + CLI describe + static doctor +
authenticated MCP tools; runtime axe + open server = later increments.**

**Per-row verification:** CR-06 — redacted rows cannot satisfy "verified locally"; needs a distinct
`anchor-confirmed-original-not-disclosed` state (honest-marking lock stands, the state model
grows). CR-07 — the proof-bundle endpoint has no auth contract (derive accountId from session only,
server-side WORM key construction, Zod-strict, cross-tenant denial tests). CR-04 — per-row
EXTERNAL (Rekor-level) proof is not compact on a hash chain: external status renders at
chain/checkpoint level, or budget prefix replay, or add a Merkle commitment. Lock b's note smuggled
deferred b3 scope ("verified locally" provenance distinction) — make deliberate or drop.

**External anchoring:** CR-01 — Rekor v2 submission needs signature + verifier material +
TUF/shard handling; "one module ≈ sign.ts" is a wrong estimate; protocol spike before PLAN.
CR-02 — durable outbox (pending/submitted/receipted/failed) before egress or receipts can be lost
irrecoverably (Rekor v2 removed online proof retrieval). CR-03 + cross-lane converge — TSA
default-on does not deliver the "outside parties detect rewrite" grade, and **ADR-0056 already
countersigns packs with RFC-3161** (partial duplication): split the trust grades
(`trusted-timestamped` vs `externally-transparent`), reword the sellable line before any UI copy.
CR-16 — the scheduled handler can't live in Apache `packages/jobs` (upward dep on commercial
audit-worm); register from the commercial composition package. Both-targets-v1 (A/D/E) roughly
2–3× the SPEC's own effort sketch — re-estimate or de-scope Rekor offline-verify to v1.1.

**Crosswalk/spine — the big one, four independent lanes converge:** the dual-catalog + vendored
800-53 machinery is over-engineered for the evidenced demand. The rollup is a pure join over
existing `crosswalk[]` pointers (the SPEC's own Fork A option-1, rated smallest/highest-confidence);
ISO 27001 ships as a fourth `regimes.ts`-pattern crosswalk; the vendored 1000-control catalog has
no runtime consumer and only serves FedRAMP, which ADR-0277 explicitly defers. Additional hard
errors: the cited NIST↔ISO mapping docx targets the **retired 27001:2013** (the 2022-edition OLIR
xlsx is the correct seed — pin by URL+hash); **no OSCAL catalog-model emitter exists** (ADR-0179
machinery = SAR/AP only — "generate the caisson catalog via existing machinery" is a false reuse
claim); `verified: boolean` must become structured provenance (status/relationship/sourceVersion/
sourceDigest/reviewedBy — CR-10); named-person attestation under a per-tenant key proves the
TENANT asserted, not the person (CR-05): honest named-attestation record now, per-person keys as a
separate program. 3 shared control ids (not 1); ref counts 38/31/19 (not 32/27/19). The SPEC's own
non-goals contradict the lock (no-800-53-ingestion, no-new-frameworks) — SPEC amendment + ADR-0057
supersession + `control.ts:5` comment fix must land together, and locks must transcribe to
`docs/state/decisions-and-forks.md` + ADRs (repo convention) before PLAN. ISO identifier/EU
database-right question → add to the EXISTING lawyer engagement (ADR-0319 scope), near-zero cost.

**Cross-doc:** DS SPEC tag line must add `security` (its own condition fired). gw-core kickoff is
missing the Stitch + pgrls manifest/roster legs (same-commit invariant). ASSERT: platform builds a
live-service lane while gw-core holds the runner fork open — scope Q5 to the case-generator runner
explicitly. Living Chain finale must use the per-row state vocabulary (or stay swap-ready).
Seal-on-Proof fires on a `verified` state that doesn't exist yet + is specced into apps/admin
which the motion kickoff excludes — add the gate/scope note. Webwright needs its own disposition
row (currently rides OpenWorkflow's cell).

**Phase structure (Codex CR-15):** the gw-core kickoff cannot be ONE STANDARD phase — split at
PLAN into ≥5 phases (MCP compat · supply-chain CI · host reliability/backups · memory/graphify ·
browser+mini/local-AI), each with own tags/rollback/DEPLOY gate. Doctrine's phase-isolation rule.

## C. Paid-provider audit (excl. Claude Max + Codex Pro)

| Provider                        | Plan / est             | Verdict                | Key evidence                                                                                                                    |
| ------------------------------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| OpenRouter                      | PAYG ~$8/mo            | **keep**               | $1.93/7d, 94 calls; load-bearing (PAL, embeddings, graphify)                                                                    |
| **z.ai GLM sub**                | ~$18/mo (Lite assumed) | **CANCEL**             | 3 smoke runs ever (07-02/03), 10 days dark; GLM-5.2 reachable via OpenRouter PAYG; dovetails with the GLM-lane security disable |
| Exa                             | PAYG $5–25/mo          | **keep**               | Real usage; ⚠ audit seeded monitors — 30-min poller = ~$21.60/mo per active monitor                                             |
| Refero Pro                      | $12/mo ($10 yearly)    | **keep**               | 538 calls/mo; Pro is the MCP floor tier — switch to yearly billing                                                              |
| **Cookiy**                      | $0 balance             | **CANCEL/deprovision** | Zero usage anywhere, $0 balance, MCP flapping — remove key + manifest + ledger row                                              |
| Recraft                         | PAYG (planned)         | watch                  | $0.04/raster verified; revisit at 30d telemetry                                                                                 |
| Linear Business                 | $16/mo                 | **keep**               | All four Business-only legs live + proven (PR #205 auto-close chain); support-bot prod sink                                     |
| PostHog                         | usage, ~$0             | watch                  | Live on site + monthly agent job; check billing page at next cost audit                                                         |
| Railway                         | Pro, ~$25–70           | keep                   | Entire caisson prod (5 services + PG); pull the real bill once                                                                  |
| Blacksmith                      | PAYG ~$25–50           | keep                   | ADR-0326 locked today, 30+ green runs; credentialed jobs stayed GitHub-hosted                                                   |
| Vercel                          | Hobby $0               | housekeeping           | events-shipper VERCEL_API_TOKEN documented dead → rotate/remove; gwd's own Vercel = out of scope, check separately              |
| Cloudflare / Tailscale / GitHub | free                   | keep                   | Confirmed by provider docs; Workers Paid = future line (ADR-0142)                                                               |
| Proton                          | unknown ($7–13?)       | **confirm**            | 3 custom domains; no local evidence of tier                                                                                     |
| Domains ×8                      | ~$10–20/mo eq          | **confirm**            | No registrar artifact anywhere; check invoices + locks                                                                          |

Immediate money moves: cancel z.ai (~$216/yr), deprovision Cookiy, Refero → yearly (−$24/yr),
confirm Proton + domains + Railway real bill. Net stack (ex-Anthropic/OpenAI): ~$80–130/mo.

## D. Gaps (new work surfaced)

**Coverage (never swept):**

- **Email deliverability [HIGH]** — magic-link auth rides Resend free tier (100/day cliff) with no
  SPF/DKIM/DMARC in the Terraform zone, no DMARC reports, no volume alert. Login-path SPOF for a
  compliance vendor. → caisson-platform + infra/terraform.
- **Status page + trust/subprocessor center [HIGH]** — no public status.caisson.sh, no /trust or
  subprocessor list; vendor-due-diligence sales blocker for the exact buyer persona. Better Stack
  (already in stack) ships a free status page. → caisson kickoffs.
- Error tracking [MED] — `error.tsx` has a literal unwired Sentry seam; PostHog error-tracking is
  already paid-for → wire it + source maps.
- Secret-rotation cadence [MED] — key-age/rotate-due report oneshot vs manual memory.
- DNSSEC + registrar lock + domain-expiry/NS-drift monitoring [MED] — total-outage + spoofing
  blast radius, currently invisible.
- GTM pipeline/CRM decision [LOW] — Linear project vs minimal CRM; make it explicit.
- Load/abuse testing [LOW] — k6 lane against checkout/license-mint/registry; fail-open limiter is
  currently a guess. Consent basis for PostHog on EU dashboards [LOW].

**Ownership repairs:** Webwright row · Seal-on-Proof gate · pgrls gw-core leg · watch items need a
recurring-review home (pin-registry/audit-cadence) — CF Browser Run, OpenWorkflow, browser-use,
Opengrep, caisson-relay-on-buyer-ask, dual-hash-on-auditor-reject · arch-audit graduation bar ·
PPR watch line deleted or given a real trigger (field LCP regression via task 7).

**Premise re-checks (first action of each implementation session):** collector RSS before any cap ·
pg table sizes at gate-clear · Refero quota before design trials · bundle analyzer before motion ·
bun #31028 · versions.env creation · mini RAM + model tags · drizzle/better-auth dist-tags ·
oscal-content LICENSE re-fetch at vendoring · wardfile NRestarts at kill time.

## E. Who consumes what

- **tmux main-green session:** nothing here blocks it; the GLM disable decision is reinforced by
  the z.ai cancel verdict.
- **tmux monitor session:** collector facts already corrected in its prompt.
- **Plan-fanout session (next):** reads this file + FORK-LOCKS (challenges section) + the four
  SPECs; walks the B-section re-locks with the operator; then PLANs per feature.
- **Implementation sessions:** read the patched kickoffs (correction banners at top) + section D
  premise re-checks.
- **Operator, 5 minutes:** cancel z.ai sub · deprovision Cookiy · Refero to yearly · confirm
  Proton/domains/Railway bills.
