// Private, byte-exact primitive readers shared by the provider event parsers (Stripe, Paddle,
// LemonSqueezy, Polar). ONLY these three exact-value helpers are shared — money, account,
// line-item, event-ID, and provider payload logic stay provider-local on purpose: Paddle's
// decimal-string handling and LemonSqueezy's numeric rounding are intentionally different.

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Provider ids arrive as string or number (LemonSqueezy/Polar); normalize to string, "" on miss. */
export function readIdString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function readInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}
