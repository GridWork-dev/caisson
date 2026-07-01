# Stage-2 Stream B — SPEC: new sellable packages + audit harness

Status: **SPEC (awaiting operator fork-locks — no code lands until the 4 forks below are locked as
ADRs 0150–0154).** · 2026-07-01 · branch `stream/harvest-modules` (local checkout off clean `main`,
**no live deploy**). Implements the Stream B row of `docs/state/stage2-kickoff-triage.md`; governed by
**ADR-0134** (audit harness), **ADR-0135** (alerting + retention-runner), **ADR-0133** (harvest
initiative + rebuild-clean discipline). Reserved ADR range **0150–0159**.

## Goal (WHAT + WHY)

Ship three greenfield workspace packages — plus one optional net-new primitive — that add locked
sellable/quality surface with **zero conflict** with any existing tree (new dirs only; in-place
harvest lifts of existing packages belong to Streams C/D):

| Task   | Package                     | Kind                      | ADR      | Locked value                                                                 |
| ------ | --------------------------- | ------------------------- | -------- | ---------------------------------------------------------------------------- |
| **B1** | `@caisson/audit-harness`    | internal tooling (unsold) | ADR-0134 | Generalizes the ADR-0101 design gates to a cross-domain audit/validate spine |
| **B2** | `@caisson/alerting`         | commercial Compliance mod | ADR-0135 | SOC2 CC7.2 multi-channel alerting pipeline — **no current owner**            |
| **B3** | `@caisson/retention-runner` | commercial Compliance mod | ADR-0135 | CCPA/GDPR right-to-erasure runner — **zero current owner**                   |
| **B4** | `@caisson/tool-exec` (opt.) | Agentic-Dev primitive     | new      | Governed tool-call / sandboxed-exec allowlist — no current owner (optional)  |

**Why now:** B2/B3 are ranks **#1** and **#3** of the adversarially-corrected lift-sweep
(`caisson-lift-sweep-REPORT.md`) — the two capabilities the report confirms have no owner anywhere in
Caisson's package set. B1 is the cross-cutting quality tool the harvest program tracks (ADR-0134). All
are `document-only` in their ADRs today; this SPEC is the per-package gate ADR-0133 §4 requires before
any code.

## Provenance discipline (binding — ADR-0133)

**Rebuild-clean only. Patterns and ideas transfer; implementation never does.** B2/B3 source from
`gridworkdigital`'s shipped implementations (12 production event types for alerting; a 4-step erasure
shape) — but those repos are **not on this box**; I build from the ADR-0135 pattern description, not
source. B1 generalizes the **local** `tooling/design-critic` (already in-repo). Pro-private firewall:
patterns-only from `media-pipeline`, harvest from PUBLIC `tessera`. No ported code, ever.

## Engineering invariants (ADR-0002 — apply to all four packages)

- TypeScript strict, Bun runtime/PM. **Zod `.strict()` at every boundary.** No `any`, no `console.log`.
- `crypto.randomUUID()` for IDs; `crypto.timingSafeEqual` (`safeEqualFixed`/`safeEqualVariable` from
  `@caisson/kernel`) for any secret/token compare.
- `fetchWithTimeout` on every outbound fetch (webhook delivery). Errors throw `@caisson/kernel`
  typed errors **without leaking** upstream bodies (recipient/key fragments) — the `email.ts` rule.
- **Money/counts are integer units** (ADR-0007) — rate-caps, digest counts: integers.
- Injected config + injected `now` — no module-level secrets, no `Date.now()` inside pure logic
  (quiet-hours must be deterministically testable).
- Each package carries a `demo()`/`__main__`-style assert self-check + focused `*.test.ts`; no live
  network in tests (capture drivers only).
- **Genericness (ADR-0135, explicit):** B2/B3 audit rows are **plain Postgres audit-logging**, NOT
  hash-chained WORM. Neither is an `audit-worm`/`audit-chain` upgrade. Do not mistake one for the other.

---

## B1 — `@caisson/audit-harness` (ADR-0134)

Internal engineering tooling, **not sellable** → `packages/audit-harness` with **no `manifest.ts`**
(the standards-gate treats `manifestPath` as optional; mirrors `tooling/design-critic`). Generalizes
`tooling/design-critic/src/findings.ts` from design-only to cross-domain (does **not** touch or delete
design-critic — adoption of the harness into `tooling/`/`packages/ui` is an integration follow-up per
ADR-0134, not in-stream). Four primitives:

1. **Audit surface manifest** — a data-only declared inventory: `AuditDomain = { id, description,
globs, checkers }` spanning security · rls-tenancy · licensing-spdx · design-ui · standards-gate ·
   evidence-compliance (ADR-0134 §1). Declaration only; each domain names its checker(s).
