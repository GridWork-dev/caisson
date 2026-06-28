"use client";

// Global error boundary — of last resort. Must render its own <html><body> since it replaces
// the root layout entirely — so it renders WITHOUT the token stylesheet, and the locked palette
// is mirrored as hex here (the sanctioned exception, same as the satori build images). Keep it
// minimal: no external imports that could themselves error. ADR-0080 register: terse, no exclamation.

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
            color: #eef2f3;
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
            color: #a4b0b6;
            margin-bottom: 1.5rem;
          }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0 0 0.75rem;
            letter-spacing: -0.015em;
            color: #eef2f3;
          }
          p {
            font-size: 0.875rem;
            color: #a4b0b6;
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
            background: #43bcd0;
            color: #0d1216;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
          }
          button:hover { background: #5fc9da; }
          a {
            display: inline-flex;
            align-items: center;
            padding: 0.625rem 1.25rem;
            border-radius: 0.375rem;
            border: 1px solid #2a343a;
            color: #eef2f3;
            font-size: 0.875rem;
            font-weight: 500;
            text-decoration: none;
          }
          a:hover { border-color: #43bcd0; color: #43bcd0; }
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
