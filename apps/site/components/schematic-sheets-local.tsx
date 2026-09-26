import { Boundary, Flow, Sheet, SNode, TitleBlock } from "./schematics";
import styles from "./schematics.module.css";

// Local-first + design-system blueprint sheets (ADR-0377 vocabulary, executing ADR-0378 lock 1
// migrate-all): four module pages onto the shared blueprint-linework register. Server components,
// no interactivity, no new CSS file. Every identifier below is verbatim from the cited source file,
// the constant it names, or the real pricing/marketplace-surface catalog it is sold from.
//
// Honest-artifact floor (ADR-0082): a diagram is a claim. Sample-ish values (the tenant-file
// template, the RRF/HLC comparator wiring) are labeled from real names, never invented ones.

// ===== local-store blueprint sheet =====
// Names from packages/local-store/src (SPEC-honest): store.ts's RRF_K = 60 constant, vecLeg
// (sqlite-vec vec0 MATCH) and ftsLeg (docs_fts bm25) fused by Reciprocal Rank Fusion, the
// FTS5-only degrade path with no query vector; tenant-db.ts's tenantDbPath (one SQLite file per
// tenant, the path itself is the isolation boundary); gc.ts's dedup-on-write via contentDigest
// plus the expired/decayed/overflow GC reasons.
export function LocalStoreSheet() {
  return (
    <Sheet
      title="local-store: a vec0 KNN leg and an FTS5 leg fuse by Reciprocal Rank Fusion at k = 60, degrading to FTS5-only with no query vector, over one physically isolated SQLite file per tenant"
      bar="packages/local-store · hybrid retrieval, tenant file, gc"
    >
      <SNode
        x={10}
        y={14}
        w={98}
        h={26}
        head="vec0 KNN"
        sub="sqlite-vec MATCH"
      />
      <SNode x={10} y={48} w={98} h={26} head="FTS5" sub="docs_fts · bm25" />
      <Flow x1={108} y1={27} x2={122} y2={27} />
      <Flow x1={108} y1={61} x2={122} y2={61} />
      {/* the ONE accent element: the RRF fuse gate */}
      <Boundary x={122} y={12} w={126} h={68} label="RRF fuse · k = 60" />
      <SNode
        x={138}
        y={36}
        w={96}
        h={26}
        head="RRF_K = 60"
        sub={"Σ 1/(k+rank)"}
      />
      <Flow x1={234} y1={49} x2={252} y2={49} />
      <SNode x={254} y={36} w={76} h={26} head="top hits" sub="ranked ids" />
      <text x={10} y={96} className={styles.note}>
        no query vector {"→"} FTS5-only, still returns
      </text>
      <SNode
        x={10}
        y={108}
        w={150}
        h={26}
        head="tenantDbPath()"
        sub="reject .. · null · abs"
      />
      <Flow x1={160} y1={121} x2={178} y2={121} />
      <SNode
        x={178}
        y={108}
        w={120}
        h={26}
        head="one file / tenant"
        sub="<tenant>.db"
      />
      <text x={10} y={150} className={styles.note}>
        the resolved path IS the isolation boundary
      </text>
      <text x={10} y={164} className={styles.note}>
        gc: dedup on write, TTL/decay, overflow cap
      </text>
      <TitleBlock x={188} y={168} w={140} text="LOCAL-STORE · 1/1" />
    </Sheet>
  );
}

// ===== local-sync blueprint sheet =====
// Names from packages/local-sync/src: clock.ts's HlcStamp { physical, node, counter } and its
// compareStamps strict total order; reconcile.ts's reconcileReplicas LWW register per (table, pk)
// and the sorted converged live-row set; tombstone.ts's Tombstone record, the no-resurrection
// invariant, and gcTombstones's horizon guard.
export function LocalSyncSheet() {
  return (
    <Sheet
      title="local-sync: per-replica changesets reconcile through the HLC comparator (physical, then node, then counter) into one converged, sorted live-row set; a winning delete tombstones the row and a horizon-gated GC is the only way it is ever dropped"
      bar="packages/local-sync · HLC reconcile, tombstone, gc"
    >
      <SNode x={10} y={14} w={92} h={26} head="device A" sub="replica · seq" />
      <SNode x={238} y={14} w={92} h={26} head="device B" sub="replica · seq" />
      <Flow x1={102} y1={27} x2={122} y2={27} />
      <Flow x1={238} y1={27} x2={218} y2={27} />
      {/* the ONE accent element: the LWW reconcile gate */}
      <Boundary x={122} y={10} w={96} h={70} label="LWW reconcile" />
      <SNode
        x={130}
        y={36}
        w={80}
        h={26}
        head="compareStamps"
        sub={"phys→node→seq"}
      />
      <Flow x1={170} y1={80} x2={170} y2={94} />
      <SNode
        x={110}
        y={94}
        w={120}
        h={26}
        head="live rows"
        sub="sorted (table,pk)"
      />
      <text x={10} y={136} className={styles.note}>
        delete wins {"→"} tombstoned, never resurrected
      </text>
      <text x={10} y={150} className={styles.note}>
        tombstones persist across sync rounds
      </text>
      <text x={10} y={164} className={styles.note}>
        gcTombstones: drop stamp before horizon
      </text>
      <TitleBlock x={188} y={168} w={140} text="LOCAL-SYNC · 1/1" />
    </Sheet>
  );
}

