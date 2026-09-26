// src/snapshot.ts — the MembershipSnapshot import port (ADR-0371).
//
// Same shape discipline as @caisson-sh/compliance-core's EvidenceCollector
// (src/evidence/collector.ts): `read()` is a PURE, already-parsed return — no I/O, no clock.
// Whatever I/O a real source needs (reading a file, calling an API) happens at the EDGE, before
// the adapter is constructed; the adapter itself only validates the already-gathered content
// against `membershipSnapshotSchema` and hands back the typed snapshot. That keeps every adapter
// unit-testable with no live import system, and keeps `openCampaign` itself agnostic to where the
// roster came from.
//
// v2 milestone (named, not built — see README "Roadmap"): a GitHub org/team connector
// implementing this SAME port. Out of scope here; no live IdP/SaaS connector ships in this package.
import { parseStrict, ValidationError } from "@caisson-sh/kernel";
import { membershipSnapshotSchema, type MembershipSnapshot } from "./schema.ts";

/** A typed source of ONE reviewer's membership roster. `id` names the adapter (surfaced in
 *  logs/errors, never parsed); `read()` returns the validated snapshot or throws
 *  `ValidationError`. Every adapter below is a trivial, structurally-identical implementation of
 *  this one port — the port test proves the CSV and in-memory forms agree byte-for-byte. */
export interface MembershipSnapshotSource {
  readonly id: string;
  read(): MembershipSnapshot;
}

/** The trivial case — an already-typed snapshot, validated at construction time. */
export function createInMemoryMembershipSnapshotSource(
  snapshot: MembershipSnapshot,
): MembershipSnapshotSource {
  const parsed = parseStrict(membershipSnapshotSchema, snapshot);
  return { id: "in-memory", read: () => parsed };
}

/** Parses an already-read JSON string (`{ reviewerId, reviewees }`) into the port. */
export function createJsonMembershipSnapshotSource(
  json: string,
): MembershipSnapshotSource {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new ValidationError(
      `access-review: malformed JSON membership snapshot (${(e as Error).message})`,
    );
  }
  const parsed = parseStrict(membershipSnapshotSchema, raw);
  return { id: "json", read: () => parsed };
}

/** Parses an already-read CSV string: a single `reviewee_id` header column, one reviewee id per
 *  row. The reviewer is supplied out of band (a CSV export is per-reviewer, not self-describing)
 *  — the one place this adapter's inputs differ from the JSON/in-memory form. Blank lines are
 *  skipped; anything else malformed fails closed through the schema, never silently coerced. */
export function createCsvMembershipSnapshotSource(
  csv: string,
  reviewerId: string,
): MembershipSnapshotSource {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const header = lines[0];
  if (header?.toLowerCase() !== "reviewee_id") {
    throw new ValidationError(
      `access-review: CSV membership snapshot must open with a "reviewee_id" header (got ${JSON.stringify(header ?? "")})`,
    );
  }
  const reviewees = lines
    .slice(1)
    .map((line) => line.split(",")[0]?.trim() ?? "");
  const parsed = parseStrict(membershipSnapshotSchema, {
    reviewerId,
    reviewees,
  });
  return { id: "csv", read: () => parsed };
}
