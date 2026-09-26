"use client";

// @caisson-sh/demo-registry — the 33 @caisson-sh/ui (apache-base) entries. Every demo composes the SHIPPED
// kit component directly (never a re-implementation) with static sample data — the same "what ships
// is what you see" recipe the absorbed /design/components gallery followed.
// A handful of components are inherently stateful (Dialog, ConfirmDialog, Select, Toast) — those get
// a small named wrapper component using hooks; a `render()` closure that just returns JSX stays a
// plain function.
import { useState } from "react";
import {
  AppShell,
  Button,
  Card,
  CodeBlock,
  ConfirmDialog,
  CopyField,
  CredentialStrip,
  DataTable,
  DetailList,
  Dialog,
  BundleCard,
  EmptyState,
  ErrorState,
  Faq,
  FeatureGrid,
  FormField,
  Hero,
  Icon,
  LedgerList,
  LoadingState,
  MetricStat,
  MobileBuyBar,
  MoneyCell,
  Pagination,
  Reveal,
  Section,
  Select,
  SkuMatrix,
  StatusChip,
  StatusPill,
  Terminal,
  ThemeToggle,
  Toast,
  ToastRegion,
  type DataTableColumn,
  type IconName,
} from "@caisson-sh/ui/components";
import type { CatalogEntry } from "../schema.ts";

const ICONS: IconName[] = [
  "shield",
  "lock",
  "database",
  "terminal",
  "gauge",
  "key",
  "server",
  "cpu",
  "scale",
  "check",
  "alert",
  "worm",
];

interface DemoRow {
  id: string;
  name: string;
  tier: string;
  credits: number;
}
const ROWS: DemoRow[] = [
  { id: "r1", name: "field-crypto", tier: "Compliance", credits: 1200 },
  { id: "r2", name: "audit-worm", tier: "Compliance", credits: 900 },
  { id: "r3", name: "ai-config", tier: "AI Production", credits: 400 },
];
const DATA_TABLE_COLUMNS: readonly DataTableColumn<DemoRow>[] = [
  { key: "name", header: "Module", render: (r) => r.name },
  { key: "tier", header: "Bundle", render: (r) => r.tier },
  {
    key: "credits",
    header: "Credits",
    numeric: true,
    sortable: true,
    sortValue: (r) => r.credits,
    render: (r) => <MoneyCell value={r.credits} unit="credits" />,
  },
];

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Revoke access">
        <p className="muted">
          This demo dialog composes the floor `Dialog` primitive — modal
          variant, centered.
        </p>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </Dialog>
    </>
  );
}

function ConfirmDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="ghost">
        Delete module
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this module?"
        message="This cannot be undone."
        tone="danger"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

function SelectDemo() {
  const [value, setValue] = useState("compliance");
  return (
    <Select
      options={[
        { value: "compliance", label: "Compliance" },
        { value: "ai-production", label: "AI Production" },
        { value: "local-first", label: "Local-first" },
        { value: "legacy", label: "Legacy tier", disabled: true },
      ]}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label="Bundle"
    />
  );
}

