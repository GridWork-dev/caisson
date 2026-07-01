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
    // Cloudflare Turnstile explicit-render API (D9). Bound by the api.js script
    // (components/waitlist-form.tsx) only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; `undefined`
    // otherwise — every call site guards. The server verify is fail-closed on TURNSTILE_SECRET.
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "auto" | "light" | "dark";
          size?: "normal" | "flexible" | "compact";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}
