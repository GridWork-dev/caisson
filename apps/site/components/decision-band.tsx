// Decision band (ADR-0378 lock 5) — replaces the deleted StackBuilderLazy calculator section on
// the homepage. Three persona path cards, each deep-linking straight to the marketplace viewer for
// its bundle (never adding to the cart from here — zero cart chrome on the homepage), plus a ghost
// link to the honest stack-fit adapter matrix. Server component: every link is a real navigation,
// no client state.
//
// Prices, labels, and icons all read from the pricing SOT + the shared marketplace helpers (never
// hand-typed), so a reprice or relabel can't drift this band from the catalog.
import Link from "next/link";

import { Icon } from "@/components";
import { bundlePrice, type BundleId } from "@/lib/pricing";

import { BUNDLE_ICON, bundleLabel } from "./marketplace";
import styles from "./decision-band.module.css";

interface DecisionPath {
  /** The buyer question this path answers. */
  persona: string;
  bundle: BundleId;
}

// The three persona paths ADR-0378 lock 5 names — a fixed subset of the six bundles, in the
// locked order. Everything/Agentic-Dev/Provenance have no path card here; they stay reachable
// from the marketplace itself.
const DECISION_PATHS: readonly DecisionPath[] = [
  { persona: "Pass an audit", bundle: "compliance" },
  { persona: "Ship AI features", bundle: "ai-production" },
  { persona: "Build offline-first", bundle: "local-first" },
];

export function DecisionBand() {
  return (
    <div className={styles.band}>
      <div className={styles.paths}>
        {DECISION_PATHS.map((p) => (
          <Link
            key={p.bundle}
            href={`/marketplace?view=bundle:${p.bundle}`}
            className={styles.path}
          >
            <Icon name={BUNDLE_ICON[p.bundle]} size="lg" />
            <span className={styles.persona}>{p.persona}</span>
            <span className={styles.bundleName}>{bundleLabel(p.bundle)}</span>
            <span className={`cs-num ${styles.price}`}>
              {bundlePrice(p.bundle)}
            </span>
          </Link>
        ))}
      </div>
      <p className={styles.fit}>
        <Link href="/stack-fit" className="cs-link">
          Does it fit your stack?
        </Link>
      </p>
    </div>
  );
}
