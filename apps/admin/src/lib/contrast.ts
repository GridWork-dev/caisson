import { wcagContrast } from "culori";

export interface ContrastResult {
  ratio: number;
  passesBody: boolean;
  passesLarge: boolean;
}

/** WCAG contrast between two CSS colours (OKLCH strings accepted). */
export function contrast(fg: string, bg: string): ContrastResult {
  const ratio = wcagContrast(fg, bg);
  return { ratio, passesBody: ratio >= 4.5, passesLarge: ratio >= 3 };
}

export function fmt(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}
