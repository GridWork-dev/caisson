/**
 * Pure tree flattening for TreePro. A virtualized tree renders a flat list of the currently VISIBLE
 * rows (an ancestor's descendants appear only while it is expanded), so the windowing math can slice
 * it. Kept free of React so the visible-row projection is unit-tested directly.
 */

export interface TreeNode<T> {
  id: string;
  data: T;
  /** Loaded children. */
  children?: TreeNode<T>[];
  /** True when the node has children that are not loaded yet (lazy). */
  hasChildren?: boolean;
}

export interface FlatNode<T> {
  id: string;
  data: T;
  /** 0-based nesting depth (for indentation + `aria-level = depth + 1`). */
  depth: number;
  expanded: boolean;
  /** Whether the node can be expanded at all (loaded children OR a lazy marker). */
  expandable: boolean;
  /** True for a lazy node that is expanded but whose children are not loaded yet. */
  loading: boolean;
}

function nodeExpandable<T>(node: TreeNode<T>): boolean {
  return (node.children?.length ?? 0) > 0 || node.hasChildren === true;
}

/**
 * Flatten `nodes` into the ordered list of visible rows given the `expanded` id set. A node's
 * children are included only when it is both expandable and expanded. A lazy node (marked
 * `hasChildren` with no loaded `children`) that is expanded is reported `loading: true` so the view
 * can show a spinner and trigger a fetch.
 */
export function flattenTree<T>(
  nodes: readonly TreeNode<T>[],
  expanded: ReadonlySet<string>,
  depth = 0,
): FlatNode<T>[] {
  const out: FlatNode<T>[] = [];
  for (const node of nodes) {
    const expandable = nodeExpandable(node);
    const isExpanded = expandable && expanded.has(node.id);
    const loaded = node.children ?? [];
    const loading =
      isExpanded && loaded.length === 0 && node.hasChildren === true;
    out.push({
      id: node.id,
      data: node.data,
      depth,
      expanded: isExpanded,
      expandable,
      loading,
    });
    if (isExpanded && loaded.length > 0) {
      out.push(...flattenTree(loaded, expanded, depth + 1));
    }
  }
  return out;
}
