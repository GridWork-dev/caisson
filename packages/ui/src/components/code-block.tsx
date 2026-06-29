import type { ReactNode } from "react";

import { Terminal } from "./terminal";

import "./code-block.css";

export interface CodeBlockProps {
  /**
   * The code body. String or tinted `ReactNode` — compose `<span className="cs-tok-danger">`
   * (etc.) for load-bearing tokens that must read as danger/accent/muted.
   */
  code: ReactNode;
  /** Accessible label; also the chrome-bar title when `frame` is set (defaults to `"shell"`). */
  label?: string;
  /** Wrap the code in terminal chrome (`<Terminal>`) instead of a bare `<pre>`. */
  frame?: boolean;
  /** A `<StatusChip />` or text rendered in the terminal chrome bar (only when `frame`). */
  status?: ReactNode;
}

/**
 * Recipe primitive (ADR-0099) — purely presentational, server-safe (no hook/handler/browser API,
 * so no `"use client"`). Two shapes from one prop API:
 *   - `frame` → defers to the sibling `<Terminal>` primitive (chrome bar + body); terminal classes
 *     are owned there, never redefined here.
 *   - default → a bare `<pre class="cs-code">`, the always-dark code surface.
 * No `forwardRef`: the component branches between two roots (a `<Terminal>` wrapper vs a `<pre>`),
 * so there is no single stable DOM root to forward a ref to — unlike the `Button` reference.
 */
export function CodeBlock({ code, label, frame, status }: CodeBlockProps) {
  if (frame) {
    return (
      <Terminal label={label ?? "shell"} status={status}>
        {code}
      </Terminal>
    );
  }
  return (
    <pre className="cs-code" aria-label={label}>
      {code}
    </pre>
  );
}
