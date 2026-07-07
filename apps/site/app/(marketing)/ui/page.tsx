import type { ReactNode } from "react";

import { Hero, Section } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { formatUsd, MODULE_PRICES } from "@/lib/pricing";
import {
  AuditTimelineDemo,
  ChartsDemo,
  CommandPaletteDemo,
  DataTableDemo,
  DateRangeDemo,
  DiffViewerDemo,
  KanbanDemo,
  OpsMatrixDemo,
  PayloadViewerDemo,
  TreeDemo,
  TypeToConfirmDemo,
} from "@/components/ui-showcase/demos";

const GALLERY_DESCRIPTION =
  "The @caisson/ui-pro component gallery — live, working demos of the premium data-ops and compliance components: an advanced data grid, a virtualized tree, an operations matrix, a hash-chain audit timeline, a redaction-aware payload viewer, a type-to-confirm dialog, an advanced date-range picker, a dependency-free chart pack, a command palette, a diff viewer, and a Kanban board.";

export const metadata = buildMetadata({
  title: "UI Pro component gallery",
  description: GALLERY_DESCRIPTION,
  path: "/ui",
});

// Cart-ready item for the per-demo buy CTAs. moduleCatalogItem resolves for every MODULE_PRICES id
// (see catalog.ts), so the undefined arm is type-narrowing only.
const uiProCatalog = moduleCatalogItem("ui-pro");
const uiProItem = uiProCatalog ? toCartItem(uiProCatalog) : undefined;
const uiProPrice = MODULE_PRICES.find((p) => p.id === "ui-pro");

interface Demo {
  id: string;
  name: string;
  /** The import symbol shown as a mono tag. */
  symbol: string;
  blurb: string;
  demo: ReactNode;
}

const DEMOS: Demo[] = [
  {
    id: "data-table-pro",
    name: "DataTable Pro",
    symbol: "DataTablePro",
    blurb:
      "Filter builder, column sort, row grouping with aggregation, CSV export, saved views, and row virtualization.",
    demo: <DataTableDemo />,
  },
  {
    id: "tree-pro",
    name: "Tree Pro",
    symbol: "TreePro",
    blurb:
      "A virtualized, keyboard-navigable tree following the ARIA tree pattern, with lazy child loading.",
    demo: <TreeDemo />,
  },
  {
    id: "ops-matrix",
    name: "Ops Matrix",
    symbol: "OpsMatrix",
    blurb:
      "A coverage matrix with tri-state cells and sticky headers — framework and control mapping at a glance.",
    demo: <OpsMatrixDemo />,
  },
  {
    id: "audit-timeline",
    name: "Audit Timeline",
    symbol: "AuditTimeline",
    blurb:
      "A hash-chain event log that verifies each link and badges tamper evidence — no store dependency.",
    demo: <AuditTimelineDemo />,
  },
  {
    id: "payload-viewer",
    name: "Payload Viewer",
    symbol: "PayloadViewer",
    blurb:
      "A collapsible JSON viewer that masks secret-bearing keys identically on screen and on copy.",
    demo: <PayloadViewerDemo />,
  },
  {
    id: "type-to-confirm",
    name: "Type to Confirm",
    symbol: "TypeToConfirm",
    blurb:
      "A phrase-gated confirmation dialog for destructive actions, with busy / ok / error result states.",
    demo: <TypeToConfirmDemo />,
  },
  {
    id: "date-range-picker",
    name: "Date-Range Picker",
    symbol: "DateRangePicker",
    blurb:
      "Native date inputs plus fiscal-quarter and billing-cycle presets and a comparison window.",
    demo: <DateRangeDemo />,
  },
  {
    id: "charts",
    name: "Charts pack",
    symbol: "LineChart · BarChart · AreaChart · Sparkline",
    blurb:
      "Dependency-free SVG charts driven by pure scale and path math — token-themed, light and dark.",
    demo: <ChartsDemo />,
  },
  {
    id: "command-palette",
    name: "Command Palette",
    symbol: "CommandPalette",
    blurb:
      "A ⌘K command menu with fuzzy matching, grouped results, and full keyboard navigation.",
    demo: <CommandPaletteDemo />,
  },
  {
    id: "diff-viewer",
    name: "Diff Viewer",
    symbol: "DiffViewer",
    blurb:
      "Before/after diffs for JSON and text, in split or unified layout — redaction-aware for secrets.",
    demo: <DiffViewerDemo />,
  },
  {
    id: "kanban-board",
    name: "Kanban Board",
    symbol: "KanbanBoard",
    blurb:
      "A drag-and-drop board with columns and swimlanes, with a fully keyboard-accessible move fallback.",
    demo: <KanbanDemo />,
  },
];

