"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

// Caisson owns the theme via data-theme + localStorage('cs-theme') (studio pattern, ADR-0042).
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setMode(current);
  }, []);

  function apply(next: Mode) {
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cs-theme", next);
    } catch {
      /* storage blocked — runtime toggle still works */
    }
  }

  return (
    <div className="cs-seg" role="group" aria-label="Theme">
      <button
        type="button"
        aria-pressed={mode === "dark"}
        onClick={() => apply("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        aria-pressed={mode === "light"}
        onClick={() => apply("light")}
      >
        Light
      </button>
    </div>
  );
}
