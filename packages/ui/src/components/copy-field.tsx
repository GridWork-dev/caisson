"use client";

import { useState } from "react";
import type { HTMLAttributes } from "react";

import { Icon } from "./icon";

import "./copy-field.css";

export interface CopyFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** The value shown and copied. */
  value: string;
  /** Accessible name for the field + copy button context (e.g. "API key"). */
  label: string;
  /** Render the value in the mono face (keys, ids, hashes). Default true. */
  mono?: boolean;
  /** Mask the value (dots) until copied — for secrets. */
  secret?: boolean;
}

/**
 * CopyField — a read-only value with a one-click copy button. Writes to the clipboard and flips to a
 * "Copied" confirmation for ~1.5s (announced via `role="status"`). The value box is a read-only input
 * so the text is selectable and screen-reader reachable; `secret` masks it until copied.
 */
export function CopyField({
  value,
  label,
  mono = true,
  secret = false,
  className,
  ...rest
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — leave the value selectable so
      // the user can copy manually; no confirmation flash.
    }
  };

  return (
    <div
      className={className ? `cs-copy ${className}` : "cs-copy"}
      data-mono={mono ? "" : undefined}
      {...rest}
    >
      <input
        className="cs-copy__value"
        type={secret && !copied ? "password" : "text"}
        value={value}
        readOnly
        aria-label={label}
      />
      <button
        type="button"
        className="cs-copy__button"
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        data-copied={copied ? "" : undefined}
        onClick={copy}
      >
        <Icon name={copied ? "check" : "file-check"} />
        <span className="cs-copy__label">{copied ? "Copied" : "Copy"}</span>
      </button>
      <span className="cs-copy__live" role="status">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </div>
  );
}
