// registry/scripts/index-parity-probe.ts — the F-1 index-parity probe.
//
// THE RESIDUAL: registry/index.json is baked independently into THREE runtime surfaces — the license
// service image, the deployed registry Worker, and the admin image — plus the git-tracked repo file.
// A republish that rebuilds one but not another opens a stale-accept / new-throw window on entitlement
// expansion (an old baked copy serves a version the new one rejects, or vice versa). This probe
// compares the copies it can reach and exits NONZERO on any drift, so a partial republish is caught.
//
// WHAT EACH LEG PROVES:
//   repo     — the reference: sha256(first-12-hex) of the git-tracked registry/index.json bytes + count.
//   license  — STRONG: GET license.caisson.sh/health returns `indexDigest` (same sha256-12 formula over
//              the bytes the service loaded at boot). Equal ⇒ the license image baked the SAME index.
//   worker   — registry.caisson.sh serves the ANON-FILTERED view (base ∪ entitled), so a raw-byte digest
//              is NOT meaningful. Instead we assert every entry the Worker SERVES exists in the repo
//              index at the SAME `latest` version — i.e. the Worker serves no STALE version of any entry
//              it exposes (the concrete F-1 risk). It does NOT assert anon-COMPLETENESS (the Worker
//              filters by license, so a missing entry may simply be gated, not drifted).
//   admin    — STRONG, same as license: GET admin.caisson.sh/healthz returns `indexDigest` (CAISSON-37,
//              landed once the admin GitHub-OAuth migration — ADR-0283 — merged; /healthz itself is an
//              unauthenticated Railway readiness route, so this leg is externally reachable). Equal ⇒
//              the admin image baked the SAME index.
//
// registry/ is NOT a workspace member, so `@caisson/*` bare specifiers do not resolve here — this file
// uses only relative imports, node built-ins, and zod. `fetchWithTimeout` is inlined for the same
// reason (it mirrors @caisson/kernel's helper: an explicit AbortController, never the Bun-forbidden
// AbortSignal.timeout).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const REGISTRY_DIR = join(import.meta.dir, "..");
const INDEX_PATH = join(REGISTRY_DIR, "index.json");
const WORKER_INDEX_URL = "https://registry.caisson.sh/index.json";
const LICENSE_HEALTH_URL = "https://license.caisson.sh/health";
const ADMIN_HEALTHZ_URL = "https://admin.caisson.sh/healthz";
const FETCH_TIMEOUT_MS = 8000;

/** The parity digest: sha256 of the bytes, first 12 hex chars. Identical to the license service's
 *  boot-time computation (services/license/src/server.ts) so the two are byte-for-byte comparable. */
