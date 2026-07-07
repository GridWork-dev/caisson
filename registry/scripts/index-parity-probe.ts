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
//   admin    — UNPROBEABLE externally (CF-Access gate). Printed as UNPROBEABLE; the admin digest check
//              lands when the queued `/healthz` digest addition merges (see the follow-up note below).
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

const LicenseHealthShape = z.object({
  ok: z.boolean().optional(),
  indexDigest: z.string().optional(),
  indexEntries: z.number().optional(),
});
export type LicenseHealth = z.infer<typeof LicenseHealthShape>;

export type LegStatus = "ok" | "drift" | "unreachable" | "unprobeable";

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
}

export interface ParityReport {
  readonly rows: LegResult[];
  /** True when any reachable leg drifted OR a probed leg was unreachable (admin-unprobeable excludes). */
  readonly drift: boolean;
}

/**
 * Compare the reachable index copies. PURE over already-fetched inputs (the network lives in
 * {@link main}), so drift detection is unit-testable with fixtures. `drift` is true when the license
 * digest mismatches, when any Worker-served entry is stale/foreign vs the repo, or when a probed leg
 * (license/worker) was unreachable — the admin leg's `unprobeable` never sets drift.
 */
export function computeParity(inputs: ParityInputs): ParityReport {
  const rows: LegResult[] = [];

  // --- repo (reference) ---
  const repoDigest = indexDigest12(inputs.repoBytes);
  let repoParsed: z.infer<typeof IndexShape> | null = null;
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
    rows.push({
      leg: "license",
      status: "drift",
      detail: "skipped (repo unparseable)",
    });
    rows.push({
      leg: "worker",
      status: "drift",
      detail: "skipped (repo unparseable)",
    });
    rows.push(adminRow());
    return { rows, drift: true };
  }
  const repoLatest = new Map(repoParsed.modules.map((m) => [m.id, m.latest]));
  rows.push({
    leg: "repo",
    status: "ok",
    detail: `${repoDigest} · ${String(repoParsed.modules.length)} entries`,
  });

  // --- license (strong: raw-byte digest equality) ---
  if (inputs.licenseHealth === null) {
    rows.push({
      leg: "license",
      status: "unreachable",
      detail: "GET /health failed",
    });
  } else {
    const health = LicenseHealthShape.safeParse(inputs.licenseHealth);
    const digest = health.success ? health.data.indexDigest : undefined;
    if (digest === undefined) {
      rows.push({
        leg: "license",
        status: "drift",
        detail:
          "no indexDigest in /health (stale image predating the parity field?)",
      });
    } else if (digest === repoDigest) {
      rows.push({ leg: "license", status: "ok", detail: `${digest} == repo` });
    } else {
      rows.push({
        leg: "license",
        status: "drift",
        detail: `${digest} != repo ${repoDigest}`,
      });
    }
  }

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

  rows.push(adminRow());

  const drift = rows.some(
    (r) => r.status === "drift" || r.status === "unreachable",
  );
  return { rows, drift };
}

function adminRow(): LegResult {
  return {
    leg: "admin",
    status: "unprobeable",
    detail:
      "CF-Access gated — external probe impossible; admin /healthz digest check queued (follow-up)",
  };
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
  const [workerIndex, licenseHealth] = await Promise.all([
    fetchJson(WORKER_INDEX_URL),
    fetchJson(LICENSE_HEALTH_URL),
  ]);
  const report = computeParity({ repoBytes, licenseHealth, workerIndex });
  process.stdout.write(`${renderTable(report)}\n`);
  process.exit(report.drift ? 1 : 0);
}

if (import.meta.main) {
  void main();
}
