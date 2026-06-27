export {};

declare global {
  interface Window {
    // Plausible custom-event tracker (ADR-0047). Present after the script loads; the inline
    // init in layout.tsx queues calls made before then.
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}
