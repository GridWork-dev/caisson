// Loading UI — server component. Renders while a page segment is streaming.
// Minimal: a quiet mono "Loading…" centred in a section-height container.
// No animation class — respects prefers-reduced-motion by having nothing to reduce.

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60dvh",
        padding: "var(--cs-space-24) var(--cs-space-6)",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: "var(--cs-text-sm)",
          color: "var(--cs-fg-muted)",
          letterSpacing: "var(--cs-tracking-wide)",
        }}
      >
        Loading…
      </span>
    </div>
  );
}
