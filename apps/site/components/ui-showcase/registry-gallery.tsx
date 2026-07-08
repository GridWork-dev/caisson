"use client";

// The /ui gallery's demo grid (CAISSON-35) — reads the shared cross-app component registry
// (@caisson/demo-registry) so site and admin (apps/admin/src/app/catalog/components/page.tsx)
// render the exact same UI Pro catalog off the exact same data, instead of two hand-rolled demo
// implementations that could silently drift apart. A CLIENT component: `entry.render` closures are
// exported from a "use client" registry module (packages/demo-registry/src/entries/ui-pro.tsx) —
// admin's catalog page already proves calling them client-side is the safe pattern; a Server
// Component invoking a closure captured in a "use client" file's data is not a pattern this repo
// has tested elsewhere, so this stays a client island the server page.tsx (which needs `metadata`,
// server-only) drops in.
import { entriesByTier, type CatalogEntry } from "@caisson/demo-registry";
import { AddToCartButton } from "@/components/add-to-cart-button";
import type { CartItem } from "@/lib/cart";

const DEMOS = entriesByTier("ui-pro");

function DemoCard({
  entry,
  buyItem,
}: {
  entry: CatalogEntry;
  buyItem: CartItem | undefined;
}) {
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
          Ships in <strong>{entry.package}</strong> — installed through the
          registry to entitled buyers.
        </span>
        {buyItem ? <AddToCartButton item={buyItem} variant="ghost" /> : null}
      </footer>
    </article>
  );
}

export function UiProGallery({ buyItem }: { buyItem: CartItem | undefined }) {
  return (
    <div className="ui-gallery">
      {DEMOS.map((entry) => (
        <DemoCard key={entry.id} entry={entry} buyItem={buyItem} />
      ))}
    </div>
  );
}
