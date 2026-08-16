// CANARY FIXTURE (ADR-0408 constraint 1) — exercised only by tooling/scripts/lint-canary.ts.
//
// This file MUST produce a `caisson-slop/no-slop` finding on every run. `jsPlugins` is alpha and
// fails SILENTLY: a plugin that stops loading reports nothing, and a lint gate that reports
// nothing looks exactly like a clean tree. Zero findings here therefore FAILS the canary.
//
// It deliberately trips all three arms of the rule at once (inline style, raw colour literal,
// AI-slop copy) so a partial visitor regression is caught too, not only a total load failure.
// Never imported by product code; ignored by the repo-wide lint via the `__fixtures__` pattern.
export function SlopCanary() {
  const shade = "#ff0000";
  return (
    <div style={{ color: shade }} title="oklch(0.5 0.1 20)">
      This seamlessly supercharges your world-class workflow.
    </div>
  );
}
