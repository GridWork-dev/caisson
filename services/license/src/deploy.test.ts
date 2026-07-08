// deploy.test.ts — the deploy entrypoint must FAIL CLOSED when DATABASE_URL is unset (a production
// issuer never falls back to an in-memory double the way apps/site's dev getDb does). Spawns the
// real entrypoint with a scrubbed env so the guard is exercised end-to-end, not mocked.
import { expect, setDefaultTimeout, test } from "bun:test";

// Spawning the real entrypoint crosses bun's 5s default under CI runner load;
// same treatment as the PGlite integration suites.
setDefaultTimeout(30_000);

test("deploy entrypoint aborts when DATABASE_URL is unset", async () => {
  const proc = Bun.spawn(["bun", "run", `${import.meta.dir}/deploy.ts`], {
    // Clean slate — explicitly no DATABASE_URL (env stores it as CAISSON_DATABASE_URL anyway).
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exit = await proc.exited;
  const stderr = await new Response(proc.stderr).text();
  expect(exit).not.toBe(0);
  expect(stderr).toContain("DATABASE_URL is required");
});
