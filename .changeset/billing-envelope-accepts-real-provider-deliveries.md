---
"@caisson/billing": patch
---

Webhook envelope validation now accepts real provider deliveries. The Paddle and Stripe
envelope schemas rejected any notification carrying fields beyond the minimal set the
mapper reads (a real Paddle delivery always includes `occurred_at` and `notification_id`;
a real Stripe event includes `api_version`, `created`, and more), which surfaced as a 400
on every live webhook. Envelopes are now validated on the fields the mapper consumes and
tolerate documented provider-additive fields; signature verification is unchanged.
