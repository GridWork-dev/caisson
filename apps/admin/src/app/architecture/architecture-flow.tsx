"use client";

import { useEffect, useMemo, useState } from "react";

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
  type ColorMode,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { THEME_STORAGE_KEY } from "@caisson/ui/components";

import type {
  ArchitectureGraph,
  BoundaryId,
  NodeKind,
} from "@/lib/architecture-annotations";
import type { FleetSnapshot, NodeOverlay } from "@/lib/fleet-reads";

function readPinnedTheme(): "dark" | "light" | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/** The theme actually in effect right now: a pinned choice (ThemeToggle), else the OS
 *  preference, else dark (the un-attributed `:root` default — see globals.css). */
function resolveColorMode(): "dark" | "light" {
  const pinned = readPinnedTheme();
  if (pinned) return pinned;
  if (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark";
}

/**
 * Mirrors the ADMIN APP's own theme (ThemeToggle's pin-else-OS model) rather than React Flow's
 * built-in `colorMode="system"`, which only ever tracks the raw OS preference: the instant an
 * operator PINS a theme against the OS setting (ThemeToggle writes `data-theme` directly, no
 * custom event), `system` desyncs from the rest of the page — the ADR-0374 "controls/minimap
 * stay light in dark mode" finding. `system` also resolves purely on the client (no window at
 * build time), so the force-static page's baked SSR markup and the first real client paint
 * disagree — the paired hydration-mismatch finding. An SSR-stable "dark" default here matches
 * ThemeToggle's own SSR-stable default, resolved for real only after mount.
 */
function useAdminColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>("dark");

  useEffect(() => {
    setMode(resolveColorMode());

    const mq =
      typeof matchMedia !== "undefined"
        ? matchMedia("(prefers-color-scheme: light)")
        : null;
    const onMqChange = (): void => {
      if (!readPinnedTheme()) setMode(mq?.matches ? "light" : "dark");
    };
    mq?.addEventListener("change", onMqChange);

    // ThemeToggle mutates `data-theme` directly (no custom event) — observe the attribute so a
    // pin toggled anywhere on the page updates this canvas without a remount.
    const observer = new MutationObserver(() => setMode(resolveColorMode()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      mq?.removeEventListener("change", onMqChange);
      observer.disconnect();
    };
  }, []);

  return mode;
}

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

type ServiceNodeData = {
  label: string;
  kind: NodeKind;
  healthcheck?: string;
  /** ADR-0316 W-FLEET: live Railway deploy status / CF worker metrics, merged in client-side. */
  live?: NodeOverlay;
};

// Railway deploy-status → dot color. SUCCESS is healthy; CRASHED/FAILED are alarming; anything
// in-flight (BUILDING/DEPLOYING/SLEEPING/…) is attention-amber.
function liveStatusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "#22c39a";
  if (s === "CRASHED" || s === "FAILED") return "#ff6b8b";
  return "#f4a13c";
}
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
      {d.live?.status ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: liveStatusColor(d.live.status),
              flex: "0 0 auto",
            }}
          />
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--cs-fg-muted)" }}
          >
            {d.live.status.toLowerCase()}
          </span>
        </div>
      ) : null}
      {d.live?.requests !== undefined ? (
        <div
          className="mono"
          style={{ marginTop: 6, fontSize: 11, color: "var(--cs-fg-muted)" }}
        >
          {d.live.requests.toLocaleString()} req · {d.live.errors ?? 0} err
          (24h)
        </div>
      ) : null}
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);
  const colorMode = useAdminColorMode();

  // ADR-0316 W-FLEET — decorate the static diagram with live fleet data at RUNTIME (the page itself
  // is force-static, baked without a repo tree; this client fetch is the only live seam). Dormant /
  // unconfigured / any error ⇒ the diagram renders unchanged. Cached 60s in the route, so a remount
  // never hammers the vendor APIs.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/fleet")
      .then((r) => (r.ok ? (r.json() as Promise<FleetSnapshot>) : null))
      .then((snap) => {
        if (cancelled || snap === null || !snap.configured) return;
        setNodes((ns) =>
          ns.map((n) => {
            const overlay = snap.nodes[n.id];
            return overlay === undefined
              ? n
              : { ...n, data: { ...n.data, live: overlay } };
          }),
        );
      })
      .catch(() => {
        /* overlay is decorative — a failure leaves the static diagram intact */
      });
    return () => {
      cancelled = true;
    };
  }, [setNodes]);

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
          colorMode={colorMode}
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
