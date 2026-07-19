// The finding shape a watcher emits (the DB assigns id / seen_count / timestamps on write).
// This is a shape WE own, so it is a strict Zod boundary — the store validates every finding
// before it touches Postgres.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

export const SEVERITIES = ["info", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_SOURCES = [
  "compliance",
  "soc2",
  "competitor",
  "github",
  "analytics",
  "error",
  "dep-digest",
] as const;
export type FindingSource = (typeof FINDING_SOURCES)[number];

export const FindingSchema = strictObject({
  source: z.enum(FINDING_SOURCES),
  kind: z.string().trim().min(1).max(100),
  severity: z.enum(SEVERITIES),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10_000),
  dedupKey: z.string().trim().min(1).max(300),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type Finding = z.infer<typeof FindingSchema>;

/** Validate an emitted finding at our own boundary (title/body length, severity/source enum,
 *  unknown keys rejected) before it reaches Postgres. Throws a redaction-safe ValidationError. */
export function parseFinding(finding: Finding): Finding {
  return parseStrict(FindingSchema, finding);
}

/** Build a stable dedup key from a source + parts. Parts are lowercased and any run of
 *  non-`[a-z0-9]` collapses to a single `-`, so the same logical signal always keys the same. */
export function dedupKey(source: FindingSource, ...parts: string[]): string {
  const tail = parts
    .map((p) =>
      p
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter((p) => p.length > 0)
    .join(":");
  return tail.length > 0 ? `${source}:${tail}` : source;
}
