import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TreePro } from "./tree-pro";
import type { TreeNode } from "../lib/tree";

interface N {
  label: string;
}

const nodes: TreeNode<N>[] = [
  {
    id: "root",
    data: { label: "Root" },
    children: [{ id: "child", data: { label: "Child" } }],
  },
];

describe("TreePro (initial render)", () => {
  test("is a labelled tree of treeitems with level + expanded state", () => {
    const html = renderToStaticMarkup(
      <TreePro
        nodes={nodes}
        ariaLabel="Org tree"
        renderLabel={(n) => n.data.label}
        defaultExpanded={["root"]}
      />,
    );
    expect(html).toContain('role="tree"');
    expect(html).toContain('aria-label="Org tree"');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('aria-level="1"');
    expect(html).toContain('aria-level="2"'); // the revealed child
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Root");
    expect(html).toContain("Child");
  });

  test("collapsed root hides its children and shows a collapsed twisty", () => {
    const html = renderToStaticMarkup(
      <TreePro
        nodes={nodes}
        ariaLabel="Org tree"
        renderLabel={(n) => n.data.label}
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Child");
  });
});
