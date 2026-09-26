// src/schema.ts — the memory-item BOUNDARY schema (ADR-0067 · ADR-0002 `.strict()` boundary). A
// memory item is the untrusted record a consumer hands the store to index + (optionally) embed; this
// is the one place its shape is validated. Unknown keys are rejected (not silently dropped), strings
// are bounded, ids are UUIDs, and a parse failure surfaces as a redaction-safe `ValidationError`
// (never the rejected values). Engine-neutral: this is the record STRUCTURE, never a model binding.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";

/** Bound the indexed text — no unbounded string reaches the store (ADR-0002 boundary discipline). */
const MAX_TEXT = 100_000;
/** Bound the scope label — the tenancy-seam partition key, kept short and pattern-free. */
const MAX_SCOPE = 256;

/** The default tenancy partition: single-developer-local (ADR-0067; no `tenancy-rls` dep here). */
export const DEFAULT_SCOPE = "local";

/**
 * A memory item — the boundary record indexed (and optionally embedded) by the store.
 *
 * `scope` is the single-developer-local tenancy SEAM: today a free label that partitions recall
 * within ONE file-per-tenant DB (ADR-0073 — the resolved DB path is the hard isolation boundary);
 * when multi-tenant RLS lands it becomes the row-scoped predicate. There is deliberately NO
 * `tenancy-rls` dependency here (ADR-0067) — the seam is documented, not yet wired.
 */
export const MemoryItemSchema = strictObject({
  /** Stable id — a caller `crypto.randomUUID()` (ADR-0002: IDs are UUIDs). */
  id: z.string().uuid(),
  /** The content to index/embed. Non-empty + bounded. */
  text: z.string().min(1).max(MAX_TEXT),
  /** Tenancy/recall partition label; absent ⇒ the single-developer-local default. */
  scope: z.string().min(1).max(MAX_SCOPE).default(DEFAULT_SCOPE),
  /** Epoch-ms creation time — integer (the TTL/GC decay basis the GC default reads). */
  createdAt: z.number().int().nonnegative(),
  /** Optional epoch-ms expiry horizon; absent ⇒ no expiry. Integer ms. */
  expiresAt: z.number().int().nonnegative().optional(),
  /** Optional flat string→string tags; the strict top level still rejects unknown sibling keys. */
  metadata: z
    .record(z.string().max(MAX_SCOPE), z.string().max(MAX_TEXT))
    .optional(),
});

/** A parsed, boundary-valid memory item (`scope` always present after the default fills in). */
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

/** Parse an untrusted memory item, throwing a redaction-safe `ValidationError` (ADR-0002). */
export function parseMemoryItem(input: unknown): MemoryItem {
  return parseStrict(MemoryItemSchema, input);
}