function DemoCard({ demo }: { demo: Demo }) {
  return (
    <article className="ui-demo" id={demo.id}>
      <header className="ui-demo__head">
        <div>
          <h3 className="ui-demo__name">{demo.name}</h3>
          <p className="ui-demo__blurb">{demo.blurb}</p>
        </div>
        <code className="ui-demo__symbol">{demo.symbol}</code>
      </header>
      <div className="ui-demo__stage">{demo.demo}</div>
      <footer className="ui-demo__foot">
        <span className="ui-demo__ships">
          Ships in <strong>@caisson/ui-pro</strong> — installed through the
          registry to entitled buyers.
        </span>
        {uiProItem ? (
          <AddToCartButton item={uiProItem} variant="ghost" />
        ) : null}
      </footer>
    </article>
  );
}

export default function UiGalleryPage() {
  const priceLabel = uiProPrice ? formatUsd(uiProPrice.amount) : null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumb([
              { name: "Home", path: "/" },
              { name: "UI Pro", path: "/ui" },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            softwareApplication({
              name: "Caisson UI Pro",
              description: GALLERY_DESCRIPTION,
              url: "/ui",
            }),
          ),
        }}
      />

      <style>{`
        .ui-gallery { display: grid; gap: var(--cs-space-8); }
        .ui-demo {
          border: 1px solid var(--cs-border);
          border-radius: var(--cs-radius-lg);
          background: var(--cs-surface-1);
          overflow: hidden;
        }
        .ui-demo__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--cs-space-4);
          padding: var(--cs-space-5) var(--cs-space-6);
          border-bottom: 1px solid var(--cs-border);
          flex-wrap: wrap;
        }
        .ui-demo__name { margin: 0; font-size: var(--cs-text-lg); font-weight: var(--cs-weight-semibold); }
        .ui-demo__blurb { margin: var(--cs-space-1) 0 0; color: var(--cs-fg-muted); font-size: var(--cs-text-sm); max-width: 52ch; }
        .ui-demo__symbol { flex: none; color: var(--cs-accent); font-family: var(--cs-font-mono); font-size: var(--cs-text-xs); }
        .ui-demo__stage { padding: var(--cs-space-6); overflow-x: auto; }
        .ui-demo__foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--cs-space-4);
          padding: var(--cs-space-4) var(--cs-space-6);
          border-top: 1px solid var(--cs-border);
          background: var(--cs-bg);
          flex-wrap: wrap;
        }
        .ui-demo__ships { color: var(--cs-fg-muted); font-size: var(--cs-text-sm); }
      `}</style>

      <Hero
        eyebrow="Component gallery"
        title="UI Pro — premium data-ops components"
        lede={
          <>
            Eleven production components for compliance and operations surfaces,
            layered on the open <code>@caisson/ui</code> token floor. Every demo
            below is live and interactive
            {priceLabel ? <> — the full kit is {priceLabel}, one-time.</> : "."}
          </>
        }
      />

      <Section band="surface" flush>
        <div className="ui-gallery">
          {DEMOS.map((d) => (
            <DemoCard key={d.id} demo={d} />
          ))}
        </div>
      </Section>
    </>
  );
}
