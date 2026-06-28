# ADR-0075 — Observability: base EventSink port + shared schemas; audit-chain stays separate

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Owns the unowned cross-cutting
observability seam before three editions invent their own event shapes.)

The kernel ships a typed error model (ADR-0019) but **no structured-event emission port**; the only
durable log today is the tamper-evident audit chain (ADR-0052), which is compliance evidence, not
operational telemetry. Left unowned, every edition (Compliance · AI Production Kit · Local-first AI ·
Agentic-Dev) would invent its own event shape — blocking any cross-edition P6 dashboard and
re-litigating ADR-0019 redaction per edition.

## Decision

A single base **`EventSink` port** (logs → OTel / Postgres) is the one contract **every edition emits
operational telemetry through**, and the operational SCHEMAS live in **one shared base home** so the
P6 dashboard, docs, and support bot read **one contract**. This **adds the structured-event port the
kernel lacks — it ships only an error model (ADR-0019), never a telemetry emitter.**

- **One base port, down-only.** `EventSink` lives in base (`@caisson/kernel`) per ADR-0003 — editions
  emit _into_ it, never the reverse. Spend, latency, eval scores, guardrail blocks, and generation
  events all cross this single seam; no edition wires its own logger or coins its own event shape.
- **One transport seam.** Default backing is **OTel → Postgres** (the ADR-0014 Neon spine; OTel
  GenAI semconv wire shape). The port is swappable, so a buyer repoints the backend without touching
  any emit site.
- **Shared schemas in base.** The **evidence-pack** (P2), **usage-metering** (P3), and **eval-result**
  (P3) schemas live in the shared base home, Zod-`.strict()` — the P6 dashboard/docs/bot consume
  exactly one typed contract, not three edition-local ones.
- **Redaction once, at the sink.** ADR-0019's allowlist/redaction discipline applies **at the sink,
  one time** (no SQL, no stack, no secret in an event) and is **not re-litigated per edition.**
- **Audit-chain stays strictly separate.** The tamper-evident WORM audit-chain (ADR-0052) is **NOT**
  this sink. Compliance immutability + retention is a **different trust and retention model** than
  mutable, drop-able ops logs; the two never share a store or a write path. A guardrail/audit _event_
  may be emitted to the EventSink for the dashboard, but the **evidentiary** record is the separate
  append-only chain — they are never interchangeable.

## Rejected

- **Each edition logs ad hoc** — three editions inventing their own event shapes blocks any
  cross-edition P6 dashboard and forces ADR-0019 redaction to be re-decided in every edition. The
  exact failure the kernel's missing emission port left open.
- **One unified sink that also carries the audit-chain** — conflates immutable compliance evidence
  with mutable operational telemetry: it drags WORM retention + tamper-evidence onto hot ops logs
  (or, worse, weakens the chain to ops-grade). The trust models are incompatible; keep them split.

## Binding

Every edition emits operational telemetry — spend, latency, eval scores, guardrail blocks, generation
events — through the single base `EventSink` port (OTel → Postgres, swappable); the evidence-pack,
usage-metering, and eval-result schemas live in one shared base home read by the P6 dashboard/docs/bot;
ADR-0019 redaction is applied once at the sink, never re-litigated per edition; and the ADR-0052 WORM
audit-chain stays strictly separate — future code MUST NOT route compliance evidence through the
EventSink or operational telemetry through the audit-chain. The port and schemas are base and
fully-commercial like every package (ADR-0023; Local-first AI is no longer an exception — ADR-0050).
Evidence: ADR-0019 (typed error model + redaction-allowlist discipline reused at the sink), ADR-0052
(WORM audit-chain kept separate), ADR-0003 (base port down-only, no up-dependency), ADR-0014
(Neon/Postgres spine), ADR-0023/0050 (uniform fully-commercial licensing); the kernel error-model
seam (`errors.ts`, no emission port today) + the typed guardrail-decision event bus; research
artifact `outputs/research/wave1-forks.md` (fork X-5).
