import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep module doubles in an isolated runner: Bun module mocks otherwise affect sibling suites.
test("production checkout account failure and dashboard compatibility", () => {
  const result = spawnSync(
    process.execPath,
    ["test", "--timeout", "60000", "./test-fixtures/checkout-account.test.ts"],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (result.status !== 0)
    throw new Error(`${result.stdout}\n${result.stderr}`);
  expect(result.status).toBe(0);
  expect(result.stderr).toContain("8 pass");
  expect(result.stderr).toContain("0 fail");
}, 65000);
