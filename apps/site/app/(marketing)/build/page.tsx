import { Button, Hero, Section, StatusChip, Terminal } from "@/components";
import { StackBuilder } from "@/components/stack-builder";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Build your stack",
  description:
    "Compose your own Caisson edition. Pick the modules you need and watch the running total — when a selection totals more than an edition or the bundle, the configurator points at the cheaper path.",
  path: "/build",
});

// RSC shell (ADR-0191): the Hero + JSON-LD stay server-rendered; the configurator is the one client
// leaf (`StackBuilder`), which reads the shared cart/pricing hook.
export default function BuildPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Build your stack", path: "/build" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      <Hero
        eyebrow="Build your stack"
        title="Compose your own edition."
        lede="Pick the modules you need and watch the running total. When your picks total more than an edition or the bundle covers, the builder points at the cheaper path — the arithmetic, not a fabricated discount."
        ctas={
          <Button href="/modules" variant="ghost">
            Browse the catalog
          </Button>
        }
        artifact={
          <Terminal
            label="stack.compose"
            status={<StatusChip label="live total" tone="success" dot />}
          >
            {
              "select  field-crypto       + $199\nselect  audit-worm         + $149\nselect  retention-runner   + $199\nselect  compliance         + $299\n"
            }
            <span className="cs-tok-accent">total 4 modules $846</span>
            {"\nupgrade Compliance edition   $799  →  save $47"}
          </Terminal>
        }
      />

      <Section
        eyebrow="Configurator"
        title="Pick your modules."
        lede="Toggle any module to add it to the running total on the right. Compose across editions, then add the set to your cart — or take the edition the builder recommends."
      >
        <StackBuilder />
      </Section>
    </>
  );
}
