import { describe, expect, it } from "bun:test";

import {
  isUnavailableReason,
  isValidDemoProject,
  isValidEmail,
} from "./validation";

describe("demo-run input gates", () => {
  it("accepts a well-formed project slug", () => {
    expect(isValidDemoProject("my-app")).toBe(true);
    expect(isValidDemoProject("caisson-demo-1")).toBe(true);
  });

  it("rejects uppercase, spaces, path-ish, empty, and over-long slugs", () => {
    expect(isValidDemoProject("My-App")).toBe(false);
    expect(isValidDemoProject("my app")).toBe(false);
    expect(isValidDemoProject("../etc")).toBe(false);
    expect(isValidDemoProject("-lead")).toBe(false);
    expect(isValidDemoProject("")).toBe(false);
    expect(isValidDemoProject("a".repeat(41))).toBe(false);
  });

  it("accepts a plausible email and rejects junk / over-long", () => {
    expect(isValidEmail("you@company.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@b.com`)).toBe(false);
  });

  it("narrows only the two known 503 reasons — junk is fail-safe (not a reason)", () => {
    expect(isUnavailableReason("daily-cap")).toBe(true);
    expect(isUnavailableReason("disabled")).toBe(true);
    expect(isUnavailableReason("open")).toBe(false);
    expect(isUnavailableReason(undefined)).toBe(false);
    expect(isUnavailableReason(null)).toBe(false);
  });
});
