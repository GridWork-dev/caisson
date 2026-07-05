---
"@caisson/ui": patch
"@caisson/site": patch
---

Follow-up visual pass after a partial re-audit: the module comparison table now shows the same
right-edge scroll fade as code samples when a column runs off narrow screens, and its 4th edition
column is reachable on mobile. Terminal cards no longer clip their status badge when the label is
long. Placeholder text is readable in light mode on every form across the site (sign-in,
password-reset, newsletter), not just the ones fixed last time. The docs code samples now match the
same scroll-fade treatment as the rest of the site. Several hero code/terminal panels (home,
compliance, agentic-dev, local-first, the EU AI Act page) had their sample text re-wrapped so it no
longer clips at the card edge. The EULA now keeps a readable line length on desktop, the footer no
longer overflows the viewport on mobile, and a few small copy/layout bugs (a missing hyphen, an
orphaned card in a 4-item grid, a monospace numeral style bleeding onto the word "from") are fixed.
