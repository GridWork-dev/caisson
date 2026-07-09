---
"@caisson/ui": patch
---

Mobile grid collapse uses `minmax(0, 1fr)` instead of bare `1fr`, and `.cs-card` gains
`overflow-wrap: break-word`. A bare `1fr` track floors at min-content, so one long
unbreakable token in a card body (e.g. a slash-joined identifier list) widened the whole
page past a 390px viewport by 144px; the track now shrinks and the token wraps inside
the card.