// ===== local-inference blueprint sheet =====
// Names from packages/local-inference/src: backend.ts's InferenceBackend port + EMBEDDING_DIM;
// onnx-backend.ts's OnnxEmbeddingBackend (transformers.js, the model-fetch EgressGuard sink,
// DEFAULT_ONNX_MODEL.modelHost = huggingface.co, the SHA-256 hash-pin verify); rented-backend.ts's
// RentedInferenceBackend (off unless assertAllowedFor allows the rented-backend sink) and MeterSink.
export function LocalInferenceSheet() {
  return (
    <Sheet
      title="local-inference: an on-device ONNX embedder runs behind a guarded model-fetch egress sink with SHA-256 hash-pin verification; the hosted RentedInferenceBackend stays off by default until its endpoint is explicitly allowlisted, and every rented call emits one metered record"
      bar="packages/local-inference · guarded fetch, opt-in rent"
    >
      <SNode x={10} y={14} w={70} h={26} head="prompt" sub="on-device" />
      <Flow x1={80} y1={27} x2={96} y2={27} />
      {/* the ONE accent element: the guarded egress chokepoint */}
      <Boundary x={96} y={10} w={160} h={70} label="model-fetch · guarded" />
      <SNode
        x={106}
        y={34}
        w={140}
        h={26}
        head="transformers.js"
        sub="384-dim · onnxruntime"
      />
      <text x={176} y={72} className={styles.subDanger}>
        hash mismatch {"⇒"} blocked
      </text>
      <Flow x1={256} y1={47} x2={270} y2={47} />
      <SNode x={270} y={34} w={62} h={26} head="response" sub="zero egress" />
      <text x={10} y={96} className={styles.note}>
        modelHost allowlist: huggingface.co only
      </text>
      <SNode
        x={10}
        y={108}
        w={170}
        h={26}
        head="RentedInferenceBackend"
        sub="off by default"
      />
      <Flow x1={180} y1={121} x2={196} y2={121} />
      <SNode
        x={196}
        y={108}
        w={134}
        h={26}
        head="assertAllowedFor()"
        sub="rented-backend sink"
      />
      <text x={10} y={150} className={styles.note}>
        throws unless host is https and allowlisted
      </text>
      <text x={10} y={164} className={styles.note}>
        MeterSink: one metered record per call
      </text>
      <TitleBlock x={188} y={168} w={140} text="LOCAL-INFERENCE · 1/1" />
    </Sheet>
  );
}

// ===== ui-pro blueprint sheet =====
// Names from packages/ui-pro/src: components/index.ts's real exported components (AuditTimeline,
// DataTablePro, Tooltip, Popover, Menu) and the pure-lib split the barrel's own comment describes
// ("the sellable logic behind the interactive components lives in these, not the UI") — audit-
// chain.ts's verifyChain/chainIntact, table-ops.ts's sortRows/toCsv, use-floating-position.ts's
// wrap of position.ts's computeFloatingPosition, redact.ts's re-export of DEFAULT_REDACT_KEYS from
// @caisson-sh/kernel. The open @caisson-sh/ui base this tier composes onto is the ADR-0094 Apache-2.0 line.
export function UiProSheet() {
  return (
    <Sheet
      title="ui-pro: every interactive component composes onto the open Apache-2.0 @caisson-sh/ui base and calls into its own pure, unit-tested lib function, from AuditTimeline's verifyChain to Tooltip/Popover/Menu's shared computeFloatingPosition"
      bar="packages/ui-pro · component / pure-lib seam"
    >
      <SNode x={10} y={14} w={98} h={26} head="AuditTimeline" sub="component" />
      <SNode x={118} y={14} w={98} h={26} head="DataTablePro" sub="component" />
      <Flow x1={59} y1={40} x2={59} y2={50} />
      <Flow x1={167} y1={40} x2={167} y2={50} />
      {/* the ONE accent element: the presentation / pure-lib seam */}
      <Boundary
        x={10}
        y={50}
        w={310}
        h={52}
        label="pure lib seam · server-safe, unit-tested"
      />
      <SNode
        x={20}
        y={72}
        w={140}
        h={26}
        head="verifyChain()"
        sub="chainIntact()"
      />
      <SNode
        x={170}
        y={72}
        w={140}
        h={26}
        head="table-ops"
        sub="sortRows · toCsv"
      />
      <Flow x1={165} y1={102} x2={165} y2={116} />
      <SNode
        x={90}
        y={116}
        w={150}
        h={26}
        head="@caisson-sh/ui"
        sub="Apache-2.0 base"
      />
      <text x={10} y={154} className={styles.note}>
        floating position: Tooltip, Popover, Menu
      </text>
      <text x={10} y={166} className={styles.note}>
        redact keys re-exported from @caisson-sh/kernel
      </text>
      <TitleBlock x={188} y={168} w={140} text="UI-PRO · 1/1" />
    </Sheet>
  );
}
