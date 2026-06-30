export {};

declare global {
  interface Window {
    // Plausible custom-event tracker (ADR-0118). Bound by `@plausible-analytics/tracker`'s
    // `init()` (components/plausible-init.tsx) once `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set;
    // `undefined` before that — every call site guards with `window.plausible?.(...)`.
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}
