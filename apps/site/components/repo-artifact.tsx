import { CodeBlock, StatusChip } from "@/components";
import { MODULE_PAGES } from "@/lib/module-pages";

import styles from "./repo-artifact.module.css";

// The honest-artifact section (ADR-0285 §4 redesign): the marketing IA and the codebase IA are the
// same object. A color-coded, area-tagged source tree where clicking a code-bearing node reveals the
// REAL snippet beside it — every path is a real directory, every snippet copied verbatim from the
// file its header names (the honest-artifact floor, ADR-0082; no screenshots, no mockups). Two
// snippets (kernel, tenancy-rls) are base packages with no module record and are inlined verbatim;
// two (audit-worm, field-crypto) reuse the single-sourced depth-page artifact so they can't drift.
//
// A1 (ADR-0310): pure-CSS radio reveal — no "use client", no island. All four code cards are
// server-rendered; a native <input type=radio> per card + `:has()` sibling rules (the codebase's
// checkbox-tab convention) swap which one shows. One tab stop (the radio group) + arrow-key
// selection, which is MORE
// standard keyboard behaviour than the four individually-tabbable buttons this replaces.

type Area = "app" | "pkg" | "tooling";

interface TreeNode {
  name: string;
  area: Area;
  note?: string;
  /** Present marks a code-bearing (clickable) node — the key into CODE below. */
  codeId?: string;
  children?: readonly TreeNode[];
}

// The fail-closed RLS policy, verbatim from buildTenantPolicySql() (packages/tenancy-rls/src/rls.ts):
// no tenant GUC set → NULLIF folds '' to NULL → the USING predicate is NULL → every row is denied.
const RLS_POLICY_SQL = `ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING (
    account_id = NULLIF(current_setting('app.current_account', true), '')
  );`;

// The chain-link hash, verbatim from packages/kernel/src/audit-chain.ts: SHA-256 over the canonical
// 2-tuple [prevHash, payload] — tamper any historical row and every hash after it fails to recompute.
const AUDIT_CHAIN_TS = `export function hashChainLink(
  prevHash: string | null,
  payload: JsonValue,
): string {
  return createHash("sha256")
    .update(canonicalize([prevHash, payload]))
    .digest("hex");
}`;

interface CodeCard {
  file: string;
  label: string;
  code: string;
  statusLabel: string;
  statusTone: "accent" | "success";
}

/** The single-sourced depth-page artifact for a module id (reused so the two snippets can't drift). */
function moduleArtifact(slug: string): {
  file: string;
  label: string;
  code: string;
} {
  const rec = MODULE_PAGES.find((r) => r.slug === slug);
  if (!rec) {
    // The homepage tree only names shipped modules; this guards a future rename.
    return { file: `packages/${slug}`, label: slug, code: "" };
  }
  return {
    file: rec.artifact.file,
    label: rec.artifact.label,
    code: rec.artifact.code,
  };
}

const CODE: Record<string, CodeCard> = {
  rls: {
    file: "packages/tenancy-rls/src/rls.ts",
    label: "Fail-closed tenant isolation",
    code: RLS_POLICY_SQL,
    statusLabel: "FORCE",
    statusTone: "accent",
  },
  kernel: {
    file: "packages/kernel/src/audit-chain.ts",
    label: "The append-only chain link",
    code: AUDIT_CHAIN_TS,
    statusLabel: "sha256",
    statusTone: "accent",
  },
  "audit-worm": {
    ...moduleArtifact("audit-worm"),
    statusLabel: "verify",
    statusTone: "success",
  },
  "field-crypto": {
    ...moduleArtifact("field-crypto"),
    statusLabel: "AEAD",
    statusTone: "accent",
  },
};

// The radio group's initial pick — was `useState("rls")`, now the lone `defaultChecked`.
const DEFAULT_CODE_ID = "rls";
const RADIO_GROUP = "repo-artifact-card";

