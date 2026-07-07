"use client";

// Live, interactive demo islands for the /ui component gallery. Each is a self-contained "use
// client" island the server page shell drops into a DemoCard frame. Data is ops/compliance-flavored
// (audit events, usage, entitlements, control coverage) — the shapes a buyer actually renders.
import { useState } from "react";

import { Button } from "@caisson/ui/components";
import {
  AreaChart,
  AuditTimeline,
  BarChart,
  CommandPalette,
  DataTablePro,
  DateRangePicker,
  DiffViewer,
  KanbanBoard,
  LineChart,
  OpsMatrix,
  PayloadViewer,
  Sparkline,
  TreePro,
  TypeToConfirm,
  DEFAULT_REDACT_KEYS,
  type CommandAction,
  type ConfirmState,
  type DataTableProColumn,
  type DateRange,
  type OpsMatrixRow,
} from "@caisson/ui-pro/components";

import {
  AUDIT_EVENTS,
  CHAIN_ENTRIES,
  CONTROL_TREE,
  COVERAGE_COLUMNS,
  COVERAGE_ROWS,
  ENTITLEMENT_AFTER,
  ENTITLEMENT_BEFORE,
  LATENCY_TREND,
  POLICY_AFTER,
  POLICY_BEFORE,
  PROVIDER_LABELS,
  SPEND_BY_PROVIDER,
  TASK_CARDS,
  TASK_COLUMNS,
  TASK_LANES,
  USAGE_WEEK_LABELS,
  USAGE_WEEKS,
  WEBHOOK_PAYLOAD,
  type AuditEventRow,
  type TaskCard,
} from "./sample-data";

// -------- 1. DataTablePro --------
const AUDIT_COLUMNS: DataTableProColumn<AuditEventRow>[] = [
  {
    key: "ts",
    header: "Time",
    render: (r) => r.ts,
    value: (r) => r.ts,
    sortable: true,
  },
  {
    key: "actor",
    header: "Actor",
    render: (r) => r.actor,
    value: (r) => r.actor,
    filterable: true,
    groupable: true,
    exportHeader: "Actor",
  },
  {
    key: "action",
    header: "Action",
    render: (r) => r.action,
    value: (r) => r.action,
    filterable: true,
    groupable: true,
    exportHeader: "Action",
  },
  {
    key: "resource",
    header: "Resource",
    render: (r) => r.resource,
    value: (r) => r.resource,
  },
  {
    key: "result",
    header: "Result",
    render: (r) => r.result,
    value: (r) => r.result,
    groupable: true,
    exportHeader: "Result",
  },
  {
    key: "latencyMs",
    header: "Latency",
    render: (r) => `${r.latencyMs}ms`,
    value: (r) => r.latencyMs,
    numeric: true,
    sortable: true,
    aggregate: "avg",
    exportHeader: "LatencyMs",
  },
];

export function DataTableDemo() {
  return (
    <DataTablePro
      columns={AUDIT_COLUMNS}
      rows={AUDIT_EVENTS}
      rowKey={(r) => r.id}
      exportFileName="audit-events.csv"
      dense
    />
  );
}

// -------- 2. TreePro --------
export function TreeDemo() {
  return (
    <TreePro
      nodes={CONTROL_TREE}
      ariaLabel="Control coverage tree"
      defaultExpanded={["ac", "au", "sc"]}
      renderLabel={(n) => (
        <span>
          {n.data.label}{" "}
          <span
            style={{
              color: "var(--cs-fg-muted)",
              fontSize: "var(--cs-text-xs)",
            }}
          >
            · {n.data.status}
          </span>
        </span>
      )}
    />
  );
}

// -------- 3. OpsMatrix --------
const COVERAGE_MATRIX: OpsMatrixRow[] = COVERAGE_ROWS.map((r) => ({
  label: r.label,
  cells: r.cells.map((c) => ({ state: c })),
}));

export function OpsMatrixDemo() {
  return (
    <OpsMatrix
      rowHeader="Control"
      columns={COVERAGE_COLUMNS}
      rows={COVERAGE_MATRIX}
      caption="Framework coverage across the compliance controls"
    />
  );
}

// -------- 4. AuditTimeline --------
export function AuditTimelineDemo() {
  return (
    <AuditTimeline
      entries={CHAIN_ENTRIES}
      ariaLabel="Entitlement audit chain"
    />
  );
}

// -------- 5. PayloadViewer --------
export function PayloadViewerDemo() {
  return (
    <PayloadViewer
      value={WEBHOOK_PAYLOAD}
      ariaLabel="Purchase webhook payload"
      redactKeys={["apiKey", "signature"]}
      defaultExpandDepth={2}
      showRaw
    />
  );
}

// -------- 6. TypeToConfirm --------
export function TypeToConfirmDemo() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ConfirmState>("idle");
  const reset = () => {
    setOpen(false);
    setState("idle");
  };
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Revoke entitlement…
      </Button>
      <TypeToConfirm
        open={open}
        title="Revoke compliance bundle"
        message={
          <>
            This removes access for <strong>org/beta</strong> immediately. Type
            the org slug to confirm.
          </>
        }
        confirmationPhrase="org/beta"
        tone="danger"
        state={state}
        resultMessage={state === "ok" ? "Entitlement revoked." : undefined}
        onCancel={reset}
        onConfirm={() => {
          setState("busy");
          setTimeout(() => {
            setState("ok");
            setTimeout(reset, 1000);
          }, 600);
        }}
      />
    </>
  );
}

