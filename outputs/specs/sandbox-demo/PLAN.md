# PLAN — Sandbox-demo surface (CAISSON-110)

- **Executes:** ADR-0350 (F1-F6) + ADR-0352 (preview contract, F2 coupling, F5 unit + riders).
  SPEC: `SPEC.md` beside this file.
- **Branch:** `admin/caisson-110-sandbox-demo-surface-demo-excerpts-demo-run-job-caps`
  (worktree, one PR). Tags: external-system / security / billing / frontend.
- **Binding facts:** `create-caisson --demo` ALREADY EXISTS (`packages/cli/src/demo.ts`,
  `generateDemo` — pure construction, no disk write, no network). The per-request path calls it
  IN-PROCESS; never the CLI binary, never `git init`, no install/build/network/subprocess.

## Fixed API contract (build against this; do not renegotiate between tasks)

`POST /api/demo/run` body (Zod `.strict()`):
`{ email: string (bounded, normalized; TELEMETRY ONLY — never a quota key), projectName: slug
(reuse the CLI's ProjectName rules), turnstileToken: string }`
→ `200 { runId, tree: [{path, bytes}], files: {path → content} (total bounded ≤ 400KB;
oversize files truncated with a marker), moduleSummary, generatedInMs }`
→ `403` turnstile fail (fail-closed: unreachable verifier = 403) · `429` rate-limited ·
`503 { reason: 'daily-cap' | 'disabled' }` (F5 tripped or kill switch).
Flags: `DEMO_RUN_ENABLED` (server) + `NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED` — TWO independent
flags per ADR-0352 F2 (the excerpts never go dark because the run path tripped).

## Tasks (ownership is exclusive per directory)

### T1 — demo-run backend (owns `apps/site/app/api/demo/**` + `apps/site/lib/demo-run/**`)

1. FOLLOW THE ASK-AI PRECEDENT: read `apps/site/lib/ask-ai/` (turnstile.ts fail-closed
   verification, spend.ts reserve/settle shape, escalate-throttle's WR-01 comment) before
   writing anything; reuse `turnstile.ts` directly if importable, else extract-shared.
2. Rate limits: per-IP and per-IPv6/64 via `@caisson/rate-limit`'s Postgres account-store
   (never in-memory) on the site's existing DB connection (follow however ask-ai/site reaches
   PG today; if the site has no migration mechanism, an idempotent `CREATE TABLE IF NOT EXISTS`
   bootstrap in the store module matching an existing in-repo precedent is acceptable — cite
   the precedent in a comment).
3. F5 cap (ADR-0352): `demo_run_budget` PG table — daily run-count + live concurrency +
   queue-depth ceilings; ATOMIC reserve at request admission (single UPDATE … WHERE count <
   cap RETURNING, or serializable tx — NEVER count-then-insert), decrement of concurrency on
   completion, auto-disable state that fails closed to 503 across API and UI. Env-tunable
   ceilings with safe defaults (e.g. 200 runs/day, 4 concurrent).
4. Run execution: import `generateDemo` from `@caisson/cli` (add workspace dep), call
   in-process with the validated slug, bound + serialize the result per the contract. Email:
   store `(email, runId, createdAt, ip-hash)` in a `demo_run_leads` table — telemetry only.
5. Tests: contract validation (unknown fields rejected), turnstile fail-closed, 429 path,
   F5 CONCURRENT LAST-SLOT test (PGlite, N parallel admissions at cap-1 ⇒ exactly one admitted;
   run PGlite suites with turbo `--concurrency=1`), kill-switch 503, happy path returns a real
   generated tree with watermarked commercial stubs.

### T2 — /demo page (owns `apps/site/app/demo/**` + `apps/site/components/demo/**`)

One combined surface, ladder copy per F4 (sandbox → eval license → purchase — rungs, not
competing CTAs; link the pricing/trust pages). Sections: (a) demo-run form (email + Turnstile
widget reusing the site's existing Turnstile client pattern) → streaming-feel progress →
file-tree browser + file viewer of the run result, with clear 429/503/disabled states (greyed
CTA when the cap trips); (b) shared prebuilt preview pane rendering T4's artifacts (real
install/build/test transcript + evidence walkthrough) labeled honestly as the shared demo app;
(c) excerpts section rendering T3's manifest read-only (reuse the ADR-0290 `CodeBlock`/
code-artifact machinery). Copy laws: ADR-0080 (no "certified/compliant" claims), V1-live
posture (no "coming soon"). Follow the design system (@caisson/ui, tokens; no new palette).

### T3 — excerpts manifest + scanner (owns `apps/site/lib/demo-excerpts/**` + `tools/demo-excerpts/**`)

Append-only manifest module: entries `{ id, title, sourcePath, sourceCommit, approvedBy:
'operator', licensePosture: 'commercial-display-only', content }` for 2-3 REAL commercial
files chosen for wow-per-risk (candidates: audit-worm hash-chain core, field-crypto HKDF
derivation — read the real files, embed verbatim). Scanner test: every manifest entry passes
a secret/credential/internal-endpoint scan (reuse the emitter's `detectSecret` shapes from
`packages/agent-dev/src/emitter.ts` as the pattern — extract or reimplement pure) and matches
its declared sourcePath content at HEAD (drift = red test). No execution, no dynamic import.

### T4 — prebuilt preview artifacts (owns `tools/demo-preview/**` + `apps/site/public/demo-preview/**`)

`tools/demo-preview/generate.ts` (bun script, run manually/at release — NOT in per-PR CI):
runs the real `create-caisson --demo` into a temp dir, then `bun install`, `bun run build`,
`bun test`, and the scaffold's evidence walkthrough (`bun run demo` if present), capturing
real transcripts + the file manifest into JSON under `apps/site/public/demo-preview/`
(bounded, scrubbed of absolute paths/usernames). Run it ONCE now and commit the artifacts.
A small test asserts the committed artifacts parse + carry the expected sections.

### T5 — gates + stress + PR (runs after T1-T4)

`bun install` → `bun run check` → `bunx turbo run build test --filter=site... --concurrency=1`
(PGlite) → `next build` for apps/site (the client/server bundle-leak class is only caught by
`next build`) → the abuse/cost stress proof: scripted burst (≥ 3× cap) against a local server
instance proving 429/503 behavior + the atomic cap (this is exit criterion 3 — record the
output in the PR body). Atomic conventional commits per task; changeset ONLY if any
`packages/*` file changed (apps are exempt; if rate-limit/cli needed a real change, changeset
it); push the branch.

## Verify (goal-backward)

An unverified visitor on /demo gets: their own generated file tree in seconds (their artifact),
a real build/test/evidence transcript of the shared demo app (proof it runs), and full
commercial source excerpts — with zero license-signing material reachable, email as telemetry
only, fail-closed Turnstile, and a cap that cannot be raced past. F5 kill switch darkens ONLY
the run path. If any of that is untrue, do not ship.
