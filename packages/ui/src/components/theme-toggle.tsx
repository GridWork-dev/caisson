"use client";

import { useEffect, useState } from "react";

import { Icon } from "./icon";
import { THEME_STORAGE_KEY } from "./theme-init";
import "./theme-toggle.css";

type Mode = "dark" | "light";

function readPinned(): Mode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/** The effective mode right now: a pinned choice, else the OS preference, else dark (the default). */
function effectiveMode(): Mode {
  const pinned = readPinned();
  if (pinned) return pinned;
  if (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: light)").matches
  )
    return "light";
  return "dark";
}

export interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle (ADR-0100 F3) — an ICON control (no text), single button. 3-prong dark mode:
 * before any click the document follows the OS via CSS (`prefers-color-scheme`); this toggle tracks
 * that live and only PINS a choice on click (writes `data-theme` + localStorage). Paired with
 * `themeInitScript` (theme-init.ts) for FOUC-free pinned loads.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  // SSR-stable default = dark (the un-attributed :root default); resolved on mount to avoid mismatch.
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    setMode(effectiveMode());
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    // Follow the OS live until the user pins a choice (then localStorage wins and we stop tracking).
    const onChange = () => {
      if (!readPinned()) setMode(mq.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode / storage disabled — the in-memory toggle still works for this session. */
    }
    setMode(next);
  }

  const target: Mode = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={className ? `cs-theme-toggle ${className}` : "cs-theme-toggle"}
      onClick={toggle}
      data-mode={mode}
      aria-label={`Switch to ${target} theme`}
      title={`Switch to ${target} theme`}
    >
      <Icon name={mode === "dark" ? "moon" : "sun"} />
    </button>
  );
}
