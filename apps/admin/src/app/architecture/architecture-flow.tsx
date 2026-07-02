"use client";

import { useMemo } from "react";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  ArchitectureGraph,
  BoundaryId,
  NodeKind,
} from "@/lib/architecture-annotations";

// The React Flow render of the ADR-0143 hybrid graph. Type-only import of the graph shapes keeps the
// node:fs topology deriver out of the client bundle. All data-flow reasoning lives in
// architecture-annotations.ts; this file is purely layout + presentation.

// Canvas-local palette: the design system is monochrome + one accent, but a topology diagram needs the
// node KINDS visually separable, so the canvas carries its own small hue set (node fill + text still use
// the tokens, so the cards flip with the app theme). Distinct mid-saturation hues read on dark + light.
const KIND_COLOR: Record<NodeKind, string> = {
  app: "#4f9dff",
  service: "#22c39a",
  worker: "#f4a13c",
  datastore: "#b07cff",
  observability: "#ff6b8b",
  external: "#8a94a6",
};

const KIND_LABEL: Record<NodeKind, string> = {
  app: "Next app",
  service: "service",
  worker: "CF Worker",
  datastore: "datastore",
  observability: "observability",
  external: "external",
};

const BOUNDARY_ACCENT: Record<BoundaryId, string> = {
  public: "#4f9dff",
  operator: "#f4a13c",
  substrate: "#b07cff",
};

// Deterministic column layout: one column per trust boundary (in graph order), nodes stacked within.
const COL_W = 340;
const ROW_H = 132;
const NODE_W = 232;
const HEADER_H = 52;
const PAD = 24;

type ServiceNodeData = { label: string; kind: NodeKind; healthcheck?: string };
type BoundaryNodeData = {
  label: string;
  intent: string;
  boundaryId: BoundaryId;
};

const handleStyle = { opacity: 0, width: 1, height: 1, border: "none" };

function ServiceNodeView({ data }: NodeProps) {
  const d = data as ServiceNodeData;
  const color = KIND_COLOR[d.kind];
  return (
    <div
      style={{
        width: NODE_W,
        boxSizing: "border-box",
        padding: "10px 14px",
        borderRadius: "var(--cs-radius-md)",
        border: `1px solid ${color}`,
        background: "var(--cs-surface-2)",
        color: "var(--cs-fg)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
            flex: "0 0 auto",
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{d.label}</span>
      </div>
      <div
        className="mono"
        style={{ marginTop: 4, fontSize: 11, color: "var(--cs-fg-muted)" }}
      >
        {KIND_LABEL[d.kind]}
        {d.healthcheck ? ` · ${d.healthcheck}` : ""}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

function BoundaryView({ data }: NodeProps) {
  const d = data as BoundaryNodeData;
  const accent = BOUNDARY_ACCENT[d.boundaryId];
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: `1px dashed ${accent}`,
        borderRadius: 16,
        background: `color-mix(in oklab, ${accent} 7%, transparent)`,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          left: 14,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 600,
          color: accent,
        }}
      >
        {d.label}
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  service: ServiceNodeView,
  boundary: BoundaryView,
};

function layout(graph: ArchitectureGraph): { nodes: Node[]; edges: Edge[] } {
  const colOf = new Map<string, number>();
  const rowOf = new Map<string, number>();
  const boundaryNodes: Node[] = [];

  graph.boundaries.forEach((b, col) => {
    b.members.forEach((id, row) => {
      colOf.set(id, col);
      rowOf.set(id, row);
    });
    boundaryNodes.push({
      id: `boundary:${b.id}`,
      type: "boundary",
      position: { x: col * COL_W - PAD, y: 0 },
      data: { label: b.label, intent: b.intent, boundaryId: b.id },
      style: {
        width: NODE_W + PAD * 2,
        height: HEADER_H + b.members.length * ROW_H,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 0,
    });
  });

  // Any node not claimed by a boundary lands in a trailing column so nothing silently vanishes.
  let miscRow = 0;
  const miscCol = graph.boundaries.length;

  const serviceNodes: Node[] = graph.nodes.map((n) => {
    const claimed = colOf.has(n.id);
    const col = claimed ? colOf.get(n.id)! : miscCol;
    const row = claimed ? rowOf.get(n.id)! : miscRow++;
    return {
      id: n.id,
      type: "service",
      position: { x: col * COL_W, y: HEADER_H + row * ROW_H },
      data: { label: n.label, kind: n.kind, healthcheck: n.healthcheck },
      zIndex: 1,
    };
  });

  const edges: Edge[] = graph.edges.map((e) => {
    const toObservability = e.target === "grafana";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: `${e.label} · ${e.protocol}`,
      animated: toObservability,
      markerEnd: { type: MarkerType.ArrowClosed },
      ...(e.bidirectional
        ? { markerStart: { type: MarkerType.ArrowClosed } }
        : {}),
      style: {
        stroke: toObservability ? "var(--cs-accent)" : "var(--cs-fg-muted)",
        strokeWidth: 1.4,
      },
      labelStyle: { fontSize: 11, fill: "var(--cs-fg)" },
      labelBgStyle: { fill: "var(--cs-surface-1)", fillOpacity: 0.92 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  return { nodes: [...boundaryNodes, ...serviceNodes], edges };
}

export function ArchitectureFlow({ graph }: { graph: ArchitectureGraph }) {
  const initial = useMemo(() => layout(graph), [graph]);
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  if (graph.nodes.length === 0) {
    // Only reachable if the diagram was built with no repo tree in reach (topology found nothing).
    return (
      <div className="panel" style={{ padding: "var(--cs-space-4)" }}>
        <p className="muted">
          Topology unavailable — no deploy manifests were found at build time.
        </p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--cs-space-4)" }}>
      <div
        style={{
          height: "72vh",
          minHeight: 520,
          border: "1px solid var(--cs-border)",
          borderRadius: "var(--cs-radius-lg)",
          overflow: "hidden",
          background: "var(--cs-bg)",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          nodesConnectable={false}
          colorMode="system"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) =>
              n.type === "boundary"
                ? "transparent"
                : (KIND_COLOR[(n.data as ServiceNodeData).kind] ?? "#8a94a6")
            }
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <Legend graph={graph} />
    </div>
  );
}

function Legend({ graph }: { graph: ArchitectureGraph }) {
  return (
    <div className="stack" style={{ gap: "var(--cs-space-2)" }}>
      <div
        className="row"
        style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
      >
        {graph.legend.kinds.map((k) => (
          <span
            key={k.key}
            className="row"
            style={{ gap: 6, alignItems: "center", fontSize: 12 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: KIND_COLOR[k.key as NodeKind] ?? "#8a94a6",
              }}
            />
            {k.label}
          </span>
        ))}
      </div>
      <div
        className="row"
        style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
      >
        {graph.legend.boundaries.map((b) => (
          <span
            key={b.key}
            className="row"
            style={{ gap: 6, alignItems: "center", fontSize: 12 }}
          >
            <span
              style={{
                width: 14,
                height: 10,
                borderRadius: 3,
                border: `1px dashed ${BOUNDARY_ACCENT[b.key as BoundaryId] ?? "#8a94a6"}`,
                background: `color-mix(in oklab, ${BOUNDARY_ACCENT[b.key as BoundaryId] ?? "#8a94a6"} 12%, transparent)`,
              }}
            />
            {b.label}
          </span>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, maxWidth: "70ch" }}>
        {graph.legend.note}
      </p>
    </div>
  );
}
