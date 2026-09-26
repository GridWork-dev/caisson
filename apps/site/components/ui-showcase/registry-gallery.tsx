"use client";

// The /ui gallery's demo grid (CAISSON-35) — reads the shared cross-app component registry
// (@caisson-sh/demo-registry) so every consumer renders the exact same UI Pro catalog off the exact
// same data, instead of hand-rolled demo implementations that could silently drift apart. A CLIENT
// component: `entry.render` closures are exported from a "use client" registry module
// (tooling/demo-registry/src/entries/ui-pro.tsx), so calling them stays client-side, and the server
// page.tsx (which needs `metadata`, server-only) drops this island in.
import { entriesByTier, type CatalogEntry } from "@caisson-sh/demo-registry";

const DEMOS = entriesByTier("ui-pro");

function DemoCard({ entry }: { entry: CatalogEntry }) {
  return (
    <article className="ui-demo" id={entry.id}>
      <header className="ui-demo__head">
        <div>
          <h3 className="ui-demo__name">{entry.name}</h3>
          <p className="ui-demo__blurb">{entry.description}</p>
        </div>
        <code className="ui-demo__symbol">{entry.package}</code>
      </header>
      <div className="ui-demo__stage">
        {entry.render ? entry.render() : null}
      </div>
      <footer className="ui-demo__foot">
        <span className="ui-demo__ships">
          Ships in <strong>{entry.package}</strong>.
        </span>
      </footer>
    </article>
  );
}

export function UiProGallery() {
  return (
    <div className="ui-gallery">
      {DEMOS.map((entry) => (
        <DemoCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
