# ADR-0046 — Ciphertext envelope: self-describing binary, base64 into text

Status: accepted · 2026-06-27 (Wave-0 shared-substrate session, Fork 2. The on-disk serialization
of an encrypted field under ADR-0045/0043/0006.)

An encrypted field is one logical value that must carry enough metadata to decrypt and rotate
without out-of-band column bookkeeping.

## Decision

A **self-describing binary envelope**, base64-encoded into a `text` column:

```
[ format-version 1B (0x01) | alg-id 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B ]
```

- **Self-describing** — the decrypt path reads `format-version`, `alg-id`, and `key_version` _from
  the value itself_, enabling **key rotation AND cipher migration** with no separate column
  metadata. `format-version`/`alg-id` gate the decrypt path (an unknown version/alg throws, never
  guesses — ADR-0006 "flag, never guess").
- Mirrors the **AWS Encryption SDK** message format (version byte first → algorithm id → IV → body
  → tag) and **Tink**'s `prefix(version||key-hint) || IV || ciphertext || tag`.
- Stored base64 into a `text` column (one column, fits the Drizzle `customType`). `bytea` is an
  equivalent raw alternative; `text`+base64 is the default for portability across the three drivers
  (ADR-0014).
- **JSON is the golden-fixture representation only** — the fixture (`__golden__/envelope.json`)
  pins the parsed structure (version/alg/key_version/lengths) for regression, NOT the on-disk bytes.

## Rejected

- **JSON envelope on disk** (`{v,alg,kv,nonce,ct,tag}`) — debuggable but ~2-3× storage + parse cost
  per field and invites drift. Demoted to the golden-fixture shape only.
- **Two columns** (`bytea` ciphertext + `int` key_version sidecar) — splits one logical value across
  two columns and fights the one-column Drizzle `customType`. Reject.

## Binding

The on-disk format is the binary envelope above, base64 into `text`; serialize/parse round-trip
exactly; the decrypt path reads format-version + alg-id + key_version from the envelope and throws
on an unknown value; the golden fixture pins the parsed structure with `BLESS` unset. Evidence: AWS
ESDK message-format reference; Tink wire-format doc.