export function indexDigest12(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/** Loose index shape — only the fields the probe compares; `passthrough` tolerates the rest. */
const IndexShape = z.object({
  schemaVersion: z.number(),
  modules: z
    .array(z.object({ id: z.string(), latest: z.string() }).passthrough())
    .default([]),
});

// Shared by the license (/health) and admin (/healthz) legs — both report the identical shape,
// computed via the identical sha256-first-12-hex formula, so one shape + one comparison function
// serves both.
const IndexDigestHealthShape = z.object({
  ok: z.boolean().optional(),
  indexDigest: z.string().optional(),
  indexEntries: z.number().optional(),
});
export type IndexDigestHealth = z.infer<typeof IndexDigestHealthShape>;

export type LegStatus = "ok" | "drift" | "unreachable";

export interface LegResult {
  readonly leg: "repo" | "license" | "worker" | "admin";
  readonly status: LegStatus;
  readonly detail: string;
}

export interface ParityInputs {
  /** The git-tracked registry/index.json bytes (the reference). */
  readonly repoBytes: Uint8Array | string;
  /** Parsed license /health JSON, or null when the service was unreachable. */
  readonly licenseHealth: unknown | null;
  /** Parsed Worker /index.json JSON, or null when the Worker was unreachable. */
  readonly workerIndex: unknown | null;
  /** Parsed admin /healthz JSON, or null when the app was unreachable. */
  readonly adminHealthz: unknown | null;
}

export interface ParityReport {
  readonly rows: LegResult[];
  /** True when any leg drifted OR was unreachable. */
  readonly drift: boolean;
}

/**
 * Compare the reachable index copies. PURE over already-fetched inputs (the network lives in
 * {@link main}), so drift detection is unit-testable with fixtures. `drift` is true when the
 * license/admin digest mismatches, when any Worker-served entry is stale/foreign vs the repo, or
 * when any probed leg was unreachable.
 */
export function computeParity(inputs: ParityInputs): ParityReport {
  const rows: LegResult[] = [];

  // --- repo (reference) ---
  const repoDigest = indexDigest12(inputs.repoBytes);
  let repoParsed: z.infer<typeof IndexShape> | null;
  try {
    const text =
      typeof inputs.repoBytes === "string"
        ? inputs.repoBytes
        : Buffer.from(inputs.repoBytes).toString("utf8");
    repoParsed = IndexShape.parse(JSON.parse(text));
  } catch {
    repoParsed = null;
  }
  if (repoParsed === null) {
    rows.push({
      leg: "repo",
      status: "drift",
      detail: `${repoDigest} — UNPARSEABLE repo index.json`,
    });
    // A broken reference makes every comparison meaningless — report and bail to drift.
    for (const leg of ["license", "worker", "admin"] as const) {
      rows.push({ leg, status: "drift", detail: "skipped (repo unparseable)" });
    }
    return { rows, drift: true };
  }
  const repoLatest = new Map(repoParsed.modules.map((m) => [m.id, m.latest]));
  rows.push({
    leg: "repo",
    status: "ok",
    detail: `${repoDigest} · ${String(repoParsed.modules.length)} entries`,
  });

  // --- license (strong: raw-byte digest equality) ---
  rows.push(
    digestLegResult("license", "/health", inputs.licenseHealth, repoDigest),
  );

  // --- worker (served entries must be no-staler than repo) ---
  if (inputs.workerIndex === null) {
    rows.push({
      leg: "worker",
      status: "unreachable",
      detail: "GET /index.json failed",
    });
  } else {
    const parsed = IndexShape.safeParse(inputs.workerIndex);
    if (!parsed.success) {
      rows.push({
        leg: "worker",
        status: "drift",
        detail: "Worker index did not parse",
      });
    } else {
      const mismatches: string[] = [];
      for (const m of parsed.data.modules) {
        const repoVersion = repoLatest.get(m.id);
        if (repoVersion === undefined) {
          mismatches.push(`${m.id} served but absent from repo`);
        } else if (repoVersion !== m.latest) {
          mismatches.push(`${m.id} worker@${m.latest} != repo@${repoVersion}`);
        }
      }
      rows.push(
        mismatches.length === 0
          ? {
              leg: "worker",
              status: "ok",
              detail: `${String(parsed.data.modules.length)} served entries all match repo latest`,
            }
          : {
              leg: "worker",
              status: "drift",
              detail: mismatches.join("; "),
            },
      );
    }
  }

  // --- admin (strong: raw-byte digest equality, same shape as license) ---
  rows.push(
    digestLegResult("admin", "/healthz", inputs.adminHealthz, repoDigest),
  );

  const drift = rows.some(
    (r) => r.status === "drift" || r.status === "unreachable",
  );
  return { rows, drift };
}

/** Compare a service's reported digest (license `/health` or admin `/healthz` — identical shape,
 *  identical sha256-first-12-hex formula) against the repo reference. */
function digestLegResult(
  leg: "license" | "admin",
  endpointLabel: string,
  health: unknown | null,
  repoDigest: string,
): LegResult {
  if (health === null) {
    return {
      leg,
      status: "unreachable",
      detail: `GET ${endpointLabel} failed`,
    };
  }
  const parsed = IndexDigestHealthShape.safeParse(health);
  const digest = parsed.success ? parsed.data.indexDigest : undefined;
  if (digest === undefined) {
    return {
      leg,
      status: "drift",
      detail: `no indexDigest in ${endpointLabel} (stale image predating the parity field?)`,
    };
  }
  if (digest === repoDigest) {
    return { leg, status: "ok", detail: `${digest} == repo` };
  }
  return { leg, status: "drift", detail: `${digest} != repo ${repoDigest}` };
}

/** Render the parity report as a fixed-width three-column table (leg · status · detail). */
export function renderTable(report: ParityReport): string {
  const lines = ["leg      status       detail"];
  for (const r of report.rows) {
    lines.push(
      `${r.leg.padEnd(8)} ${r.status.toUpperCase().padEnd(12)} ${r.detail}`,
    );
  }
  lines.push(report.drift ? "\nRESULT: DRIFT DETECTED" : "\nRESULT: PARITY OK");
  return lines.join("\n");
}

/** Inlined fetch-with-timeout (registry/ cannot import @caisson/kernel — see the header). Never
 *  AbortSignal.timeout (Bun-forbidden). Returns the parsed JSON, or null on any failure/timeout. */
async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const repoBytes = readFileSync(INDEX_PATH);
  const [workerIndex, licenseHealth, adminHealthz] = await Promise.all([
    fetchJson(WORKER_INDEX_URL),
    fetchJson(LICENSE_HEALTH_URL),
    fetchJson(ADMIN_HEALTHZ_URL),
  ]);
  const report = computeParity({
    repoBytes,
    licenseHealth,
    workerIndex,
    adminHealthz,
  });
  process.stdout.write(`${renderTable(report)}\n`);
  process.exit(report.drift ? 1 : 0);
}

if (import.meta.main) {
  void main();
}
