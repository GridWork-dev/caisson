// src/redacting-logger.ts — secret-redacting structured JSONL event logger (ADR-0229 row 40,
// telesis `logs.py` origin). Pure, dependency-free: COMPOSES kernel's `scrubDeep` (regex-alternation
// credential-span redaction over every string leaf + PHI/secret-named subtree drop) over a
// structured event BEFORE serializing it to one JSON Lines record. Intended as the default
// redaction pass any agent-kernel audit-trail event (`audit-lifecycle.ts`'s `LifecycleAuditPayload`,
// or any host-defined event shape) runs through before it reaches a persisted sink.
//
// No fs/console import: the HOST supplies the write sink (the same read/write-seam DI shape as
// `AuditLifecycleStore` in `audit-lifecycle.ts`) — this module only redacts + shapes the line.
import { scrubDeep } from "@caisson-sh/kernel";

/** A JSONL sink: appends one already-newline-terminated line. Sync or async; the caller awaits both. */
export type JsonlSink = (line: string) => void | Promise<void>;

/**
 * Redact `event` via {@link scrubDeep} (leaf credential-span redaction + PHI/secret-key-named
 * subtree drop) and serialize the result to one JSON Lines record: a single `JSON.stringify` line
 * terminated with `\n`. Pure — never writes, never mutates `event`. `bigint` leaves (counts,
 * sequence ids, DB numerics) serialize as decimal strings — `JSON.stringify` would otherwise
 * throw, and a logger that rejects an event over a count defeats its purpose.
 */
export function toRedactedJsonlLine(event: Record<string, unknown>): string {
  const line = JSON.stringify(scrubDeep(event), (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return `${line}\n`;
}

/**
 * Build a logger: `log(event)` redacts `event` (via {@link toRedactedJsonlLine}) and hands the
 * resulting JSONL line to `sink`. This is the default redaction pass before any agent-kernel
 * audit-trail event is persisted — wire `sink` to append to a file, a WORM writer, or any other
 * append-only store.
 */
export function makeRedactingLogger(
  sink: JsonlSink,
): (event: Record<string, unknown>) => Promise<void> {
  return async function log(event: Record<string, unknown>): Promise<void> {
    await sink(toRedactedJsonlLine(event));
  };
}
