"use client";

// Global error boundary — of last resort. Must render its own <html><body> since it replaces
// the root layout entirely. Keep it minimal: no external imports that could themselves error.
// ADR-0080 register: terse, technical, no exclamation.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fatal error · Caisson</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body {
            margin: 0;
            background: #0d1216;
            color: #e2e8f0;
            font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100dvh;
            padding: 2rem;
          }
          .wrap { max-width: 480px; width: 100%; }
          .mark {
            font-size: 0.75rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 1.5rem;
          }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0 0 0.75rem;
            letter-spacing: -0.015em;
            color: #e2e8f0;
          }
          p {
            font-size: 0.875rem;
            color: #94a3b8;
            line-height: 1.6;
            margin: 0 0 2rem;
          }
          .row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
          button {
            display: inline-flex;
            align-items: center;
            padding: 0.625rem 1.25rem;
            border-radius: 0.375rem;
            border: none;
            background: #3b82f6;
            color: #fff;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
          }
          button:hover { background: #2563eb; }
          a {
            display: inline-flex;
            align-items: center;
            padding: 0.625rem 1.25rem;
            border-radius: 0.375rem;
            border: 1px solid #334155;
            color: #e2e8f0;
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
          }
          a:hover { border-color: #3b82f6; color: #3b82f6; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <p className="mark">caisson — fatal error</p>
          <h1>Application failed to load.</h1>
          <p>
            A critical error prevented the page from rendering. Retry to reload,
            or return to the home page.
          </p>
          <div className="row">
            <button type="button" onClick={reset}>
              Retry
            </button>
            <a href="/">Home</a>
          </div>
        </div>
      </body>
    </html>
  );
}
