import { describe, expect, test } from "bun:test";

import { flattenTree, type TreeNode } from "./tree";

interface N {
  label: string;
}

const tree: TreeNode<N>[] = [
  {
    id: "a",
    data: { label: "A" },
    children: [
      { id: "a1", data: { label: "A1" } },
      {
        id: "a2",
        data: { label: "A2" },
        children: [{ id: "a2x", data: { label: "A2x" } }],
      },
    ],
  },
  { id: "b", data: { label: "B" }, hasChildren: true }, // lazy, not loaded
];

describe("flattenTree", () => {
  test("collapsed roots yield only the roots", () => {
    const flat = flattenTree(tree, new Set());
    expect(flat.map((n) => n.id)).toEqual(["a", "b"]);
    expect(flat[0]!.expandable).toBe(true);
    expect(flat[0]!.expanded).toBe(false);
    expect(flat[1]!.expandable).toBe(true); // lazy marker counts as expandable
  });

  test("expanding reveals children at the right depth, recursively", () => {
    const flat = flattenTree(tree, new Set(["a", "a2"]));
    expect(flat.map((n) => n.id)).toEqual(["a", "a1", "a2", "a2x", "b"]);
    expect(flat.find((n) => n.id === "a1")!.depth).toBe(1);
    expect(flat.find((n) => n.id === "a2x")!.depth).toBe(2);
  });

  test("an expanded lazy node with no loaded children is reported loading", () => {
    const flat = flattenTree(tree, new Set(["b"]));
    const b = flat.find((n) => n.id === "b")!;
    expect(b.expanded).toBe(true);
    expect(b.loading).toBe(true);
    // no phantom child rows appear
    expect(flat.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
