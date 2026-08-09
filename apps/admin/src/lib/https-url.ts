/** Normalize an operator-provided HTTPS base URL, or fail closed without opening a socket. */
export function normalizeHttpsUrl(input: string | undefined): string | null {
  const value = input?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}
