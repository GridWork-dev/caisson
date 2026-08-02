---
"@caisson/site": patch
---

The HTML parser behind the weekly regulatory-claim watch moves to its current major line. Because
the new parser classifies iframe, xmp, plaintext, noembed, and noframes as raw text, the extractor
neutralizes only those tag names before parsing and retains the previous open, text, and close event
behavior for their bodies and following content. Exact fixtures cover those five elements, a
self-closed iframe, entity decoding, hidden content, and implied closes. HTML with no visible anchor
remains locator drift instead of becoming a generic manual-review result. The watch reads the same
sources and stays advisory-only.
