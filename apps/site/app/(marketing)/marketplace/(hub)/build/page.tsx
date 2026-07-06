import { Section, StatusChip, Terminal } from "@/components";
import { StackBuilder } from "@/components/stack-builder";
import { bundleLabel } from "@/components/marketplace";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import {
  buildStackSummary,
  bundlePrice,
  formatUsd,
  modulesByBundle,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace — Build your stack",
  description:
    "Compose your own Caisson stack. Pick the modules you need and watch the running total — when a selection totals more than a bundle, the configurator points at the cheaper path.",
  path: "/marketplace/build",
});

// The Build tab (ADR-0237 F1): the stack configurator. The worked example in the terminal is
// DERIVED from the live pricing data (buildStackSummary over the ai-production members) so it can
// never again advertise a dropped SKU or stale math — the exact drift the ADR-0238 review caught
// in the old hand-written example.
const EXAMPLE_BUNDLE = "ai-production" as const;
const exampleModules = modulesByBundle(EXAMPLE_BUNDLE);
const exampleSummary = buildStackSummary(exampleModules.map((m) => m.id));
const pad = (s: string, w: number) => s + " ".repeat(Math.max(1, w - s.length));
// The id column only needs to be as wide as the longest id actually rendered below, plus a
// 1-space gap — a hardcoded width wider than that pads every "select" line past the mobile
// terminal's visible width, silently clipping the trailing digit of every 3-digit price under the
// no-affordance overflow-x:auto scroll (the $199/$149 lines truncated to $19/$14 at 390px; the
// shorter $99 line already fit).
const ID_COLUMN_WIDTH = Math.max(...exampleModules.map((m) => m.id.length)) + 1;

export default function MarketplaceBuildPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Build your stack", path: "/marketplace/build" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      <Section
        eyebrow="Configurator"
        title="Compose your own stack."
        lede="Pick the modules you need and watch the running total. When your picks total more than a bundle covers, the builder points at the cheaper path — the arithmetic, not a fabricated discount."
      >
        <div style={{ marginBottom: "var(--cs-space-8)" }}>
          <Terminal
            label="stack.compose"
            status={<StatusChip label="live total" tone="success" dot />}
          >
            {exampleModules
              .map(
                (m) => `select  ${pad(m.id, ID_COLUMN_WIDTH)} + $${m.amount}\n`,
              )
              .join("")}
            <span className="cs-tok-accent">
              {`total ${exampleSummary.moduleCount} modules $${exampleSummary.total}`}
            </span>
            {exampleSummary.upgrade
              ? `\nupgrade ${bundleLabel(EXAMPLE_BUNDLE)} bundle   ${bundlePrice(
                  EXAMPLE_BUNDLE,
                )}  →  save ${formatUsd(exampleSummary.upgrade.saves)}`
              : ""}
          </Terminal>
        </div>
        <StackBuilder />
      </Section>
    </>
  );
}
