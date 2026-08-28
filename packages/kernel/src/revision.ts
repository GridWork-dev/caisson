// The serving revision: which commit the running process was built from.
//
// WHY THIS EXISTS: nothing in the fleet reported it, and "which code is actually running" was
// therefore only ever answerable by behavioural probing — inferring the build from how a route
// responded. That inference is wrong often enough to matter: two separate 2026-08-26 readings of
// live services (one predicting a module-load failure that did not happen, one hypothesising a
// stale revision that was in fact current) were each settled only after a chain of probes, and a
// header would have settled both in one request.
//
// DELIVERY (the constraint that shapes this file): a Railway CLI upload carries no git ref.
// `RAILWAY_GIT_COMMIT_SHA` is populated only for repo-triggered builds, and every deploy in this
// fleet goes through `tooling/scripts/railway-deploy.ts`, which uploads a `git archive` staging
// tree. So the sha cannot arrive as a platform variable — it has to travel INSIDE the uploaded
// tree. `.caisson-revision` at the repo root is that carrier: committed holding `unknown` so the
// file always exists (an unconditional Dockerfile COPY needs no glob and no fallback), and
// overwritten in the staging directory with the resolved sha on the way to `railway up`.
//
// A build that did not come through that path — a local `docker build`, a `bun test`, a dev
// server — therefore reports `unknown`, which is the truthful answer rather than a guess.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Response header carrying the serving revision. Lower-case: it is compared against
 *  `Headers.get()` output, which normalizes, and written into plain object literals that do not. */
export const REVISION_HEADER = "x-caisson-revision";

/** Reported when the carrier file is absent, unreadable, or does not hold a full commit sha. */
export const UNKNOWN_REVISION = "unknown";

/** The repo-root carrier written by `tooling/scripts/railway-deploy.ts`. */
export const REVISION_FILENAME = ".caisson-revision";

/** A full 40-char lowercase hex commit sha, and nothing else. */
const COMMIT_SHA = /^[0-9a-f]{40}$/;

/**
 * Parse the carrier's contents. Anything that is not a full commit sha — the committed `unknown`
 * placeholder, an empty file, a truncated write, a stray editor newline around junk — collapses to
 * `UNKNOWN_REVISION`. Deliberately strict: a header that reports a half-written or non-sha value is
 * worse than one that admits it does not know, because the whole point is that a reader can trust
 * it without cross-checking. `null` means the file could not be read at all.
 */
export function parseRevision(raw: string | null): string {
  if (raw === null) return UNKNOWN_REVISION;
  const trimmed = raw.trim();
  return COMMIT_SHA.test(trimmed) ? trimmed : UNKNOWN_REVISION;
}

/**
 * Where to look for the carrier. `CAISSON_REVISION_PATH` wins when set, mirroring the
 * `CAISSON_REGISTRY_INDEX_PATH` convention this repo already uses for the same reason: a Next
 * `standalone` server runs `process.chdir(__dirname)` on boot, so its cwd is `/app/apps/<name>`
 * and a cwd-relative lookup would miss a repo-root file. Services whose cwd IS the repo root
 * (docs, license) need no override and fall through to the cwd-relative path.
 */
export function revisionFilePath(
  environment: Record<string, string | undefined>,
  cwd: string,
): string {
  const override = environment.CAISSON_REVISION_PATH?.trim();
  return override !== undefined && override !== ""
    ? override
    : join(cwd, REVISION_FILENAME);
}

/**
 * Read the carrier once. Exported for tests; production callers want the memoized
 * `servingRevision()` below.
 */
export function readRevision(
  environment: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): string {
  try {
    return parseRevision(
      readFileSync(revisionFilePath(environment, cwd), "utf8"),
    );
  } catch {
    // A missing or unreadable carrier is a normal state (local build, test run) — never an error
    // worth failing a response over. The header simply reports `unknown`.
    return UNKNOWN_REVISION;
  }
}

let memoized: string | undefined;

/**
 * The serving revision for this process. Memoized: the answer cannot change for the lifetime of a
 * process, and this is called on every response.
 */
export function servingRevision(): string {
  memoized ??= readRevision();
  return memoized;
}

/** Test-only: drop the memoized value so a following `servingRevision()` re-reads. */
export function resetServingRevisionCache(): void {
  memoized = undefined;
}