2. **Cross-domain reconciling ledger** — generalize `Finding`/`reconcile()`/TOML round-trip from
   design-critic: add a `domain` field; stable id = `sha256(domain ∷ subject ∷ normalized-title)[:16]`;
   one append-only `audit-ledger.toml` (mirrors registry `ledger.jsonl` idiom, ADR-0021) across **all**
   domains instead of N siloed reports. `reconcile()` classes new/unchanged/regressed/closed unchanged.
3. **Workflow-scope guard** — pure `checkScope(declaredDomains, touchedPaths, domainGlobs) → Finding[]`
   flagging any file a CI job touches outside its declared domain(s) (ADR-0134 §3).
4. **`/validate` spine (high-risk only)** — a `Challenger` port + pure `majorityKills(verdicts) →
boolean`: a `severity: "high"` finding escalates to **two** independent adversarial passes; survives
   only if **neither** refutes; any tie or missing verdict **defaults to refuted** (ADR-0134 §4). The
   package ships the pure decision logic + port; the PAL-`challenge` wiring is an injected CLI/skill
   concern (keeps the package testable with a fake challenger). **Non-blocking** — never gates a commit
   (ADR-0134 Rejected #3).

Self-check: reconcile round-trip (new→regressed→closed), scope-guard flags an out-of-domain path,
`majorityKills` truth table (refute/refute→killed, survive/survive→lives, tie→killed).

---

## B2 — `@caisson/alerting` (ADR-0135) · commercial Compliance module

`packages/alerting`, `kind: "primitive"`, `tier: "paid"`, `editions: ["compliance"]`,
`license: LicenseRef-Caisson-Commercial`, `priceCents`: **placeholder positive int** (pricing DEFERRED
to a build-time ADR under ADR-0129 methodology — mirror the `field-crypto`/`compliance` placeholder
comment; no number invented). Registry `manifest.ts` required (sellable).

**Five-stage pipeline** (ADR-0135), each stage a pure function where possible:

1. `dedup(event, openIncidents)` — suppress when an already-open incident matches `dedupeKey`.
2. `rateCap(event, recentSends, policy)` → `deliver | digest` — per-recipient cap, digest fallback.
3. `quietHours(event, recipientTz, policy, now)` → `deliverNow | hold` — **IANA-tz** (via `Intl`,
   stdlib — no tz dep), critical-severity **override** always delivers. `now` injected.
4. `deliver(event, channels)` — **multi-channel** (transport = **Fork 2**).
5. `auditLog(event, outcome)` — structured **plain-Postgres** row (Drizzle migration à la
   `field-crypto/src/migrations/0001_*.sql`). NOT WORM.

Data-only `EventTypeRegistry`: `eventType → { defaultSeverity, channels, ratePolicy }` (the
gridworkdigital reference spans 12 types — we ship the registry shape + a small seed, not all 12).
`AlertEvent` Zod-`.strict()`. Depends: `@caisson/kernel` + transport dep per Fork 2.

Self-check: dedup suppresses a repeat; rateCap flips to digest after N; quietHours holds off-hours but
critical overrides; capture channel records delivery.

---

## B3 — `@caisson/retention-runner` (ADR-0135) · commercial Compliance module

`packages/retention-runner`, same commercial manifest shape as B2 (paid/compliance/commercial,
placeholder price). Pluggable multi-store erasure (ADR-0135):

- `ErasureRequest` Zod-`.strict()`: `{ subjectId, tenantId, reason }`, reason ∈
  `auto_90d | ccpa_request | operator_manual`.
- `ErasureTarget` port: `{ name; erase(subjectId, tenantId) → Promise<TargetResult> }`. Drivers:
  object-storage purge → cascade DB delete → orphan-record sweep (+ a capture target for tests).
- `runErasure(request, targets)` — runs every target with **per-target error isolation**
  (`allSettled` shape: one failing store never aborts the run), collects per-target outcomes, then
  writes **one** reason-tagged plain-Postgres audit row. NOT WORM.
- **Scheduling = Fork 3.** `auto_90d` is the recurring path; `ccpa_request`/`operator_manual` call
  `runErasure` directly (operator-triggered).

Self-check: one failing target doesn't abort the others; every target runs; audit row carries the
reason tag; the scheduled path enqueues the run task.

---

## B4 — `@caisson/tool-exec` (optional) · Agentic-Dev primitive

**Scope = Fork 4.** The one genuinely net-new (no current owner) capability routing to an AI edition:
a **governed tool-call / sandboxed-shell-execution primitive** — allowlist + argument provenance,
`execFile` arg-arrays only (security floor: never shell-string concat), injected allowlist config.
Converges the clean-lift exec-endpoint item + lift-sweep rank #10 (gridwork shell-allowlist) + rank #4
(telesis governed-agent-kernel tool layer). Routes to **Agentic-Dev**. Needs its own ADR (0154).

Optional because: (a) not in the recommended ship order; (b) it is arguably in-place hardening of the
existing `agent-kernel` (→ Stream C) rather than a new package — that ambiguity is Fork 4.

---

## Open forks (await operator lock → ADRs 0150–0154)

Recommendations are labeled confidence + evidence per the one-operator rule; **nothing is
auto-decided.**

### Fork 1 — Ship order / scope · → ADR-0150

- **(a)** harness → alerting → retention (kickoff's stated rec).
- **(b, REC)** alerting → retention → harness — the two commercial modules are ranks **#1/#3** locked
  value; the harness is internal tooling ranked **wave-5 / lowest urgency** in `harvest-program.md`,
  and its adoption is an integration follow-up anyway (no in-stream dependency on it). Ship the revenue
  surface first. _Confidence: high. Evidence: `harvest-program.md` ranked order + ADR-0134 scope-note._
- **(c)** alerting + retention only; **defer** harness + B4 — thinnest (ponytail): ship the two
  locked-value modules, leave internal tooling + the soft B4 to a later wave.

### Fork 2 — Alerting transport · → ADR-0151

- **(a, REC)** reuse `@caisson/email` `Emailer` + a new `WebhookChannel` port behind a generic
  `AlertChannel` interface; capture driver for tests. Reuses the shipped Apache email port; webhook via
  `fetchWithTimeout`. Slack/Telegram become trivial later drivers — not built speculatively (YAGNI).
  _Confidence: high. Evidence: kickoff rec; `packages/email/src/email.ts` port shape._
- **(b)** email + webhook + Slack/Telegram drivers now — the lift-sweep source was multi-channel.
- **(c)** generic `AlertChannel` + capture/webhook only, **no** email dep — thinnest; wire email later.

### Fork 3 — Retention scheduling · → ADR-0152

- **(a, REC)** `@caisson/jobs` `JobQueue` port + in-memory dev driver; `auto_90d` as a `defineTask`,
  Trigger.dev prod driver later (the shipped jobs convention); manual/ccpa call `runErasure` directly.
  Zero new scheduling code. _Confidence: high. Evidence: `packages/jobs/src/queue.ts` port._
- **(b)** internal `setInterval`/cron inside retention-runner — self-contained, reinvents `jobs`.
- **(c)** no scheduler — expose `runErasure()` only; the caller schedules.

### Fork 4 — B4 scope · → ADR-0154 (only if built)

- **(a)** build `@caisson/tool-exec` now (governed tool-call primitive for Agentic-Dev).
- **(b, REC)** **defer B4** to a later harvest wave — under-specified (no locked ADR; ambiguous
  new-pkg-vs-agent-kernel-hardening), not in the value ranking, needs its own ADR regardless. Keep
  Stream B to the three locked-ADR packages. _Confidence: medium. Evidence: kickoff B4 note "in-place
  lifts belong to C/D"; `harvest-program.md` places it outside the top waves._

---

## Routing plan (build phase — after locks)

Per doctrine model lanes + operator direction (Sonnet builds / Opus verifies): the post-lock build
runs as a **Workflow** — each package is a bounded (<300 LOC), fully-specified unit built by a
**Sonnet** agent in **worktree isolation** (parallel writers, ADR-0133-clean), then an **Opus**
adversarial verify/review pass (security floor + goal-backward vs this SPEC + genericness-not-WORM
check) before any commit. Ledger/manifest wiring reconciled once at Stream-B close; the registry
`index.json` rebuild is the integration session's job (never hand-merged here).

## Integration hand-off (not in-stream)

Root `package.json` workspaces + `bun.lock` re-resolve, `registry/{ledger.jsonl,index.json}` rebuild,
and the `decisions-and-forks.md`/`adr-index.md` board merge are the **integration session's** job.
Stream B only appends its ADRs (0150–0154, distinct filenames) and its package dirs.

## Exit criteria

`bun run check` + `bun run gate` green for the new packages; each package's self-check + tests pass;
manifests (B2/B3) agree with package.json (id/version/license/deps); B1 non-blocking; every audit row
plain-Postgres (no WORM); atomic conventional commits (`feat(alerting|retention-runner):`,
`feat(audit-harness):`, scopes added to `CLAUDE.md`'s list at integration).
