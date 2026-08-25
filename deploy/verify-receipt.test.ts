import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

const script = new URL("./verify-receipt.ts", import.meta.url).pathname;

function runReceiptVerification(
  submitted: string | undefined,
  expected: string | undefined,
) {
  const env = { ...process.env };
  delete env.RECEIPT;
  delete env.PROD_DEPLOY_RECEIPT;
  if (submitted !== undefined) env.RECEIPT = submitted;
  if (expected !== undefined) env.PROD_DEPLOY_RECEIPT = expected;

  return Bun.spawnSync([process.execPath, script], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
}

function stderr(result: ReturnType<typeof runReceiptVerification>): string {
  return new TextDecoder().decode(result.stderr);
}

describe("production deploy receipt", () => {
  test("rejects an unset or undersized production receipt", () => {
    const submitted = randomBytes(32).toString("base64url");
    const unset = runReceiptVerification(submitted, undefined);
    expect(unset.exitCode).toBe(1);
    expect(stderr(unset)).toContain(
      "PROD_DEPLOY_RECEIPT is unset or shorter than 32 characters",
    );

    const short = randomBytes(8).toString("base64url");
    const undersized = runReceiptVerification(short, short);
    expect(undersized.exitCode).toBe(1);
    expect(stderr(undersized)).toContain(
      "PROD_DEPLOY_RECEIPT is unset or shorter than 32 characters",
    );
  });

  test("treats trailing whitespace as part of the receipt", () => {
    const expected = randomBytes(32).toString("base64url");
    const result = runReceiptVerification(`${expected} `, expected);
    expect(result.exitCode).toBe(1);
    expect(stderr(result)).toContain(
      "receipt does not match; production deploy refused",
    );
  });

  test("accepts an exact sufficiently long receipt", () => {
    const expected = randomBytes(32).toString("base64url");
    const result = runReceiptVerification(expected, expected);
    expect(result.exitCode).toBe(0);
    expect(stderr(result)).toBe("");
  });
});
