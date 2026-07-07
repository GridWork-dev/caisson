---
"@caisson/ui-pro": minor
---

Four new components — a dependency-free SVG chart pack (line, bar, area, sparkline), a fuzzy-matched command palette, a redaction-aware JSON and text diff viewer, and a drag-and-drop Kanban board with swimlanes and a keyboard-accessible move fallback. Each splits its pure logic (scale and path math, fuzzy scoring, line and JSON diff, board moves) into a separately exported, unit-tested lib. Also hardens three existing helpers: the previous-period date preset now returns null on a malformed range instead of throwing, CSV export neutralizes leading spreadsheet formula triggers, and column aggregation replaces a min/max argument spread with a loop so large row sets no longer overflow the call limit.
