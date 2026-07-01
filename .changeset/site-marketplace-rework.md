---
"@caisson/site": minor
---

Site marketplace rework (ADR-0189–0196): split the overloaded `/pricing` into three rooms
— `/pricing` (editions + bundle), `/modules` (faceted à-la-carte catalog), and `/build`
(compose-a-stack configurator with an honest upgrade nudge). Fold the four editions behind
a WAI-ARIA Disclosure in the nav and fix the "Get started" label→destination. Differentiate
the cart drawer (glance) from the rich `/cart` (review), sharing one line-item + one bundle
-math function, with the drawer rebuilt on a native `<dialog>` for a real focus contract.
Single "Add to cart" buy verb sitewide; Martian Mono as the sole monospace; a sitewide ⌘K
search trigger; module `ItemList` structured data; and flat edition prices (drop the
misleading "from" prefix — the only purchasable price is exactly the number shown).
