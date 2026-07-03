import { Section, StatusChip, Terminal } from "@/components";
import { StackBuilder } from "@/components/stack-builder";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import {
  buildStackSummary,
  editionPrice,
  formatUsd,
  modulesByEdition,
  priceById,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace — Build your stack",
  description:
    "Compose your own Caisson edition. Pick the modules you need and watch the running total — when a selection totals more than an edition or the bundle, the configurator points at the cheaper path.",
  path: "/marketplace/build",
});

// The Build tab (ADR-0237 F1): the stack configurator. The worked example in the terminal is
// DERIVED from the live pricing data (buildStackSummary over the ai-kit modules) so it can never
// again advertise a dropped SKU or stale math — the exact drift the ADR-0238 review caught in the
// old hand-written example.
const EXAMPLE_EDITION = "ai-kit" as const;
const exampleModules = modulesByEdition(EXAMPLE_EDITION);
const exampleSummary = buildStackSummary(exampleModules.map((m) => m.id));
const pad = (s: string, w: number) => s + " ".repeat(Math.max(1, w - s.length));

export default function MarketplaceBuildPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Build your stack", path: "/marketplace/build" },
  ]);
  const editionLabel = priceById(EXAMPLE_EDITION)?.label ?? EXAMPLE_EDITION;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      <Section
        eyebrow="Configurator"
        title="Compose your own edition."
        lede="Pick the modules you need and watch the running total. When your picks total more than an edition or the bundle covers, the builder points at the cheaper path — the arithmetic, not a fabricated discount."
      >
        <div style={{ marginBottom: "var(--cs-space-8)" }}>
          <Terminal
            label="stack.compose"
            status={<StatusChip label="live total" tone="success" dot />}
          >
            {exampleModules
              .map((m) => `select  ${pad(m.id, 18)} + $${m.amount}\n`)
              .join("")}
            <span className="cs-tok-accent">
              {`total ${exampleSummary.moduleCount} modules $${exampleSummary.total}`}
            </span>
            {exampleSummary.upgrade
              ? `\nupgrade ${editionLabel} edition   ${editionPrice(
                  EXAMPLE_EDITION,
                )}  →  save ${formatUsd(exampleSummary.upgrade.saves)}`
              : ""}
          </Terminal>
        </div>
        <StackBuilder />
      </Section>
    </>
  );
}
