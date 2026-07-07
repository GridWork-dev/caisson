import styles from "./file-tree.module.css";

// FileTree — a generic recursive source-tree renderer (site-local). Fed REAL monorepo paths by the
// caller so the marketing page's structure IS the codebase's structure (an honest artifact, not a
// screenshot). Semantic nested <ul> — screen-reader-navigable with native list semantics, no bogus
// ARIA tree roles (which would need the full treeitem/aria-expanded machinery to be correct).

export interface FileNode {
  name: string;
  /** Present (even if empty) marks a directory; its entries. Absent marks a file. */
  children?: readonly FileNode[];
  /** One-line honest annotation shown muted after the name. */
  note?: string;
}

function TreeItem({ node }: { node: FileNode }) {
  const isDir = node.children !== undefined;
  return (
    <li className={styles.item}>
      <span className={isDir ? styles.dir : styles.file}>
        {node.name}
        {isDir ? "/" : ""}
      </span>
      {node.note ? <span className={styles.note}>{node.note}</span> : null}
      {isDir && node.children && node.children.length > 0 ? (
        <ul className={styles.list}>
          {node.children.map((child) => (
            <TreeItem key={child.name} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FileTree({
  root,
  label,
}: {
  root: readonly FileNode[];
  label?: string;
}) {
  return (
    <div className={styles.tree}>
      <ul className={styles.list} aria-label={label ?? "Repository structure"}>
        {root.map((node) => (
          <TreeItem key={node.name} node={node} />
        ))}
      </ul>
    </div>
  );
}
