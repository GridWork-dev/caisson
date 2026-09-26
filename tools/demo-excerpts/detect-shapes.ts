// Pure reimplementation of `detectSecret` + its 6 SECRET_SHAPES from
// `packages/agent-dev/src/emitter.ts` (CAISSON-110 T3). Kept as an independent copy — this module
// scans MANIFEST entries at test time (not the emitter's runtime write-path), so it does not
// import from `@caisson-sh/agent-dev` product code. No execution, no dynamic import, no I/O: a pure
// string -> label function used only by `scanner.test.ts`.

// Credential SHAPES a demo excerpt must never contain (mirrors emitter.ts SECRET_SHAPES verbatim).
// `.test` is run WITHOUT the global flag so it stays stateless across calls.
const SHAPES: readonly {
  readonly label: string;
  readonly re: RegExp;
}[] = [
  {
    label: "PEM private-key block",
    re: /-----BEGIN [^\n-]*PRIVATE KEY-----[\s\S]*?-----END [^\n-]*PRIVATE KEY-----/,
  },
  {
    label: "URL userinfo password",
    re: /[a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:[^/@\s]+@/i,
  },
  { label: "AWS access-key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    label: "GitHub token",
    re: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/,
  },
  { label: "OpenAI secret key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/ },
  {
    label: "JWT",
    re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  },
];

// A `<key><sep><value>` assignment whose KEY names a sensitive credential (the value itself is
// never inspected or echoed). Mirrors emitter.ts's SECRET_NAME set.
const NAME_PATTERN =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

/** The detector LABEL of the first credential shape found in `text`, or `undefined` if it is clean. */
export function detectSecretShape(text: string): string | undefined {
  for (const shape of SHAPES) {
    if (shape.re.test(text)) return shape.label;
  }
  const assignment = /\b([A-Za-z][A-Za-z0-9_-]*)[ \t]*(?:=[ \t]*|:[ \t]+)\S/g;
  for (let m = assignment.exec(text); m !== null; m = assignment.exec(text)) {
    const key = m[1];
    if (key !== undefined && NAME_PATTERN.test(key)) {
      return "secret-named assignment";
    }
  }
  return undefined;
}
