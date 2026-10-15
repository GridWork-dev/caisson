import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(
  new URL("../dist/create-caisson.js", import.meta.url),
);

test("the built bin runs the generator and prints its help", async () => {
  const proc = Bun.spawn([process.execPath, bin, "--help"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, code] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  expect(code).toBe(0);
  expect(out).toContain("create-caisson");
});
