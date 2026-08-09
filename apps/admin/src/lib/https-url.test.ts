import { describe, expect, test } from "bun:test";
import { normalizeHttpsUrl } from "./https-url.ts";

describe("normalizeHttpsUrl", () => {
  test("accepts HTTPS URLs and trims trailing slashes", () => {
    expect(normalizeHttpsUrl(" https://caisson.grafana.net/// ")).toBe(
      "https://caisson.grafana.net",
    );
  });

  test("rejects blank, malformed, and non-HTTPS URLs", () => {
    for (const input of [
      undefined,
      "",
      "not-a-url",
      "http://caisson.grafana.net",
      "javascript:alert(1)",
      "file:///tmp/token",
    ]) {
      expect(normalizeHttpsUrl(input)).toBeNull();
    }
  });
});
