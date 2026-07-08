import { Icon } from "@/components";
import { BUNDLE_MARKS } from "@/lib/marks";
import { BUNDLE_PRICES } from "@/lib/pricing";

import styles from "./marketplace-hero-artifact.module.css";

// The marketplace hero's right-half artifact (ADR-0285 one-surface framing): a self-contained,
// brand-styled diagram of the catalog's shape — the six bundles composing onto ONE Apache-2.0
// audited base. Echoes the framed-terminal aesthetic the homepage artifacts use (chrome bar +
// body), server-safe and presentational. Derived from BUNDLE_PRICES/BUNDLE_MARKS so it can never
// drift from the real catalog. No external assets — every glyph is an inline kit <Icon> (the site
// CSP blocks remote hosts).
//
// The base-slab capabilities are real, single-sourced facts about the open substrate (Apache-2.0;
// Postgres RLS · WORM · audit chain), matching the homepage's honest-artifact floor (ADR-0082).
const BASE_FACTS = ["Postgres RLS", "WORM", "audit chain", "metering"] as const;

export function MarketplaceHeroArtifact() {
  return (
    <div
      className={styles.frame}
      role="img"
      aria-label={`${BUNDLE_PRICES.length} Caisson bundles composing onto one Apache-2.0 audited base`}
    >
      <div className={styles.bar} aria-hidden="true">
        <span>caisson · one base, six bundles</span>
        <span className={styles.barChip}>
          <span className={styles.dot} />
          composable
        </span>
      </div>

      <div className={styles.body} aria-hidden="true">
        <ul className={styles.bundles}>
          {BUNDLE_PRICES.map((b) => (
            <li key={b.id} className={styles.bundle}>
              <Icon name={BUNDLE_MARKS[b.id]} />
              <span className={styles.bundleLabel}>{b.label}</span>
            </li>
          ))}
        </ul>

        <div className={styles.connector}>
          <span className={styles.connectorLine} />
          <span className={styles.connectorLabel}>compose onto</span>
          <span className={styles.connectorLine} />
        </div>

        <div className={styles.base}>
          <span className={styles.baseHead}>
            <Icon name="check" />
            Apache-2.0 audited base
          </span>
          <span className={styles.baseFacts}>{BASE_FACTS.join(" · ")}</span>
        </div>
      </div>
    </div>
  );
}
