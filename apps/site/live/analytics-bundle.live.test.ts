// live/analytics-bundle.live.test.ts — the LIVE analytics-inlining proof (ADR-0224 / ADR-0118).
// The Plausible init component reads NEXT_PUBLIC_* at build time; Next inlines those
// values into the client JS at `next build`, so there is no server call to intercept and no
// double to swap. The one thing a rotation breaks — the env value actually reaching the shipped
// bundle — is provable only by building with the envs set and grepping the built client chunks.
// This build-grep leg covers only that (provider-side INGESTION stays dashboard-verified; only
// Plausible can confirm receipt, so that half is out of the harness).
//
// ADR-0201 convention: lives OUTSIDE ./lib (default suite `bun test ./lib` / CI / tarball never see
// it) AND self-skips unless the analytics env is set. Running leg builds apps/site (heavy — a full
// `next build`), so it is gated behind the same env presence the components require.
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";
const HAVE_CREDS = PLAUSIBLE_DOMAIN.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const BUILD_TIMEOUT = 600_000; // a cold `next build` of apps/site can take minutes

const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_DIR = join(SITE_DIR, ".next", "static");

/** Every `.js` file under .next/static (the client bundle Next serves to the browser). */
function clientChunks(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...clientChunks(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

/** True if any client chunk contains `needle` (the inlined env value or init marker). */
function bundleContains(chunks: string[], needle: string): boolean {
  return chunks.some((f) => readFileSync(f, "utf8").includes(needle));
}

describe("analytics bundle-inlining live proof — NEXT_PUBLIC_* reaches the client (ADR-0224)", () => {
  liveTest(
    "a build with the analytics env inlines the Plausible domain into the client bundle",
    () => {
      // Build with the current process env (the operator's launch env carries NEXT_PUBLIC_*). Arg-array
      // execFile per the security floor — no shell, no interpolation of the env values.
      execFileSync("bun", ["run", "build"], {
        cwd: SITE_DIR,
        env: process.env,
        stdio: "inherit",
      });

      const chunks = clientChunks(STATIC_DIR);
      expect(chunks.length).toBeGreaterThan(0);

      // The load-bearing assertion: the rotated env values are baked into the shipped client JS. A
      // rotated key that never got mirrored into the build env fails HERE, before it fails in prod.
      expect(bundleContains(chunks, PLAUSIBLE_DOMAIN)).toBe(true);

      // The init call sites made it in too — proves the components mounted, not just a stray string.
      // plausible-init passes outboundLinks to init().
      expect(bundleContains(chunks, "outboundLinks")).toBe(true);
    },
    BUILD_TIMEOUT,
  );
});
