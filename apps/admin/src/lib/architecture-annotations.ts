import { discoverTopology, type ServiceKind } from "./topology";

// The HAND-AUTHORED half of the ADR-0143 hybrid diagram: the intent the auto-topology can't see —
// who talks to whom (edges), the trust-boundary groupings, and the legend. A versioned in-repo data
// file, reviewed like code. `buildGraph()` merges it over the discovered topology and drops anything
// that references an absent node, so the diagram stays honest when a manifest isn't there yet.

/** Topology kinds plus external sinks that live outside the fleet (Paddle, etc.). */
export type NodeKind = ServiceKind | "external";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  healthcheck?: string;
}

export interface AnnotationEdge {
  id: string;
  source: string;
  target: string;
  /** The intent — what actually flows, not just "connected". */
  label: string;
  /** Transport, shown compact on the edge (OTLP, SQL, HTTPS, CF-native). */
  protocol: string;
  bidirectional?: boolean;
}

export type BoundaryId = "public" | "operator" | "substrate";

export interface TrustBoundary {
  id: BoundaryId;
  label: string;
  intent: string;
  /** Node ids grouped by this boundary; also drives the diagram's column layout. */
  members: string[];
}

export interface LegendEntry {
  key: string;
  label: string;
}

export interface Legend {
  kinds: LegendEntry[];
  boundaries: LegendEntry[];
  note: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: AnnotationEdge[];
  boundaries: TrustBoundary[];
  legend: Legend;
}

// External sinks — not repo deploys, so not in the topology. Included only when a surviving edge
// references them (see buildGraph), so an absent license doesn't leave Paddle floating alone.
const EXTERNAL_NODES: readonly GraphNode[] = [
  { id: "paddle", label: "Paddle (MoR)", kind: "external" },
];

const EDGES: readonly AnnotationEdge[] = [
  // Data substrate — Railway Postgres.
  {
    id: "site-pg",
    source: "site",
    target: "postgres",
    label: "tenant reads",
    protocol: "SQL",
  },
  {
    id: "docs-pg",
    source: "docs",
    target: "postgres",
    label: "corpus metadata",
    protocol: "SQL",
  },
  {
    id: "bot-pg",
    source: "support-bot",
    target: "postgres",
    label: "support tickets",
    protocol: "SQL",
  },
  {
    id: "license-pg",
    source: "license",
    target: "postgres",
    label: "entitlements + credits",
    protocol: "SQL",
  },
  {
    id: "admin-pg",
    source: "admin",
    target: "postgres",
    label: "read-only ops",
    protocol: "SQL (ro)",
  },

  // Service-to-service.
  {
    id: "bot-docs",
    source: "support-bot",
    target: "docs",
    label: "RAG query",
    protocol: "HTTPS",
    bidirectional: true,
  },

  // Billing — the one external sink.
  {
    id: "license-paddle",
    source: "license",
    target: "paddle",
    label: "billing webhooks + API",
    protocol: "HTTPS",
  },

  // Observability — every Node/Python service + admin export OTLP to Grafana Cloud (ADR-0177 sink); the
  // CF Worker ships edge logs via CF-native destinations; admin also reads back over the query API.
  {
    id: "site-otlp",
    source: "site",
    target: "grafana",
    label: "traces",
    protocol: "OTLP",
  },
  {
    id: "docs-otlp",
    source: "docs",
    target: "grafana",
    label: "traces",
    protocol: "OTLP",
  },
  {
    id: "bot-otlp",
    source: "support-bot",
    target: "grafana",
    label: "traces",
    protocol: "OTLP",
  },
  {
    id: "license-otlp",
    source: "license",
    target: "grafana",
    label: "traces",
    protocol: "OTLP",
  },
  {
    id: "worker-otlp",
    source: "registry-worker",
    target: "grafana",
    label: "edge logs",
    protocol: "CF-native",
  },
  {
    id: "admin-grafana",
    source: "admin",
    target: "grafana",
    label: "traces + query API",
    protocol: "OTLP / HTTPS",
    bidirectional: true,
  },
];

const BOUNDARIES: readonly TrustBoundary[] = [
  {
    id: "public",
    label: "Public buyer surface",
    intent:
      "Internet-reachable — marketing, docs, registry, and the Discord support bot.",
    members: ["site", "docs", "support-bot", "registry-worker"],
  },
  {
    id: "operator",
    label: "Operator control-plane",
    intent:
      "CF-Access-gated, operator-only (ADR-0140). No buyer ever reaches this.",
    members: ["admin"],
  },
  {
    id: "substrate",
    label: "Data & billing substrate",
    intent:
      "Postgres, the entitlement/billing brain, the external MoR, and the telemetry backbone.",
    members: ["postgres", "license", "paddle", "grafana"],
  },
];

const LEGEND: Legend = {
  kinds: [
    { key: "app", label: "Next app" },
    { key: "service", label: "Backend service" },
    { key: "worker", label: "CF Worker" },
    { key: "datastore", label: "Datastore" },
    { key: "observability", label: "Observability" },
    { key: "external", label: "External sink" },
  ],
  boundaries: [
    { key: "public", label: "Public buyer surface" },
    { key: "operator", label: "Operator control-plane" },
    { key: "substrate", label: "Data & billing substrate" },
  ],
  note: "Nodes auto-derived from */railway.toml + wrangler.toml at build; edges + boundaries hand-authored (ADR-0143). An absent manifest is a missing node — edges to it are dropped.",
};

/**
 * Merge the discovered topology with the hand-authored annotations. Resilient by construction: edges
 * are kept only when BOTH endpoints exist, external nodes only when a surviving edge uses them, and
 * boundaries list only present members — so a missing service (e.g. license, which has no manifest)
 * simply drops out of the picture instead of dangling.
 */
export function buildGraph(): ArchitectureGraph {
  const topo = discoverTopology();
  const presentIds = new Set(topo.map((n) => n.id));
  const candidateIds = new Set([
    ...presentIds,
    ...EXTERNAL_NODES.map((n) => n.id),
  ]);

  const edges = EDGES.filter(
    (e) => candidateIds.has(e.source) && candidateIds.has(e.target),
  );

  const usedIds = new Set(edges.flatMap((e) => [e.source, e.target]));
  const externals = EXTERNAL_NODES.filter((n) => usedIds.has(n.id));
  const nodes: GraphNode[] = [...topo, ...externals];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const boundaries = BOUNDARIES.map((b) => ({
    ...b,
    members: b.members.filter((m) => nodeIds.has(m)),
  })).filter((b) => b.members.length > 0);

  return { nodes, edges: [...edges], boundaries, legend: LEGEND };
}
