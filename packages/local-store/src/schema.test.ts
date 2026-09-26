// Unit tests for the memory-item boundary schema (ADR-0067 / ADR-0002). Proves the `.strict()`
// boundary: valid input parses, the scope default fills the tenancy seam, and unknown keys / empty
// text / non-UUID id / non-integer timestamps are rejected as a redaction-safe `ValidationError`.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { DEFAULT_SCOPE, parseMemoryItem } from "./schema.ts";

const validId = "00000000-0000-4000-8000-000000000000";

describe("memory-item boundary schema (ADR-0067)", () => {
  test("parses a valid item and fills the single-developer-local scope default", () => {
    const item = parseMemoryItem({
      id: validId,
      text: "a note",
      createdAt: 1_700_000_000_000,
    });
    expect(item.scope).toBe(DEFAULT_SCOPE);
    expect(item.text).toBe("a note");
    expect(item.expiresAt).toBeUndefined();
  });

  test("keeps an explicit scope + optional fields", () => {
    const item = parseMemoryItem({
      id: validId,
      text: "scoped",
      scope: "project:caisson",
      createdAt: 1,
      expiresAt: 2,
      metadata: { source: "cli" },
    });
    expect(item.scope).toBe("project:caisson");
    expect(item.metadata).toEqual({ source: "cli" });
  });

  test("rejects an unknown sibling key (strict boundary)", () => {
    expect(() =>
      parseMemoryItem({
        id: validId,
        text: "x",
        createdAt: 1,
        embedding: [1, 2, 3],
      }),
    ).toThrow(ValidationError);
  });

  test("rejects empty text, a non-UUID id, and a non-integer createdAt", () => {
    expect(() =>
      parseMemoryItem({ id: validId, text: "", createdAt: 1 }),
    ).toThrow(ValidationError);
    expect(() =>
      parseMemoryItem({ id: "not-a-uuid", text: "x", createdAt: 1 }),
    ).toThrow(ValidationError);
    expect(() =>
      parseMemoryItem({ id: validId, text: "x", createdAt: 1.5 }),
    ).toThrow(ValidationError);
  });
});
