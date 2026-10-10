import { describe, expect, test } from "bun:test";
import { detectSecretShape } from "./detect-shapes.ts";

// Assembled from parts, so this file holds no literal private-key header: the repository's leak
// scan reads one as a leaked key.
const PEM_LABEL = "PRIVATE KEY";

describe("detectSecretShape", () => {
  test("clean text is undefined", () => {
    expect(
      detectSecretShape(
        "export function add(a: number, b: number) { return a + b; }",
      ),
    ).toBeUndefined();
  });

  test("catches a PEM private-key block", () => {
    expect(
      detectSecretShape(
        `-----BEGIN ${PEM_LABEL}-----\nabc\n-----END ${PEM_LABEL}-----`,
      ),
    ).toBe("PEM private-key block");
  });

  test("catches a URL userinfo password", () => {
    expect(detectSecretShape("postgres://user:hunter2@host/db")).toBe(
      "URL userinfo password",
    );
  });

  test("catches an AWS access-key id", () => {
    expect(detectSecretShape("AKIAIOSFODNN7EXAMPLE")).toBe("AWS access-key id");
  });

  test("catches a GitHub token", () => {
    expect(detectSecretShape("ghp_" + "a".repeat(36))).toBe("GitHub token");
  });

  test("catches an OpenAI secret key", () => {
    expect(detectSecretShape("sk-" + "a".repeat(20))).toBe("OpenAI secret key");
  });

  test("catches a JWT", () => {
    expect(
      detectSecretShape("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123"),
    ).toBe("JWT");
  });

  test("catches a secret-named assignment", () => {
    expect(detectSecretShape("API_KEY=abc123")).toBe("secret-named assignment");
  });
});
