---
"@caisson/email": minor
---

Add a `subscription-payment-received` email template (CAISSON-27): a dedicated recurring-payment
receipt for subscription-cycle charges, distinct from the first-purchase `purchase-confirmation`.
Shares the purchase-confirmation prop shape; only the copy differs.
