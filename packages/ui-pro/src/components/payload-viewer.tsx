"use client";

import { useMemo, useState } from "react";

import { CodeBlock } from "@caisson-sh/ui/components";

import {
  DEFAULT_REDACT_KEYS,
  REDACTED,
  isRedactedKey,
  redactValue,
} from "../lib/redact.ts";

import "./payload-viewer.css";

export interface PayloadViewerProps {
  /** The parsed payload (any JSON-shaped value). */
  value: unknown;
  /** Key names to mask, case-insensitive. Defaults to a conservative secret-key set. */
  redactKeys?: readonly string[];
  /** Expand nodes shallower than this depth on first render. Default 1 (top level open). */
  defaultExpandDepth?: number;
  /** Offer a raw (redacted) JSON view via the floor CodeBlock. Default true. */
  showRaw?: boolean;
  ariaLabel?: string;
}

type Scalar = string | number | boolean | null | undefined;

function scalarClass(v: Scalar): string {
  if (typeof v === "string") return "cs-payload__string";
  if (typeof v === "number") return "cs-payload__number";
  if (typeof v === "boolean") return "cs-payload__boolean";
  return "cs-payload__null";
}

function renderScalar(v: Scalar): string {
  if (typeof v === "string") return `"${v}"`;
  if (v === null || v === undefined) return "null";
  return String(v);
}

function JsonNode({
  label,
  value,
  keys,
  depth,
  defaultExpandDepth,
  redacted = false,
}: {
  label?: string | undefined;
  value: unknown;
  keys: ReadonlySet<string>;
  depth: number;
  defaultExpandDepth: number;
  redacted?: boolean;
}) {
  const isContainer = !redacted && value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < defaultExpandDepth);

  const indent = { paddingLeft: `calc(${depth} * var(--cs-space-4))` };

  if (redacted) {
    return (
      <div className="cs-payload__row" style={indent}>
        {label != null ? (
          <span className="cs-payload__key">{label}: </span>
        ) : null}
        <span className="cs-payload__redacted" aria-label="redacted">
          {REDACTED}
        </span>
      </div>
    );
  }

  if (!isContainer) {
    const v = value as Scalar;
    return (
      <div className="cs-payload__row" style={indent}>
        {label != null ? (
          <span className="cs-payload__key">{label}: </span>
        ) : null}
        <span className={scalarClass(v)}>{renderScalar(v)}</span>
      </div>
    );
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const summary = Array.isArray(value)
    ? `[ ${entries.length} ]`
    : `{ ${entries.length} }`;

  return (
    <div className="cs-payload__node">
      <div className="cs-payload__row" style={indent}>
        <button
          type="button"
          className="cs-payload__toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="cs-payload__twisty" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          {label != null ? (
            <span className="cs-payload__key">{label}: </span>
          ) : null}
          <span className="cs-payload__summary">{summary}</span>
        </button>
      </div>
      {open
        ? entries.map(([k, v]) => (
            <JsonNode
              key={k}
              label={Array.isArray(value) ? undefined : k}
              value={v}
              keys={keys}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
              redacted={!Array.isArray(value) && isRedactedKey(k, keys)}
            />
          ))
        : null}
    </div>
  );
}

/**
 * PayloadViewer — a redaction-aware viewer for JSON, OSCAL, and webhook payloads. Renders a
 * collapsible tree with typed, syntax-tinted leaves; masks secret-bearing keys everywhere in the
 * tree; and copies the REDACTED payload (never the raw secrets). A raw view is offered through the
 * floor `CodeBlock`, replacing the bare `<pre>{JSON.stringify}` dumps. The domain composition —
 * redaction plus the collapsible tree — is the point; a bare JSON tree is commodity.
 */
export function PayloadViewer({
  value,
  redactKeys,
  defaultExpandDepth = 1,
  showRaw = true,
  ariaLabel = "Payload",
}: PayloadViewerProps) {
  const keys = useMemo(
    () =>
      redactKeys
        ? new Set(redactKeys.map((k) => k.toLowerCase()))
        : DEFAULT_REDACT_KEYS,
    [redactKeys],
  );
  const [copied, setCopied] = useState(false);

  const redactedJson = useMemo(
    () => JSON.stringify(redactValue(value, keys), null, 2),
    [value, keys],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redactedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the raw disclosure keeps the value selectable.
    }
  };

  return (
    <div className="cs-payload" role="group" aria-label={ariaLabel}>
      <div className="cs-payload__bar">
        <span className="cs-payload__title">{ariaLabel}</span>
        <button
          type="button"
          className="cs-payload__copy"
          aria-label={
            copied ? "Redacted payload copied" : "Copy redacted payload"
          }
          onClick={copy}
          data-copied={copied ? "" : undefined}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="cs-payload__tree">
        <JsonNode
          value={value}
          keys={keys}
          depth={0}
          defaultExpandDepth={defaultExpandDepth}
        />
      </div>
      {showRaw ? (
        <details className="cs-payload__raw">
          <summary>Raw (redacted)</summary>
          <CodeBlock code={redactedJson} label={`${ariaLabel} JSON`} />
        </details>
      ) : null}
    </div>
  );
}
