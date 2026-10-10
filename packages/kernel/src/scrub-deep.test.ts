import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { PHI_KEY, scrubDeep } from "./scrub-deep.ts";

// A representative structured-evidence record: PHI keys (snake + camel), secret-named keys, secret
// SPANS inside non-secret-named leaves, clean text, a nested object, an array (order-preserving),
// and non-string primitives. The input→output contract is golden-pinned so it cannot drift.
function sampleEvent(): Record<string, unknown> {
  return {
    patient_email: "jane@example.com", // PHI key (snake) — whole leaf drops
    firstName: "Jane", // PHI key (camel) — drops
    lastName: "Doe", // PHI key — drops
    dateOfBirth: "1980-01-01", // PHI key (camel) — drops
    mrn: "MRN-12345", // PHI key (word-anchored) — drops
    user_dob: "1990-01-01", // PHI key (word-anchored, separator-joined compound) — drops
    employee_mrn: "MRN-67890", // PHI key (word-anchored, separator-joined compound) — drops
    ssn: "111-22-3333", // PHI key — drops
    apiKey: "sk-proj-AAAABBBBCCCCDDDD", // secret-named key — drops
    authorization: "Bearer ghp_0123456789ABCDEFabcdef0123", // secret-named key — drops
    note: "Rotate AKIAIOSFODNN7EXAMPLE now", // clean key, secret SPAN in leaf — span redacted
    message: "Refactor the ranker cleanly.", // clean key + clean leaf — untouched
    nested: {
      patientId: "P-99", // PHI key (substring `patient`) — drops
      connection: "postgres://app:s3cr3t-p4ss@db/main", // clean key, URL password span — redacted
      count: 42, // number — untouched
      active: true, // boolean — untouched
      missing: null, // null — untouched
    },
    // Not the usual `OPENAI_API_KEY`: the redacted assignment lands in the committed golden, where
    // the repository's leak scan reads that literal shape as a credential.
    tags: ["clean", "OPENAI_SECRET_KEY=sk-proj-ZZZZYYYYXXXXWWWW", "plain"], // array order kept; span in leaf redacted
    contactAddress: "742 Evergreen Terrace", // PHI key (substring `address`) — drops
  };
}

describe("scrubDeep", () => {
  test("deep key-name + leaf-span redaction is golden-stable", () => {
    matchGolden(import.meta.url, "scrub-deep", scrubDeep(sampleEvent()));
  });

  test("is idempotent — scrubbing the output again is a no-op", () => {
    const once = scrubDeep(sampleEvent());
    expect(scrubDeep(once)).toEqual(once);
  });

  test("returns a new value and never mutates the input", () => {
    const input = sampleEvent();
    const snapshot = structuredClone(input);
    scrubDeep(input);
    expect(input).toEqual(snapshot);
  });

  test("guards cycles — a self-referential object does not hang", () => {
    const cyclic: Record<string, unknown> = { count: 1, safe: "ok" };
    cyclic.self = cyclic;
    const out = scrubDeep(cyclic) as Record<string, unknown>;
    expect(out.self).toBe("[CIRCULAR]");
    expect(out.count).toBe(1);
    expect(out.safe).toBe("ok");
  });

  test("a node shared by two sibling paths is scrubbed both times (not falsely CIRCULAR)", () => {
    const shared = { note: "leak AKIAIOSFODNN7EXAMPLE here" };
    const out = scrubDeep({ a: shared, b: shared }) as {
      a: { note: string };
      b: { note: string };
    };
    expect(out.a.note).toBe("leak [REDACTED] here");
    expect(out.b.note).toBe("leak [REDACTED] here");
  });

  test("compound dob/mrn keys redact across separator styles; substring false-positives do not", () => {
    const out = scrubDeep({
      member_dob: "1991-02-02", // word-anchored, separator-joined — drops
      mrn_number: "MRN-000", // word-anchored, separator-joined — drops
      adobe: "Adobe Systems", // contains "dob" but not word-anchored — untouched
      description: "a plain description", // no PHI token — untouched
      endobar: "unaffected", // contains "dob" but not word-anchored — untouched
    }) as Record<string, unknown>;
    expect(out.member_dob).toBe("[REDACTED]");
    expect(out.mrn_number).toBe("[REDACTED]");
    expect(out.adobe).toBe("Adobe Systems");
    expect(out.description).toBe("a plain description");
    expect(out.endobar).toBe("unaffected");
  });
});

describe("PHI_KEY", () => {
  test("matches PHI field names, word-anchored tokens do not false-fire", () => {
    for (const hit of [
      "email",
      "dateofbirth",
      "ssn",
      "patient",
      "dob",
      "mrn",
    ]) {
      expect(PHI_KEY.test(hit)).toBe(true);
    }
    // `dob` is word-anchored — `adobe` contains the substring but must not trip it; a plain
    // non-PHI key must not over-match either.
    for (const miss of ["adobe", "description"]) {
      expect(PHI_KEY.test(miss)).toBe(false);
    }
  });
});

// Regression (2026-08-25, sibling of observability audit finding 19d1af0e70d0c2d7): the anchored
// short tokens `dob`/`mrn` could not see a camelCase boundary. `user_dob` worked via the raw arm
// and the golden fixture carries only that snake_case form, so the camelCase hole was invisible.
describe("scrubDeep — camelCase boundaries for anchored PHI tokens", () => {
  test("redacts camelCase dob/mrn keys", () => {
    const out = scrubDeep({
      userDob: "1990-01-01",
      userDOB: "1990-01-01",
      patientMrn: "MRN-1",
    }) as Record<string, unknown>;
    expect(out.userDob).toBe("[REDACTED]");
    expect(out.userDOB).toBe("[REDACTED]");
    expect(out.patientMrn).toBe("[REDACTED]");
  });

  test("keeps the anchors — does not redact adobe/mrna lookalikes", () => {
    const out = scrubDeep({
      adobeVersion: "2024",
      mrnaSequence: "AUG",
      userId: "u1",
    }) as Record<string, unknown>;
    expect(out.adobeVersion).toBe("2024");
    expect(out.mrnaSequence).toBe("AUG");
    expect(out.userId).toBe("u1");
  });

  // The camelCase splitter must stay linear: `([A-Z]+)([A-Z][a-z])` backtracks quadratically on a
  // long all-caps key (~3.4 s at this size), `([A-Z])` runs in ~20 ms. Evidence records carry
  // caller-controlled key names, so this is a DoS on the egress path.
  test("a 64k-char all-caps key scrubs in linear time", () => {
    const key = "A".repeat(64_000);
    const started = Bun.nanoseconds();
    scrubDeep({ [key]: "v" });
    const elapsedMs = (Bun.nanoseconds() - started) / 1e6;
    expect(elapsedMs).toBeLessThan(500);
  });
});
