import styles from "./isolation-diagrams.module.css";

// Architecture-isolation + data-lifecycle diagram pair (D4b) — site-local, hand-authored CSS (no
// charting/graph dependency). Server components (static). Both depict SHIPPED behaviour only
// (ADR-0080): the real fail-closed RLS boundary (packages/tenancy-rls) and the real evidence
// lifecycle (packages/audit-worm + kernel). Theme-aware by token cascade; meaning is in the labels,
// the accent only reinforces text that already says "denied".

const DOWN = "↓";

/** Per-tenant RLS isolation: two tenants' queries return their own rows; a query that never set the
 *  tenant context returns nothing. The FORCE boundary is one band all three queries cross. */
export function IsolationDiagram() {
  return (
    <div
      className={styles.iso}
      role="group"
      aria-label="Per-tenant RLS isolation: with tenant context set a query returns only that tenant's rows; with no context set it returns zero rows"
    >
      <div className={styles.isoRow}>
        <div className={styles.cell}>
          <div className={styles.cellHead}>tenant A query</div>
          <div className={styles.cellSub}>SET app.current_account = A</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.cellHead}>tenant B query</div>
          <div className={styles.cellSub}>SET app.current_account = B</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.cellHead}>no-context query</div>
          <div className={styles.cellSub}>account never set</div>
        </div>
      </div>

      <div className={styles.arrows} aria-hidden="true">
        <span>{DOWN}</span>
        <span>{DOWN}</span>
        <span>{DOWN}</span>
      </div>

      <div className={styles.boundary}>
        FORCE ROW LEVEL SECURITY — USING (account_id ={" "}
        current_setting(&apos;app.current_account&apos;))
      </div>

      <div className={styles.arrows} aria-hidden="true">
        <span>{DOWN}</span>
        <span>{DOWN}</span>
        <span>{DOWN}</span>
      </div>

      <div className={styles.isoRow}>
        <div className={styles.cell}>
          <div className={styles.cellHead}>tenant A rows</div>
          <div className={styles.cellSub}>only A&apos;s data</div>
        </div>
        <div className={styles.cell}>
          <div className={styles.cellHead}>tenant B rows</div>
          <div className={styles.cellSub}>only B&apos;s data</div>
        </div>
        <div className={`${styles.cell} ${styles.deny}`}>
          <div className={`${styles.cellHead} ${styles.denyText}`}>
            0 rows — denied
          </div>
          <div className={styles.cellSub}>nothing, never everything</div>
        </div>
      </div>
    </div>
  );
}

/** Evidence data lifecycle: a privileged write joins the append-only chain, anchors to WORM, and
 *  stays verifiable + exportable. An ordered sequence — numbered so the order survives with no CSS. */
export function LifecycleDiagram() {
  return (
    <ol
      className={styles.flow}
      aria-label="Evidence data lifecycle, in four ordered stages"
    >
      <li className={styles.stage}>
        <div className={styles.stageHead}>1 · write</div>
        <div className={styles.stageSub}>
          a privileged action inserts an audit row
        </div>
      </li>
      <li className={styles.stage}>
        <div className={styles.stageHead}>2 · audit chain</div>
        <div className={styles.stageSub}>
          sha256(prev, payload) — append-only, one break cascades
        </div>
      </li>
      <li className={styles.stage}>
        <div className={styles.stageHead}>3 · WORM anchor</div>
        <div className={styles.stageSub}>
          S3 Object-Lock COMPLIANCE — no overwrite, no delete
        </div>
      </li>
      <li className={styles.stage}>
        <div className={styles.stageHead}>4 · verify + export</div>
        <div className={styles.stageSub}>
          caisson audit verify → evidence-pack export
        </div>
      </li>
    </ol>
  );
}
