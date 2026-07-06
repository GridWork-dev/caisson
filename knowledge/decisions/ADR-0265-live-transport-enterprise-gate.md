# ADR-0265 — Live-transport launch gate: enterprise-ready sweep, checklist SOT, roadmap-doc corrections

**Status:** accepted · 2026-07-06 (Kickoff-F picker round 1, dx-demos-compat session).
Extends ADR-0201 (live/ self-skipping convention) and ADR-0224 (live-verification harness);
corrects `docs/state/adapter-expansion.md` (stale rows) and
`docs/state/compatibility-matrix.md` §1 (two factually wrong rows). Append-only.
**Tags:** external-system (the proof runs touch real vendor surfaces; creds operator-owned).

## Decision

1. **`docs/state/live-transport-checklist.md` is the launch-gating SOT** — one row per live
   transport: package · test command · creds/env needed · last-proven date · status
   (`proven` / `unproven-gating` / `waived`).
2. **Posture: enterprise-ready sweep** (operator pick above the hybrid docs-first rec):
   **every coded transport must be live-proven or explicitly operator-waived per row before
   launch** — not just the buyer-day-1 paths. That includes the never-run set (SMTP/SES/
   Postmark, WorkOS SSO, LemonSqueezy, Polar, Supabase transactor, pg-boss runtime, Ollama
   lane) and every new W5 driver (GCP KMS, GCS, R2, Prisma bridge) — each lands with a
   `live/` test + a checklist row in the same PR. Creds provisioning is operator-owned; the
   checklist enumerates the exact env vars per row. 13 transports are already proven
   (2026-07-02/05 evidence) and satisfy their rows.
3. **Roadmap-doc corrections land with the checklist:** `adapter-expansion.md`'s shipped
   rows flip to done-with-ADR-refs (email ADR-0170 · AWS KMS 0171 · WorkOS 0172 · pg-boss
   0173 · LS/Polar 0175 · Bedrock/Azure/Ollama + MCP-HTTP 0161) and its **R2 row is
   corrected** — R2 does not support S3 Object Lock; the "trivial S3-compat reuse" premise
   was false (see ADR-0267). `compatibility-matrix.md` §1's Email ("Resend only") and Jobs
   ("Trigger.dev + in-memory") rows are corrected to the shipped multi-driver reality.

Rejected: **hybrid docs-first** (gate only proven buyer paths) and **buyer-paths-only** —
the operator chose the full sweep; launch timing becomes creds-bound by explicit choice.

## Consequences

- The launch runbook gains a creds-provisioning block (which vendor accounts/keys the
  operator must mint) driven straight from the checklist's creds column.
- Transports the operator declines to prove must carry an explicit `waived` row — silence
  is not a state.
