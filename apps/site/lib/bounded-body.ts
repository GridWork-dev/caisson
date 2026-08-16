// Bounded request-body read (CWE-770). `await req.text()` buffers the ENTIRE stream before any
// length check can run, and the `content-length` pre-check is skippable (absent header / chunked
// transfer / a non-numeric value makes `Number(...)` NaN, which fails `Number.isFinite` and falls
// through) — so on a public pre-auth route an attacker could force an unbounded allocation before
// Turnstile or any rate limit runs. This reader pulls the stream chunk-by-chunk and aborts the
// moment the byte count crosses the cap, so the worst-case allocation is `maxBytes` + one chunk.
// Shared by the demo-run and ask-ai handlers (the ask-ai/registry precheck idiom this replaces).

export type BoundedBody =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false };

/** Read at most `maxBytes` of the request body as UTF-8. `{ok:false}` = over the cap (413 it). */
export async function readBodyBounded(
  req: Request,
  maxBytes: number,
): Promise<BoundedBody> {
  // Fast-path reject for an honestly-declared oversize body — no bytes read at all. A missing,
  // chunked, or garbage content-length gets no trust either way: the streaming count below is the
  // real guard.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };

  if (req.body === null) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}
