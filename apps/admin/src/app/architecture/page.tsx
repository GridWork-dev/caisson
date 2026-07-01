import { buildGraph } from "@/lib/architecture-annotations";

import { ArchitectureFlow } from "./architecture-flow";

// The live architecture diagram (ADR-0143): the hybrid graph is computed at BUILD time (the topology
// half scans the in-repo deploy manifests, which only exist at build — see topology.ts) and baked
// into this static page; the interactive React Flow canvas is the client half.
export const dynamic = "force-static";

export default function ArchitecturePage() {
  const graph = buildGraph();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-8)" }}>
      <section>
        <p className="eyebrow">caisson · admin / architecture</p>
        <h1 className="page-title" style={{ maxWidth: "22ch" }}>
          The fleet, as it actually runs.
        </h1>
        <p className="lede">
          Service topology auto-derived from the deploy manifests, with
          hand-authored intent the topology can&rsquo;t see — who talks to whom,
          the trust boundaries, and the observability backbone. Pan, zoom, and
          drag to explore (ADR-0143).
        </p>
      </section>

      <ArchitectureFlow graph={graph} />
    </div>
  );
}
