---
"@caisson/standards-gate": patch
"@caisson/brand": patch
"@caisson/ui-pro": patch
"@caisson/demo-registry": patch
---

TypeScript bridge to 6.0.3 (Kickoff T task 5, re-derived version map): the workspace catalog moves
from ^5.7.3 to ^6.0.3 (the stable JS-compiler transition release; 7.x is the native compiler whose
stable API waits for 7.1). standards-gate pins its own typescript to ^6.0.3 explicitly so a future
catalog move to 7.x cannot strand its ts.createScanner usage. brand, ui-pro, and demo-registry gain
a css.d.ts ambient declaration for the side-effect CSS imports TS 6.0 now checks (TS2882).
