---
"@caisson/site": patch
"@caisson/ui": patch
---

Fixed five small display bugs found in a visual audit of the marketing site:

- The Agent runner module card showed a broken glyph instead of its icon on the modules page.
- The Alerting module's pricing description had an awkward, hard-to-read sentence.
- On mobile, three-digit module prices in the stack builder's example (like $199) were cut off to
  two digits (like $19) — a real trust problem on a pricing surface.
- The glossary's "AI & agent infrastructure" heading rendered with the word gap almost invisible
  on wide screens.
- The docs sidebar's "Base substrate" section repeated its own name as its only link's label
  instead of a distinct label.
