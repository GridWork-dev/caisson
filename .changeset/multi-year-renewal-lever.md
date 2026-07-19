---
"@caisson/pricebook": minor
"@caisson/site": patch
---

The updates-renewal book can now carry a multi-year tenor per SKU: a renewal row may extend
the updates window by two or three years in one purchase instead of a flat one-year
extension, with every existing renewal row unchanged and still resolving to its one-year
default. The site's renewal-pricing helpers gained a matching multi-year display
calculation, floored to the same whole-dollar-ending-in-9 price points as the existing
one-year renewal prices. No SKU is sold on a multi-year tenor yet and no new price appears
anywhere in the product — this lands the machinery only.
