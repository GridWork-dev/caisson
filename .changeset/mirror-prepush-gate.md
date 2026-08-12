---
"@caisson/ui": patch
"@caisson/ds-manifest": patch
"@caisson/pricebook": patch
"@caisson/registry-schema": patch
---

Strip internal decision-log citations from the public mirror export, and gate the sync on the exported artifact building, testing, linting and formatting clean before a byte reaches the public repo.

The ThemeToggle summary no longer repeats its own component name: every other component's manifest summary has that prefix removed by the generator, and this one kept it only because a parenthetical sat between the name and the em dash the generator matches on. Two comments where a decision id was the grammatical subject of a sentence are reworded so the sentence still stands once the id is gone.
