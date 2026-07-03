import { describe, expect, test } from "bun:test";
import { ConflictError } from "./errors.ts";
import { assertNotReadOnly } from "./read-only.ts";

describe("assertNotReadOnly", () => {
  test("is a no-op when the system is active", () => {
    expect(() => assertNotReadOnly("active")).not.toThrow();
    expect(() => assertNotReadOnly("active", "grant credits")).not.toThrow();
    expect(assertNotReadOnly("active")).toBeUndefined();
  });

  test("throws ConflictError (409) when read_only — fail closed", () => {
    expect(() => assertNotReadOnly("read_only")).toThrow(ConflictError);
  });

  test("the thrown error carries the action in its message and details", () => {
    try {
      assertNotReadOnly("read_only", "grant credits");
      throw new Error("expected assertNotReadOnly to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      const e = err as ConflictError;
      expect(e.httpStatus).toBe(409);
      expect(e.message).toContain("grant credits");
      expect(e.details).toEqual({ action: "grant credits" });
    }
  });

  test("omitting the action still throws, with no action detail", () => {
    try {
      assertNotReadOnly("read_only");
      throw new Error("expected assertNotReadOnly to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).details).toBeUndefined();
    }
  });
});
