// Unit tests for the WORM retention floor (ADR-0054). Deterministic, UTC, no I/O: the default term
// is the conservative floor, an override extends it, a below-floor term fails closed, and a Feb-29
// anchor rolls FORWARD (never shorter) in a non-leap target year.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  DEFAULT_RETENTION_YEARS,
  MIN_RETENTION_YEARS,
  retainUntilFrom,
} from "./retain.ts";

describe("retainUntilFrom (ADR-0054 WORM floor)", () => {
  test("defaults to the conservative floor term past the anchor", () => {
    const anchor = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    const until = retainUntilFrom(anchor);
    expect(until.getUTCFullYear()).toBe(2026 + DEFAULT_RETENTION_YEARS);
    expect(until.getUTCMonth()).toBe(0);
    expect(until.getUTCDate()).toBe(1);
    expect(until.getTime()).toBeGreaterThan(anchor.getTime());
  });

  test("an explicit term longer than the floor is honoured exactly", () => {
    const anchor = new Date(Date.UTC(2020, 5, 15));
    const until = retainUntilFrom(anchor, 10);
    expect(until.getUTCFullYear()).toBe(2030);
    expect(until.getUTCMonth()).toBe(5);
    expect(until.getUTCDate()).toBe(15);
  });

  test("a term below the floor fails closed (never auto-extended)", () => {
    const anchor = new Date(Date.UTC(2026, 0, 1));
    expect(() => retainUntilFrom(anchor, MIN_RETENTION_YEARS - 1)).toThrow(
      ValidationError,
    );
  });

  test("a non-integer term is rejected", () => {
    expect(() => retainUntilFrom(new Date(), 6.5)).toThrow(ValidationError);
  });

  test("an invalid anchor date is rejected", () => {
    expect(() => retainUntilFrom(new Date("not-a-date"))).toThrow(
      ValidationError,
    );
  });

  test("a Feb-29 anchor rolls forward to Mar-1 in a non-leap target (never shorter)", () => {
    const leapAnchor = new Date(Date.UTC(2024, 1, 29)); // 2024-02-29
    const until = retainUntilFrom(leapAnchor, 7); // 2031 is not a leap year
    expect(until.getUTCFullYear()).toBe(2031);
    expect(until.getUTCMonth()).toBe(2); // March
    expect(until.getUTCDate()).toBe(1);
    expect(until.getTime()).toBeGreaterThan(leapAnchor.getTime());
  });

  test("the floor is at or below the default (the default never violates the floor)", () => {
    expect(DEFAULT_RETENTION_YEARS).toBeGreaterThanOrEqual(MIN_RETENTION_YEARS);
  });
});
