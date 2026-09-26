// The shared observability schemas (ADR-0075). The ONE base home for the three operational record
// shapes the adopter dashboard, docs, and support bot read — so no edition (Compliance · AI Production
// Kit · Local-first AI · Agentic-Dev) coins its own. All `.strict()`: unknown fields are rejected at
// the boundary. Money/credit quantities are integers (ADR-0007); timestamps are ISO-8601.
//
// These are TELEMETRY shapes carried over the EventSink (ADR-0075), not the WORM audit-chain
// (ADR-0052) — the evidentiary record stays on the separate append-only chain.
import { z } from "zod";
import { strictObject } from "./schema.ts";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Evidence-pack (P2 Compliance). A bundle of attested artifacts for a control, pinned to the WORM
 * audit-chain tip that anchors them — the dashboard reads this shape, the evidence itself stays in
 * the chain + WORM ArtifactStore (ADR-0052).
 */
export const evidencePackSchema = strictObject({
  packId: z.string().uuid(),
  tenantId: z.string().min(1).max(200),
  controlId: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  artifacts: z.array(
    strictObject({
      artifactId: z.string().min(1).max(200),
      kind: z.enum(["document", "screenshot", "log", "attestation"]),
      sha256: z.string().regex(SHA256_HEX),
    }),
  ),
  /** The audit-chain tip hash anchoring this pack (binds the pack to the evidentiary chain). */
  chainTipHash: z.string().regex(SHA256_HEX),
});

/**
 * Usage-metering (P3 AI Production Kit). One metered unit of consumption against a registered
 * feature tag (ADR-0074). `quantity` is an integer unit (ADR-0007); `idempotencyKey` keys the
 * dedup so a replayed meter never double-counts.
 */
export const usageMeteringSchema = strictObject({
  tenantId: z.string().min(1).max(200),
  feature: z.string().min(1).max(200),
  unit: z.enum(["credit", "token", "request", "second"]),
  quantity: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
  idempotencyKey: z.string().min(1).max(200),
});

/**
 * Eval-result (P3 AI Production Kit). The outcome of one eval-suite run — the gate the AI tag's
 * fail-stop reads. `score` is normalized 0..1; case counts are integers.
 */
export const evalResultSchema = strictObject({
  evalId: z.string().uuid(),
  suite: z.string().min(1).max(200),
  model: z.string().min(1).max(200),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  caseCount: z.number().int().nonnegative(),
  failedCases: z.number().int().nonnegative(),
  ranAt: z.string().datetime(),
});

/**
 * Guardrail-block (P3 AI Production Kit). One block raised by the guardrails layer (ADR-0063) when
 * a `Moderator`/PII/secret/custom check trips at the gateway's input or output point — the dashboard
 * reads it to chart block rate by stage and category. **Metadata only**: the flagged content,
 * matched text, and any PII/secret span are NEVER carried here — emitting them would defeat the very
 * redaction the guard exists to enforce. `failClosed` marks a block produced by the fail-closed
 * default (a moderator timeout/outage or a custom hook that threw) rather than an explicit policy
 * hit, so an operator can distinguish "the moderator was unavailable so we blocked" from "the content
 * actually violated policy". `policy` is the `forge.config` policy name that produced the block,
 * never its content. `"secret"` (ADR-0215) is the unconditional credential-shape pre-screen — it has
 * no `failOpen` opt-out, so it always reports `failClosed: false`.
 */
export const guardrailBlockSchema = strictObject({
  blockId: z.string().uuid(),
  tenantId: z.string().min(1).max(200),
  /** Where the block fired: the input-moderate leg or the output-moderate leg. */
  stage: z.enum(["input", "output"]),
  /** The violation class. An edition selects from this fixed set — it never coins its own. */
  category: z.enum(["moderation", "pii", "injection", "secret", "custom"]),
  policy: z.string().min(1).max(200),
  failClosed: z.boolean(),
  occurredAt: z.string().datetime(),
});

export type EvidencePack = z.infer<typeof evidencePackSchema>;
export type UsageMetering = z.infer<typeof usageMeteringSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;
export type GuardrailBlock = z.infer<typeof guardrailBlockSchema>;
