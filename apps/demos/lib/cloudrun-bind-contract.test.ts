import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("demos Cloud Run bind contract", () => {
  test("pins a portable bind instead of Docker's container-id hostname", () => {
    const dockerfile = readFileSync(
      resolve(import.meta.dir, "../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).not.toContain("HOSTNAME=::");
  });
});
