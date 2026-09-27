"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { flattenTree, type FlatNode, type TreeNode } from "../lib/tree.ts";
import { windowRange } from "../lib/virtual.ts";

import "./tree-pro.css";

export interface TreeProProps<T> {
  nodes: readonly TreeNode<T>[];
  /** Render a node's label content (the row chrome — twisty, indent — is supplied). */
  renderLabel: (node: FlatNode<T>) => ReactNode;
  /** Accessible name for the tree. */
  ariaLabel: string;
  /** Fixed row height (px) for virtualization. Default 32. */
  rowHeight?: number;
  /** Scroll viewport height (px). Default 400. */
  viewportHeight?: number;
  /** Initially expanded node ids. */
  defaultExpanded?: readonly string[];
  /** Called the first time a lazy node (`hasChildren`, no loaded children) is expanded. */
  onLoadChildren?: (id: string) => void;
}

/**
 * TreePro — a virtualized tree for large hierarchies. Renders only the visible window of the
 * flattened, currently-expanded rows (fixed row height), lazy-loads children on first expand, and is
 * fully keyboard operable per the ARIA tree pattern: Up/Down move, Right expands or steps in, Left
 * collapses or steps out, Home/End jump, Enter/Space toggle. Themed through the floor token contract.
 */
export function TreePro<T>({
  nodes,
  renderLabel,
  ariaLabel,
  rowHeight = 32,
  viewportHeight = 400,
  defaultExpanded = [],
  onLoadChildren,
}: TreeProProps<T>) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(defaultExpanded),
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);

  const flat = useMemo(() => flattenTree(nodes, expanded), [nodes, expanded]);
  const focusIndex = Math.max(
    0,
    flat.findIndex((n) => n.id === focusedId),
  );

  // Move DOM focus onto the focused row after a keyboard move (and scroll it into view).
  useEffect(() => {
    if (!shouldFocus.current || focusedId === null) return;
    shouldFocus.current = false;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = focusIndex * rowHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + rowHeight > scroller.scrollTop + viewportHeight) {
      scroller.scrollTop = top + rowHeight - viewportHeight;
    }
    const el = scroller.querySelector<HTMLElement>(
      `[data-treeid="${CSS.escape(focusedId)}"]`,
    );
    el?.focus();
  }, [focusedId, focusIndex, rowHeight, viewportHeight]);

  const setExpand = useCallback(
    (node: FlatNode<T>, open: boolean) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (open) next.add(node.id);
        else next.delete(node.id);
        return next;
      });
      // Ask the caller to load a lazy node's children on first open; idempotent callers no-op if
      // the node is already loaded.
      if (open && node.expandable) onLoadChildren?.(node.id);
    },
    [onLoadChildren],
  );

  const moveFocus = (index: number) => {
    const clamped = Math.min(Math.max(0, index), flat.length - 1);
    const target = flat[clamped];
    if (!target) return;
    shouldFocus.current = true;
    setFocusedId(target.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const node = flat[focusIndex];
    if (!node) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(focusIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(focusIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        moveFocus(0);
        break;
      case "End":
        e.preventDefault();
        moveFocus(flat.length - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (node.expandable && !node.expanded) setExpand(node, true);
        else if (node.expanded) moveFocus(focusIndex + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (node.expandable && node.expanded) setExpand(node, false);
        else moveFocus(focusIndex - 1);
        break;
      case "Enter":
      case " ":
        if (node.expandable) {
          e.preventDefault();
          setExpand(node, !node.expanded);
        }
        break;
    }
  };

  const win = windowRange(flat.length, scrollTop, rowHeight, viewportHeight);
  const rows = flat.slice(win.start, win.end);

  return (
    <div
      ref={scrollRef}
      className="cs-tree"
      role="tree"
      aria-label={ariaLabel}
      // Programmatically focusable (rows carry the roving tabIndex); keydown is handled on the
      // focused row and this container only scrolls.
      tabIndex={-1}
      style={{ maxHeight: `${viewportHeight}px` }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div
        style={{ height: `${flat.length * rowHeight}px`, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            top: `${win.padTop}px`,
            left: 0,
            right: 0,
          }}
        >
          {rows.map((node) => {
            const isFocusable =
              focusedId === null ? node === flat[0] : node.id === focusedId;
            return (
              <div
                key={node.id}
                className="cs-tree__row"
                role="treeitem"
                aria-level={node.depth + 1}
                aria-expanded={node.expandable ? node.expanded : undefined}
                aria-selected={node.id === focusedId}
                aria-busy={node.loading || undefined}
                data-treeid={node.id}
                tabIndex={isFocusable ? 0 : -1}
                onKeyDown={onKeyDown}
                style={{
                  height: `${rowHeight}px`,
                  paddingLeft: `calc(${node.depth} * var(--cs-space-5) + var(--cs-space-2))`,
                }}
                onFocus={() => setFocusedId(node.id)}
                onClick={() => {
                  if (node.expandable) setExpand(node, !node.expanded);
                }}
              >
                <span className="cs-tree__twisty" aria-hidden="true">
                  {node.expandable ? (node.expanded ? "▾" : "▸") : ""}
                </span>
                <span className="cs-tree__label">{renderLabel(node)}</span>
                {node.loading ? (
                  <span className="cs-tree__loading">Loading…</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
