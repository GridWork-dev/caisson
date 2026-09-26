"use client";

// @caisson-sh/demo-registry — the 11 @caisson-sh/ui-pro (commercial) entries. Sample data
// mirrors each component's own test fixtures (already-vetted minimal-render shapes) rather than
// inventing new ones — one fewer place a demo can drift from what the component actually renders.
import { useState } from "react";
import {
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
  type AuditEntry,
  type BoardCard,
  type CommandAction,
  type DataTableProColumn,
} from "@caisson-sh/ui-pro/components";
import { Button } from "@caisson-sh/ui/components";
import type { CatalogEntry } from "../schema.ts";

const AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: "1",
    timestamp: "2026-07-07T00:00:00Z",
    action: "Created",
    hash: "aaaa",
  },
  {
    id: "2",
    timestamp: "2026-07-07T00:01:00Z",
    action: "Revoked",
    actor: "admin",
    hash: "bbbb",
    prevHash: "aaaa",
  },
];

const SPARKLINE_DATA = [4, 7, 3, 9, 6, 12, 8];

function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const actions: CommandAction[] = [
    {
      id: "grant",
      label: "Grant entitlement",
      group: "Admin",
      run: () => setOpen(false),
    },
    {
      id: "revoke",
      label: "Revoke entitlement",
      group: "Admin",
      run: () => setOpen(false),
    },
    {
      id: "export",
      label: "Export audit log",
      group: "Data",
      run: () => setOpen(false),
    },
  ];
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open command palette</Button>
      <CommandPalette
        actions={actions}
        open={open}
        onOpenChange={setOpen}
        hotkey={false}
      />
    </>
  );
}

interface Row {
  team: string;
  seats: number;
}
const DATA_TABLE_PRO_COLUMNS: readonly DataTableProColumn<Row>[] = [
  {
    key: "team",
    header: "Team",
    render: (r) => r.team,
    value: (r) => r.team,
    sortable: true,
    filterable: true,
    groupable: true,
    exportHeader: "Team",
  },
  {
    key: "seats",
    header: "Seats",
    render: (r) => r.seats,
    numeric: true,
    value: (r) => r.seats,
    sortable: true,
    aggregate: "sum",
    exportHeader: "Seats",
  },
];
const DATA_TABLE_PRO_ROWS: Row[] = [
  { team: "Acme", seats: 12 },
  { team: "Beta", seats: 3 },
];

function DateRangePickerDemo() {
  const [value, setValue] = useState({
    start: "2026-07-01",
    end: "2026-07-07",
  });
  return (
    <DateRangePicker
      value={value}
      onChange={setValue}
      timeZone="America/New_York"
      referenceDate={new Date("2026-07-07T12:00:00Z")}
    />
  );
}

interface CardT extends BoardCard {
  title: string;
}
function KanbanBoardDemo() {
  const [cards, setCards] = useState<CardT[]>([
    { id: "1", columnId: "todo", title: "Draft SPEC" },
    { id: "2", columnId: "doing", title: "Build gate" },
  ]);
  return (
    <KanbanBoard
      columns={[
        { id: "todo", title: "To do" },
        { id: "doing", title: "In progress" },
        { id: "done", title: "Done" },
      ]}
      cards={cards}
      onChange={setCards}
      renderCard={(c) => <span>{c.title}</span>}
      ariaLabel="Release board"
    />
  );
}

function TypeToConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="ghost">
        Delete account
      </Button>
      <TypeToConfirm
        open={open}
        title="Delete account"
        message="This is irreversible."
        confirmationPhrase="acme-prod"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export const UI_PRO_ENTRIES: CatalogEntry[] = [
  {
    id: "ui-pro.audit-timeline",
    name: "AuditTimeline",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A hash-chain-verified activity log — badges each entry's link to its predecessor.",
    variants: ["verified", "broken link"],
    render: () => (
      <AuditTimeline entries={AUDIT_ENTRIES} ariaLabel="Account activity" />
    ),
  },
  {
    id: "ui-pro.charts",
    name: "Charts (Line / Area / Bar / Sparkline)",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A dependency-free themed charts pack — line, area, bar, and a compact sparkline.",
    variants: ["line", "bar", "sparkline"],
    render: () => (
      <div
        className="row"
        style={{
          gap: "var(--cs-space-6)",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <LineChart
          data={SPARKLINE_DATA}
          title="Weekly credits burned"
          width={280}
          height={140}
        />
        <BarChart
          data={SPARKLINE_DATA}
          title="Calls per model"
          width={280}
          height={140}
        />
        <Sparkline
          data={SPARKLINE_DATA}
          title="7-day trend"
          width={140}
          height={40}
        />
      </div>
    ),
  },
  {
    id: "ui-pro.command-palette",
    name: "CommandPalette",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A ⌘K action launcher — grouped, fuzzy-filterable, keyboard-navigable.",
    variants: ["grouped actions"],
    render: () => <CommandPaletteDemo />,
  },
  {
    id: "ui-pro.data-table-pro",
    name: "DataTablePro",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "Sort, filter, group, virtualize, and CSV-export — the MUI-X-Pro/AG-Grid-Enterprise line.",
    variants: ["sortable", "filterable", "groupable"],
    render: () => (
      <DataTablePro
        columns={DATA_TABLE_PRO_COLUMNS}
        rows={DATA_TABLE_PRO_ROWS}
        rowKey={(r) => r.team}
      />
    ),
  },
  {
    id: "ui-pro.date-range-picker",
    name: "DateRangePicker",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "Fiscal-quarter + billing-cycle presets, an optional comparison range, timezone context.",
    variants: ["with presets"],
    render: () => <DateRangePickerDemo />,
  },
  {
    id: "ui-pro.diff-viewer",
    name: "DiffViewer",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "Redaction-aware text or JSON diffs — split or unified layout.",
    variants: ["text", "json"],
    render: () => (
      <DiffViewer
        kind="text"
        before={"a\nb\nc"}
        after={"a\nB\nc"}
        view="split"
      />
    ),
  },
  {
    id: "ui-pro.kanban-board",
    name: "KanbanBoard",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "Drag-and-drop columns with a keyboard move fallback, optional swimlanes.",
    variants: ["default"],
    render: () => <KanbanBoardDemo />,
  },
  {
    id: "ui-pro.ops-matrix",
    name: "OpsMatrix",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A domain-composed compliance/ops coverage grid — boolean, tri-state, or note cells.",
    variants: ["yes/partial/no", "note"],
    render: () => (
      <OpsMatrix
        rowHeader="Control"
        caption="Control coverage by role"
        columns={["Admin", "Member"]}
        rows={[
          { label: "Read audit log", cells: [true, { state: "partial" }] },
          { label: "Revoke grant", cells: [true, false] },
          { label: "Retention", cells: ["30d", "—"] },
        ]}
      />
    ),
  },
  {
    id: "ui-pro.payload-viewer",
    name: "PayloadViewer",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A typed, expandable JSON tree with automatic secret-key redaction.",
    variants: ["redacted"],
    render: () => (
      <PayloadViewer
        value={{
          event: "purchase.completed",
          amountCents: 12900,
          ok: true,
          credentials: { token: "sk_live_secret" },
        }}
        ariaLabel="Webhook body"
      />
    ),
  },
  {
    id: "ui-pro.tree-pro",
    name: "TreePro",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A virtualized, keyboard-navigable tree with lazy-load support.",
    variants: ["default"],
    render: () => (
      <TreePro
        nodes={[
          {
            id: "root",
            data: { label: "Org" },
            children: [{ id: "child", data: { label: "Team" } }],
          },
        ]}
        ariaLabel="Org tree"
        renderLabel={(n) => n.data.label}
        defaultExpanded={["root"]}
      />
    ),
  },
  {
    id: "ui-pro.type-to-confirm",
    name: "TypeToConfirm",
    package: "@caisson-sh/ui-pro",
    tier: "ui-pro",
    description:
      "A retype-the-phrase destructive-action confirm — arms only on an exact match.",
    variants: ["danger"],
    render: () => <TypeToConfirmDemo />,
  },
];
