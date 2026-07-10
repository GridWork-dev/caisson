---
"@caisson/email": minor
---

Add an `abandoned-checkout` email template: a flat "your cart is still here" nudge with the
line items and one CTA back to the cart, matching `purchase-confirmation`'s restrained tone (no
urgency copy, no countdown). Optionally renders one plain discount sentence when both
`discountLabel` and `discountUrl` are supplied (env-gated on the sender side); a half-set
discount pair fails the coercer closed.
