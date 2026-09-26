// src/snapshot.test.ts — the MembershipSnapshot port + adapter parity (ADR-0371).
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  createCsvMembershipSnapshotSource,
  createInMemoryMembershipSnapshotSource,
  createJsonMembershipSnapshotSource,
} from "./snapshot.ts";

describe("MembershipSnapshotSource adapters — port parity", () => {
  test("the CSV adapter and a direct in-memory implementation produce identical campaign inputs", () => {
    const csv = "reviewee_id\nuser-1\nuser-2\nuser-3\n";
    const csvSource = createCsvMembershipSnapshotSource(csv, "reviewer-9");
    const memorySource = createInMemoryMembershipSnapshotSource({
      reviewerId: "reviewer-9",
      reviewees: ["user-1", "user-2", "user-3"],
    });
    expect(csvSource.read()).toEqual(memorySource.read());
  });

  test("the JSON adapter agrees with the same roster too", () => {
    const json = JSON.stringify({
      reviewerId: "reviewer-9",
      reviewees: ["user-1", "user-2", "user-3"],
    });
    const jsonSource = createJsonMembershipSnapshotSource(json);
    const memorySource = createInMemoryMembershipSnapshotSource({
      reviewerId: "reviewer-9",
      reviewees: ["user-1", "user-2", "user-3"],
    });
    expect(jsonSource.read()).toEqual(memorySource.read());
  });

  test("blank lines in the CSV are skipped, never counted as a reviewee", () => {
    const csv = "reviewee_id\nuser-1\n\nuser-2\n";
    const source = createCsvMembershipSnapshotSource(csv, "reviewer-9");
    expect(source.read().reviewees).toEqual(["user-1", "user-2"]);
  });

  test("a missing/misnamed CSV header refuses fail-closed", () => {
    expect(() =>
      createCsvMembershipSnapshotSource("id\nuser-1\n", "reviewer-9"),
    ).toThrow(ValidationError);
  });

  test("malformed JSON refuses fail-closed", () => {
    expect(() => createJsonMembershipSnapshotSource("{not json")).toThrow(
      ValidationError,
    );
  });

  test("a duplicate reviewee id refuses fail-closed, never silently deduped", () => {
    expect(() =>
      createInMemoryMembershipSnapshotSource({
        reviewerId: "reviewer-9",
        reviewees: ["user-1", "user-1"],
      }),
    ).toThrow(ValidationError);
  });

  test("an empty roster refuses fail-closed", () => {
    expect(() =>
      createCsvMembershipSnapshotSource("reviewee_id\n", "reviewer-9"),
    ).toThrow(ValidationError);
  });
});