function ToastDemo() {
  return (
    <ToastRegion placement="bottom">
      <Toast tone="success" title="Grant applied" onDismiss={() => {}}>
        3 entitlements granted to account 8f21…
      </Toast>
      <Toast tone="warning">Updates window closes in 4 days.</Toast>
    </ToastRegion>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(2);
  return <Pagination page={page} pageCount={9} onPageChange={setPage} />;
}

function AppShellDemo() {
  return (
    <div
      style={{
        height: "22rem",
        overflow: "hidden",
        position: "relative",
        border: "1px solid var(--cs-border)",
        borderRadius: "var(--cs-radius-md)",
      }}
    >
      <AppShell
        brand={<span className="mono">caisson</span>}
        nav={[
          { label: "Overview", href: "#", icon: "gauge", active: true },
          { label: "Business", href: "#", icon: "wallet" },
          { label: "Ops", href: "#", icon: "server" },
        ]}
      >
        <div style={{ padding: "var(--cs-space-6)" }}>
          <p className="muted">
            Main content region — clipped for the catalog preview (`AppShell`
            fills 100vh by design).
          </p>
        </div>
      </AppShell>
    </div>
  );
}

export const UI_BASE_ENTRIES: CatalogEntry[] = [
  {
    id: "ui.app-shell",
    name: "AppShell",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The buyer-dashboard data-app grid: collapsible sidebar nav, top bar, brand slot, off-canvas mobile drawer.",
    variants: ["collapsed", "mobile drawer"],
    render: () => <AppShellDemo />,
  },
  {
    id: "ui.button",
    name: "Button",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Primary/ghost variants, sm size, disabled, and asChild link composition.",
    variants: ["primary", "ghost", "sm", "disabled", "asChild"],
    render: () => (
      <div
        className="row"
        style={{ gap: "var(--cs-space-3)", flexWrap: "wrap" }}
      >
        <Button>Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button size="sm">Primary · sm</Button>
        <Button variant="ghost" size="sm">
          Ghost · sm
        </Button>
        <Button disabled>Disabled</Button>
      </div>
    ),
  },
  {
    id: "ui.card",
    name: "Card",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The hairline surface primitive — raised one tonal step, no hover.",
    variants: ["default"],
    render: () => (
      <Card>
        <h3 style={{ marginBottom: "var(--cs-space-2)" }}>Surface card</h3>
        <p className="muted">
          Composition only; layout lives with the consumer.
        </p>
      </Card>
    ),
  },
  {
    id: "ui.code-block",
    name: "CodeBlock",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Framed or bare code presentation with an optional label + status slot.",
    variants: ["framed", "bare"],
    render: () => (
      <CodeBlock
        frame
        label="deny.ts"
        status={<StatusChip tone="accent" label="RLS" />}
        code="if (!row) throw new Forbidden(); // fail-closed"
      />
    ),
  },
  {
    id: "ui.confirm-dialog",
    name: "ConfirmDialog",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A destructive-action confirm modal — danger tone, busy state.",
    variants: ["danger"],
    render: () => <ConfirmDialogDemo />,
  },
  {
    id: "ui.copy-field",
    name: "CopyField",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A labeled, mono-by-default value with a copy-to-clipboard action; `secret` masks it.",
    variants: ["default", "secret"],
    render: () => (
      <div className="stack" style={{ gap: "var(--cs-space-3)" }}>
        <CopyField label="API key" value="csn_live_8f21a0c9…" />
        <CopyField label="Signing secret" value="whsec_9f21a0c9b7e4" secret />
      </div>
    ),
    sampleProps: {
      label: "API key",
      value: "csn_live_8f21a0c9…",
      secret: false,
    },
  },
  {
    id: "ui.credential-strip",
    name: "CredentialStrip",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The certification-scope proof strip (items + a scope-boundary note).",
    variants: ["default"],
    render: () => (
      <CredentialStrip
        items={["SOC 2", "HIPAA", "GDPR", "ISO 27001"]}
        note="Caisson gives you the controls; certification is your audit."
      />
    ),
  },
  {
    id: "ui.data-table",
    name: "DataTable",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Sortable, dense, filterable rows with a built-in loading/empty state.",
    variants: ["sortable", "dense"],
    render: () => (
      <DataTable
        columns={DATA_TABLE_COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        dense
      />
    ),
  },
  {
    id: "ui.detail-list",
    name: "DetailList",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description: "A term/description list — stacked or two-column layout.",
    variants: ["stacked", "columns"],
    render: () => (
      <DetailList
        layout="columns"
        items={[
          { term: "License", description: "csn_lic_9f21…", mono: true },
          { term: "Tier", description: "pro" },
          { term: "Docs", description: "Read the docs", href: "#" },
        ]}
      />
    ),
  },
  {
    id: "ui.dialog",
    name: "Dialog",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Centered modal or edge drawer, native <dialog>-backed, Escape/backdrop close.",
    variants: ["modal", "drawer"],
    render: () => <DialogDemo />,
  },
  {
    id: "ui.edition-card",
    name: "BundleCard",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A bundle marketing card — lead variant, icon, status chip, proof line.",
    variants: ["lead", "default"],
    render: () => (
      <div className="cs-editions">
        <BundleCard
          lead
          href="#"
          name="Compliance"
          icon="shield"
          status={<StatusChip tone="accent" label="bundle" />}
          line="Field-crypto, append-only audit, fail-closed RLS."
          proof="$ caisson audit verify --chain  ✓ intact"
        />
      </div>
    ),
  },
  {
    id: "ui.empty-state",
    name: "EmptyState",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      'A plain-English "nothing here yet" block with an optional CTA slot.',
    variants: ["default", "with action"],
    render: () => (
      <EmptyState
        title="No licenses issued"
        description="Issued licenses will appear here as the issuer signs them."
        action={<Button size="sm">Issue a license</Button>}
      />
    ),
  },
  {
    id: "ui.error-state",
    name: "ErrorState",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description: "A failure block — reassurance + one next step.",
    variants: ["default"],
    render: () => (
      <ErrorState
        description="Couldn't load usage for this window. Try again."
        action={<Button size="sm">Retry</Button>}
      />
    ),
  },
  {
    id: "ui.faq",
    name: "Faq",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "An accessible disclosure list; `defaultOpenFirst` opens the lead question.",
    variants: ["default"],
    render: () => (
      <Faq
        defaultOpenFirst
        items={[
          {
            question: "Is Caisson a SaaS?",
            answer: "No — a codebase you own.",
          },
          {
            question: "What does certification require?",
            answer: "Your audit; Caisson gives you the evidence.",
          },
        ]}
      />
    ),
  },
  {
    id: "ui.feature-grid",
    name: "FeatureGrid",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A 2 or 3-column responsive feature layout — pure composition shell.",
    variants: ["2-col", "3-col"],
    render: () => (
      <FeatureGrid cols={3}>
        <Card>
          <h3>Fail-closed RLS</h3>
        </Card>
        <Card>
          <h3>WORM storage</h3>
        </Card>
        <Card>
          <h3>Audit chain</h3>
        </Card>
      </FeatureGrid>
    ),
  },
  {
    id: "ui.form-field",
    name: "FormField",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Label + helper/error text association via Radix Slot, for a single control child.",
    variants: ["default", "error"],
    render: () => (
      <div className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <FormField label="Account email" helperText="The billing contact.">
          <input type="email" defaultValue="founder@acme.com" />
        </FormField>
        <FormField label="Webhook secret" error="Must start with whsec_">
          <input defaultValue="bad-secret" />
        </FormField>
      </div>
    ),
  },
  {
    id: "ui.hero",
    name: "Hero",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The split marketing header — display title, lede, CTAs, credentials, artifact slot.",
    variants: ["default"],
    render: () => (
      <Hero
        eyebrow="compliance-grade infrastructure"
        title="Ship the controls. Keep the evidence."
        lede="Display title, lede, CTAs, a credential strip, and a framed evidence artifact."
        ctas={
          <>
            <Button>Get Caisson</Button>
            <Button variant="ghost">Read the docs</Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={["SOC 2", "HIPAA", "GDPR"]}
            note="Certification is your audit."
          />
        }
        artifact={
          <Terminal
            label="caisson · audit"
            status={<StatusChip tone="success" label="verified" icon="check" />}
          >
            <div className="mono">$ caisson audit verify --chain</div>
          </Terminal>
        }
      />
    ),
  },
  {
    id: "ui.icon",
    name: "Icon",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The one icon surface (Lucide set + registrable bespoke glyphs), 24-grid, currentColor.",
    variants: ICONS,
    render: () => (
      <div
        className="row"
        style={{ gap: "var(--cs-space-4)", flexWrap: "wrap" }}
      >
        {ICONS.map((name) => (
          <Icon key={name} name={name} size="lg" aria-label={name} />
        ))}
      </div>
    ),
  },
  {
    id: "ui.ledger-list",
    name: "LedgerList",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A credit/money delta ledger — one row per entry, running balance.",
    variants: ["credits"],
    render: () => (
      <LedgerList
        unit="credits"
        entries={[
          {
            id: "e1",
            timestamp: "2026-07-01T12:00:00Z",
            reason: "Purchase: Compliance",
            delta: 5000,
            balance: 5000,
          },
          {
            id: "e2",
            timestamp: "2026-07-03T09:30:00Z",
            reason: "Metered inference",
            delta: -120,
            balance: 4880,
          },
        ]}
      />
    ),
  },
  {
    id: "ui.loading-state",
    name: "LoadingState",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A shape-matched skeleton — table/stat/list/block variants, no layout shift on load.",
    variants: ["table", "stat", "list", "block"],
    render: () => (
      <div className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <LoadingState variant="table" rows={3} columns={3} />
        <LoadingState variant="stat" />
      </div>
    ),
  },
  {
    id: "ui.metric-stat",
    name: "MetricStat",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A caption/value/hint stat block, optional icon, four semantic tones.",
    variants: ["default", "positive", "warning", "critical"],
    render: () => (
      <div
        className="row"
        style={{ gap: "var(--cs-space-6)", flexWrap: "wrap" }}
      >
        <MetricStat
          label="Credits spent"
          value={<MoneyCell value={4880} unit="credits" />}
          tone="default"
        />
        <MetricStat
          label="Chain status"
          value="Verified"
          tone="positive"
          icon="check"
        />
        <MetricStat
          label="Updates window"
          value="4 days"
          hint="closes soon"
          tone="warning"
        />
      </div>
    ),
  },
  {
    id: "ui.mobile-buy-bar",
    name: "MobileBuyBar",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The sticky mobile checkout bar — label, formatted price, and the purchase action slot.",
    variants: ["default"],
    render: () => (
      <MobileBuyBar
        label="Compliance bundle"
        price="$1,649"
        action={<Button size="sm">Buy</Button>}
      />
    ),
  },
  {
    id: "ui.money-cell",
    name: "MoneyCell",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Integer-cents/credits display formatting — signed + sign-toned ledger variants.",
    variants: ["usd-cents", "credits", "signed"],
    render: () => (
      <div className="row" style={{ gap: "var(--cs-space-4)" }}>
        <MoneyCell value={164900} unit="usd-cents" />
        <MoneyCell value={4880} unit="credits" />
        <MoneyCell value={-120} unit="credits" sign signTone />
      </div>
    ),
  },
  {
    id: "ui.pagination",
    name: "Pagination",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A 0-indexed pager with a bounded sibling window around the current page.",
    variants: ["controlled"],
    render: () => <PaginationDemo />,
  },
  {
    id: "ui.reveal",
    name: "Reveal",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "Fade-up-once on scroll (IntersectionObserver), honors prefers-reduced-motion.",
    variants: ["default"],
    render: () => (
      <Reveal>
        <Card>
          <p className="muted">Scrolls into view once; gated on `.cs-js`.</p>
        </Card>
      </Reveal>
    ),
  },
  {
    id: "ui.section",
    name: "Section",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A toned content band — surface or accent-tint background variants.",
    variants: ["surface", "tint"],
    render: () => (
      <Section
        band="tint"
        eyebrow="section · tint band"
        title="A toned section shell"
        lede="Pure composition — the shell, eyebrow, title and lede are base.css utilities."
      />
    ),
  },
  {
    id: "ui.select",
    name: "Select",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A native <select> with a typed option list, placeholder, and invalid state.",
    variants: ["controlled"],
    render: () => <SelectDemo />,
  },
  {
    id: "ui.sku-matrix",
    name: "SkuMatrix",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description: "A boolean coverage matrix — module × bundle inclusion grid.",
    variants: ["default"],
    render: () => (
      <SkuMatrix
        columns={["Compliance", "AI Kit", "Local-first", "Agentic"]}
        rows={[
          { label: "field-crypto", cells: [true, false, true, false] },
          { label: "audit-worm", cells: [true, true, false, false] },
        ]}
      />
    ),
  },
  {
    id: "ui.status-chip",
    name: "StatusChip",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A small tone-coded chip — accent/success/muted, dot or icon leading glyph.",
    variants: ["accent", "success", "muted"],
    render: () => (
      <div className="row" style={{ gap: "var(--cs-space-3)" }}>
        <StatusChip tone="accent" label="accent" dot />
        <StatusChip tone="success" label="success" icon="check" />
        <StatusChip tone="muted" label="muted" />
      </div>
    ),
  },
  {
    id: "ui.status-pill",
    name: "StatusPill",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The entitlement lifecycle pill — active/expired/revoked/pending.",
    variants: ["active", "expired", "revoked", "pending"],
    render: () => (
      <div className="row" style={{ gap: "var(--cs-space-3)" }}>
        <StatusPill status="active" />
        <StatusPill status="expired" />
        <StatusPill status="revoked" />
        <StatusPill status="pending" />
      </div>
    ),
  },
  {
    id: "ui.terminal",
    name: "Terminal",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A framed terminal artifact — label, status slot, mono content.",
    variants: ["default"],
    render: () => (
      <Terminal
        label="caisson · audit"
        status={<StatusChip tone="success" label="verified" icon="check" />}
      >
        <div className="mono">$ caisson audit verify --chain</div>
        <div className="mono cs-tok-success">
          ✓ 1,402 events · hash chain intact
        </div>
      </Terminal>
    ),
  },
  {
    id: "ui.theme-toggle",
    name: "ThemeToggle",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "The 3-prong (dark/light/OS-follow) theme control, pre-paint script pinned.",
    variants: ["default"],
    render: () => <ThemeToggle />,
  },
  {
    id: "ui.toast",
    name: "Toast",
    package: "@caisson-sh/ui",
    tier: "apache-base",
    description:
      "A dismissible notification, four tones, stacked in a placement region.",
    variants: ["success", "warning"],
    render: () => <ToastDemo />,
  },
];
