---
"@caisson/site": patch
---

The HTML parser behind the weekly regulatory-claim watch moves to its current major line, so the
watch stays on a maintained parser. The visible-text extraction was checked against the previous
parser across raw-text elements, comments, entities, hidden and implicitly closed tags, and
malformed markup, and produces identical text in every case. The watch reads the same sources,
reports the same findings, and stays advisory-only.
