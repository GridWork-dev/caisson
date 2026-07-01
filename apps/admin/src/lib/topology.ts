import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The AUTO half of the ADR-0143 hybrid architecture diagram: the live fleet, derived by scanning the
// in-repo deploy manifests. Dependency-free on purpose (node:fs + a builtin URL resolve, NO TOML parser
// — a two-field line scan is all we need). Discovery runs at MODULE LOAD, which for the static
// /architecture page means BUILD TIME (`next build` prerenders the page, baking this array into the
// output). The standalone runtime image has no repo tree, so it must never re-scan — the page stays
// `force-static` so the build-time result is what ships. A missing manifest is simply an absent node.

export type ServiceKind =
  "app" | "service" | "worker" | "datastore" | "observability";

export interface ServiceNode {
  id: string;
  label: string;
  kind: ServiceKind;
  /** healthcheckPath from the manifest, when the platform defines one (Workers have none). */
  healthcheck?: string;
}

// Repo root by walking UP from the build cwd (turbo runs `next build` with cwd=apps/admin) and, as a
// fallback, from this module's own dir — until a dir carrying the stable marker `apps/admin/railway.toml`
// is found. A fixed `../../../..` off import.meta.url is fragile: Next bundles this server module into
// `.next/server`, where that relative walk no longer lands on the repo root and the diagram would
// silently bake empty. The walk-up is robust to which dir the build runs from; null (→ empty topology,
// never a throw) inside the repo-less standalone runtime image. Same approach A7's adr-trail.ts uses.
const REPO_MARKER = join("apps", "admin", "railway.toml");

function findRepoRoot(): string | null {
  const isFile = (p: string): boolean => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  };
  const starts: string[] = [process.cwd()];
  try {
    starts.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    /* import.meta.url unavailable — the cwd walk covers the build case */
  }
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 12; i++) {
      if (isFile(join(dir, REPO_MARKER))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

const repoRoot = findRepoRoot();

// railway.toml carries no `name` field (the Railway service name lives in the dashboard), so the node
// id/label come from the manifest's directory. Each entry is scanned independently — services/license
// has no manifest yet, so it is an absent node, not a throw.
const RAILWAY_MANIFESTS: ReadonlyArray<{
  rel: string;
  id: string;
  label: string;
  kind: ServiceKind;
}> = [
  { rel: "apps/site/railway.toml", id: "site", label: "site", kind: "app" },
  { rel: "apps/admin/railway.toml", id: "admin", label: "admin", kind: "app" },
  {
    rel: "services/docs/railway.toml",
    id: "docs",
    label: "docs",
    kind: "service",
  },
  {
    rel: "services/license/railway.toml",
    id: "license",
    label: "license",
    kind: "service",
  },
  {
    rel: "services/support-bot/railway.toml",
    id: "support-bot",
    label: "support-bot",
    kind: "service",
  },
];

function readManifest(rel: string): string | null {
  if (repoRoot === null) return null;
  const path = join(repoRoot, rel);
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null; // unreadable == absent; the diagram degrades to a missing node, never throws
  }
}

const HEALTHCHECK_RE = /^\s*healthcheckPath\s*=\s*"([^"]+)"/m;
const WRANGLER_NAME_RE = /^\s*name\s*=\s*"([^"]+)"/m;

function railwayNodes(): ServiceNode[] {
  const nodes: ServiceNode[] = [];
  for (const m of RAILWAY_MANIFESTS) {
    const toml = readManifest(m.rel);
    if (toml === null) continue;
    const healthcheck = HEALTHCHECK_RE.exec(toml)?.[1];
    nodes.push({
      id: m.id,
      label: m.label,
      kind: m.kind,
      ...(healthcheck ? { healthcheck } : {}),
    });
  }
  return nodes;
}

function workerNode(): ServiceNode | null {
  const toml = readManifest("registry/worker/wrangler.toml");
  if (toml === null) return null;
  const name = WRANGLER_NAME_RE.exec(toml)?.[1] ?? "registry";
  // CF Workers have no Railway-style healthcheck; edge liveness is the observability signal.
  return { id: "registry-worker", label: name, kind: "worker" };
}

// ponytail: SigNoz + Railway Postgres are architectural CONSTANTS (locked ADR-0117/0142 · ADR-0115),
// not manifest-discovered — neither has a railway.toml in this repo. Gating SigNoz on infra/signoz/
// existing would drop the observability backbone (and every OTLP edge) until the A2 infra stream
// lands, so the node is unconditional. Upgrade path: read infra/signoz/ for collector detail if the
// diagram ever needs it. `existsSync` here is informational (surfaced in reports), not a gate.
export const SIGNOZ_CONFIG_PRESENT =
  repoRoot !== null && existsSync(join(repoRoot, "infra", "signoz"));

function infraNodes(): ServiceNode[] {
  return [
    { id: "postgres", label: "Railway Postgres", kind: "datastore" },
    { id: "signoz", label: "SigNoz", kind: "observability" },
  ];
}

/** The live fleet, in a stable order (railway services → worker → infra constants). */
export function discoverTopology(): ServiceNode[] {
  const nodes = railwayNodes();
  const worker = workerNode();
  if (worker) nodes.push(worker);
  nodes.push(...infraNodes());
  return nodes;
}