function tabId(codeId: string): string {
  return `repo-artifact-tab-${codeId}`;
}

const TREE: readonly TreeNode[] = [
  {
    name: "apps",
    area: "app",
    children: [
      { name: "site", area: "app", note: "marketing + docs, static" },
      { name: "demos", area: "app", note: "the live module demos" },
    ],
  },
  {
    name: "packages",
    area: "pkg",
    children: [
      {
        name: "kernel",
        area: "pkg",
        note: "audit-chain · canonicalize · branded money",
        codeId: "kernel",
      },
      {
        name: "tenancy-rls",
        area: "pkg",
        note: "fail-closed Postgres RLS",
        codeId: "rls",
      },
      {
        name: "audit-worm",
        area: "pkg",
        note: "append-only chain + S3 Object-Lock WORM",
        codeId: "audit-worm",
      },
      {
        name: "field-crypto",
        area: "pkg",
        note: "per-tenant HKDF-SHA256 encryption",
        codeId: "field-crypto",
      },
      { name: "ai-meter", area: "pkg", note: "token metering + spend caps" },
      { name: "ui", area: "pkg", note: "the Apache-2.0 component base" },
    ],
  },
  {
    name: "tooling",
    area: "tooling",
    children: [
      {
        name: "standards-gate",
        area: "tooling",
        note: "the one lint / tsconfig / test gate",
      },
    ],
  },
];

function TreeRow({ node }: { node: TreeNode }) {
  const isDir = node.children !== undefined;
  const clickable = node.codeId !== undefined;

  const inner = (
    <>
      <span className={styles.name}>
        {node.name}
        {isDir ? "/" : ""}
      </span>
      {node.note ? <span className={styles.note}>{node.note}</span> : null}
      {clickable ? <span className={styles.peek}>view →</span> : null}
    </>
  );

  return (
    <li className={styles.item} data-area={node.area}>
      {clickable ? (
        <label className={`${styles.row} ${styles.clickable}`}>
          <input
            type="radio"
            name={RADIO_GROUP}
            id={tabId(node.codeId!)}
            value={node.codeId}
            defaultChecked={node.codeId === DEFAULT_CODE_ID}
            className={styles.radioInput}
          />
          {inner}
        </label>
      ) : (
        <span className={`${styles.row} ${isDir ? styles.dir : ""}`}>
          {inner}
        </span>
      )}
      {isDir && node.children && node.children.length > 0 ? (
        <ul className={styles.list}>
          {node.children.map((child) => (
            <TreeRow key={child.name} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function RepoArtifact() {
  return (
    <div className={styles.grid}>
      <div className={styles.treeCard}>
        <span className="cs-card-title">caisson-sh/caisson</span>
        <p className={styles.hint}>
          Click a highlighted package to read its real code.
        </p>
        <ul className={styles.list} aria-label="Caisson monorepo structure">
          {TREE.map((node) => (
            <TreeRow key={node.name} node={node} />
          ))}
        </ul>
      </div>

      {/* min-width:0 on the grid track (styles.grid) lets the code body scroll INSIDE its own frame
          instead of blowing the column out (ADR-0285 §4 overflow fix). All four cards render; CSS
          shows the one whose radio is :checked (styles.cardPanel rules below) and hides the rest. */}
      <div className={styles.codeCard}>
        {Object.entries(CODE).map(([id, card]) => (
          <div key={id} className={styles.cardPanel} data-card-id={id}>
            {/* The chrome-bar header is the file path alone — a clean editor-tab identifier. The
                human descriptor (`card.label`) was joined on with a colon, making an over-long
                header pill; it already reads in the selected tree row's note, so the path carries
                the header. */}
            <CodeBlock
              frame
              label={card.file}
              status={
                <StatusChip
                  tone={card.statusTone}
                  dot
                  label={card.statusLabel}
                />
              }
              code={card.code}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