// -------- 7. DateRangePicker --------
export function DateRangeDemo() {
  const [range, setRange] = useState<DateRange>({
    start: "2026-07-01",
    end: "2026-07-07",
  });
  const [comparison, setComparison] = useState<DateRange | null>(null);
  return (
    <DateRangePicker
      value={range}
      onChange={setRange}
      enableComparison
      comparison={comparison}
      onComparisonChange={setComparison}
      billingAnchorDay={15}
      timeZone="UTC"
    />
  );
}

// -------- 8. Charts pack --------
export function ChartsDemo() {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--cs-space-5)",
        gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
      }}
    >
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          Platform tokens / week (M)
        </p>
        <LineChart
          data={USAGE_WEEKS}
          labels={USAGE_WEEK_LABELS}
          title="Weekly token usage"
          description="Platform tokens consumed per week, in millions"
          width={360}
          height={180}
        />
      </div>
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          Same series, area fill
        </p>
        <AreaChart
          data={USAGE_WEEKS}
          labels={USAGE_WEEK_LABELS}
          title="Weekly token usage (area)"
          width={360}
          height={180}
        />
      </div>
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          Spend by provider ($K)
        </p>
        <BarChart
          data={SPEND_BY_PROVIDER}
          labels={PROVIDER_LABELS}
          title="Spend by provider"
          description="Monthly spend by model provider, in thousands of dollars"
          width={360}
          height={180}
        />
      </div>
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          p95 gateway latency
        </p>
        <Sparkline
          data={LATENCY_TREND}
          title="p95 gateway latency, last 20 minutes"
          width={220}
          height={44}
        />
      </div>
    </div>
  );
}

// -------- 9. CommandPalette --------
export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const actions: CommandAction[] = [
    {
      id: "grant",
      label: "Grant entitlement",
      group: "Admin",
      keywords: "add access allow",
      hint: "G",
      run: () => setLast("Granted entitlement"),
    },
    {
      id: "revoke",
      label: "Revoke entitlement",
      group: "Admin",
      keywords: "remove deny",
      run: () => setLast("Revoked entitlement"),
    },
    {
      id: "invite",
      label: "Invite member",
      group: "Admin",
      keywords: "seat user",
      run: () => setLast("Invited member"),
    },
    {
      id: "export",
      label: "Export audit log",
      group: "Data",
      keywords: "csv download",
      run: () => setLast("Exported audit log"),
    },
    {
      id: "rotate",
      label: "Rotate BYOK key",
      group: "Data",
      keywords: "provider secret",
      run: () => setLast("Rotated BYOK key"),
    },
    {
      id: "worm",
      label: "Write WORM anchor",
      group: "Compliance",
      keywords: "immutable attest",
      run: () => setLast("Wrote WORM anchor"),
    },
  ];
  return (
    <div>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open command palette (⌘K)
      </Button>
      {last ? (
        <p
          className="cs-muted"
          style={{
            marginTop: "var(--cs-space-3)",
            fontSize: "var(--cs-text-sm)",
          }}
        >
          Ran: <strong>{last}</strong>
        </p>
      ) : null}
      <CommandPalette actions={actions} open={open} onOpenChange={setOpen} />
    </div>
  );
}

// -------- 10. DiffViewer --------
export function DiffViewerDemo() {
  return (
    <div style={{ display: "grid", gap: "var(--cs-space-5)" }}>
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          Entitlement record — plan upgrade (secret masked in both panes)
        </p>
        <DiffViewer
          kind="json"
          before={ENTITLEMENT_BEFORE}
          after={ENTITLEMENT_AFTER}
          redactKeys={DEFAULT_REDACT_KEYS}
          beforeLabel="Developer"
          afterLabel="Team"
        />
      </div>
      <div>
        <p
          className="cs-muted"
          style={{
            marginBottom: "var(--cs-space-2)",
            fontSize: "var(--cs-text-xs)",
          }}
        >
          RLS policy — hardening edit
        </p>
        <DiffViewer
          kind="text"
          before={POLICY_BEFORE}
          after={POLICY_AFTER}
          beforeLabel="Before"
          afterLabel="Hardened"
        />
      </div>
    </div>
  );
}

// -------- 11. KanbanBoard --------
export function KanbanDemo() {
  const [cards, setCards] = useState<TaskCard[]>(TASK_CARDS);
  return (
    <KanbanBoard
      columns={TASK_COLUMNS}
      cards={cards}
      onChange={setCards}
      lanes={TASK_LANES}
      ariaLabel="Remediation board"
      renderCard={(c) => (
        <div>
          <strong style={{ fontWeight: "var(--cs-weight-medium)" }}>
            {c.title}
          </strong>
          <div className="cs-muted" style={{ fontSize: "var(--cs-text-xs)" }}>
            {c.owner}
          </div>
        </div>
      )}
    />
  );
}
