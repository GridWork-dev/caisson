import { Hero, Section } from "@/components";
import { UiProGallery } from "@/components/ui-showcase/registry-gallery";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

// CAISSON-35: the demo grid itself reads @caisson/demo-registry (registry-gallery.tsx, a client
// island), so no second hand-rolled demo implementation of the same 11 UI Pro components can drift.
// This file stays the server shell: metadata, JSON-LD, and page chrome — none of which the registry
// needs to supply.
const GALLERY_DESCRIPTION =
  "The @caisson/ui-pro component gallery — live, working demos of the data-ops and compliance components: an advanced data grid, a virtualized tree, an operations matrix, a hash-chain audit timeline, a redaction-aware payload viewer, a type-to-confirm dialog, an advanced date-range picker, a dependency-free chart pack, a command palette, a diff viewer, and a Kanban board.";

export const metadata = buildMetadata({
  title: "UI Pro component gallery",
  description: GALLERY_DESCRIPTION,
  path: "/ui",
});

export default function UiGalleryPage() {
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
        title="UI Pro — data-ops components"
        lede={
          <>
            Eleven production components for compliance and operations surfaces,
            layered on the open <code>@caisson/ui</code> token floor. Every demo
            below is live and interactive.
          </>
        }
      />

      <Section band="surface" flush>
        <UiProGallery />
      </Section>
    </>
  );
}
