"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

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
    <div className="seg" role="group" aria-label="Studio theme">
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
