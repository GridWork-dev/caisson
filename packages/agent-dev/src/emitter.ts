// src/emitter.ts — the thin, ENGINE-NEUTRAL multi-harness emitter (ADR-0066 · T19 SECURITY). Renders
// ONE typed Caisson schema (agent-kernel `Artifact`s + lifecycle hook bindings) into per-harness
// config bundles: `.claude/` for Claude Code (agents/skills/rules + a hooks manifest), a single
// aggregated `AGENTS.md` for Codex, and per-artifact `.cursor/rules/*.mdc` for Cursor. The binding
// contract VERIFY re-asks (ADR-0066): Claude Code is ONE emit target among several — no harness is the
// substrate; the same schema fans out to every harness shape. The emitter NEVER runs an LLM, imports a
// vendor SDK, or reads a credential — it is a pure render plus a guarded write.
//
// Two responsibilities, deliberately split:
//   `renderHarnessBundles` — a PURE, deterministic transform (no clock/randomness/env/fs). Its
//     byte-stable output is pinned by the `__golden__/emit/` tree (ADR-0013) and reproduced exactly.
//   `writeBundle`          — the GUARDED egress to disk. Two threats this gate closes (PLAN T19):
//     (1) path traversal escaping the emit target dir — every bundle-relative path is rejected if it
//         is absolute, carries a null byte, or contains a `..` segment, and the `path.resolve`d
//         destination MUST sit under the resolved target root (`startsWith(root + sep)`); and
//     (2) a credential leaking into an emitted bundle — every file's content is scanned and the whole
//         emit is REFUSED (fail-closed, nothing written) if a secret shape is found. The refusal
//         message carries only the file path + the detector LABEL, never the matched secret span.
//
// The secret scan is intentionally a self-contained refusal guard, NOT a cross-import of
// `@caisson/local-store`'s `scrubForEgress`: that primitive REDACTS before a cloud embed, whereas the
// emitter must FAIL LOUDLY so the buyer fixes the authored source rather than ship a silently-mangled
// config — and an emitter has no business depending on the sqlite memory store for one predicate. The
// detected shapes mirror that guard's contract (rebuild-clean; industry-standard credential shapes).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type {
  AgentArtifact,
  Artifact,
  RuleArtifact,
  SkillArtifact,
} from "@caisson/agent-kernel";

/** A lifecycle hook binding: a `${phase}:${act}` point handled by a named artifact in the bundle. */
export interface EmitHookBinding {
  readonly on: string;
  readonly use: string;
}

/** The ONE typed schema the multi-harness emitter renders (the engine-neutral source of truth). */
export interface EmitInput {
  readonly artifacts: readonly Artifact[];
  readonly hooks: readonly EmitHookBinding[];
}

/** One emitted file: a bundle-relative POSIX path and its byte-stable text content. */
export interface EmittedFile {
  readonly path: string;
  readonly content: string;
}

/** The full multi-harness bundle: every emitted file (matched against the committed golden tree). */
export interface EmittedBundle {
  readonly files: readonly EmittedFile[];
}

/** A write-path security failure — a path escape or a credential leak refused before any disk write. */
export class EmitSecurityError extends Error {
  readonly code: "path-escape" | "secret-leak" | "duplicate-path";
  constructor(code: EmitSecurityError["code"], message: string) {
    super(message);
    this.name = "EmitSecurityError";
    this.code = code;
  }
}

// ── Pure render helpers (each datum rendered once per harness; shared inputs guarantee the bytes agree
// across harnesses and the output round-trips the agent-kernel schema). ─────────────────────────────

/**
 * Render a free-text value as a YAML scalar that CANNOT break out of its mapping value. A value that
 * is already a safe plain scalar renders verbatim (keeps the golden bytes byte-stable); anything that
 * could alter frontmatter structure — a newline, a `---`/`tools:` injection, a `": "`, a leading
 * indicator, or a control char — renders as a double-quoted scalar with backslash/quote/control
 * escaping. This is what makes the emitted `tools:` allowlist UN-SUPPRESSIBLE by authored field
 * content (round-3 SECURITY): no description or list item can truncate the frontmatter and erase it.
 * `name`/`trigger`/`severity` are schema-bounded (slug / enum) so they always render plain; free text
 * is not, so the emitter must never trust it into a bare interpolation.
 */
function yamlScalar(value: string): string {
  const hasControlChar = [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
  const safePlain =
    value.length > 0 &&
    value === value.trim() &&
    !hasControlChar &&
    !/^[-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !value.includes(": ") &&
    !value.endsWith(":") &&
    !value.includes(" #");
  if (safePlain) return value;
  let escaped = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === "\\") escaped += "\\\\";
    else if (ch === '"') escaped += '\\"';
    else if (ch === "\n") escaped += "\\n";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "\t") escaped += "\\t";
    else if (code < 0x20 || code === 0x7f)
      escaped += `\\x${code.toString(16).padStart(2, "0")}`;
    else escaped += ch;
  }
  return `"${escaped}"`;
}

/** YAML block-sequence: each item on its own `  - <item>` line (no trailing newline). */
function yamlList(items: readonly string[]): string {
  return items.map((item) => `  - ${yamlScalar(item)}`).join("\n");
}

/** Ordered list `1. … 2. … 3. …` (no trailing newline). */
function numberedSteps(steps: readonly string[]): string {
  return steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
}

// ── Claude Code: one file per artifact under `.claude/{agents,skills,rules}/` + a hooks manifest. ───

function claudeAgent(a: AgentArtifact): string {
  return `---
name: ${a.name}
description: ${yamlScalar(a.description)}
capabilities:
${yamlList(a.capabilities)}
tools:
${yamlList(a.tools)}
---

${a.description}

When to invoke: ${a.whenToInvoke}
`;
}

function claudeSkill(s: SkillArtifact): string {
  return `---
name: ${s.name}
description: ${yamlScalar(s.description)}
trigger: ${s.trigger}
---

${s.description}

Steps:
${numberedSteps(s.steps)}
`;
}

function claudeRule(r: RuleArtifact): string {
  return `---
name: ${r.name}
description: ${yamlScalar(r.description)}
severity: ${r.severity}
---

${r.description}
`;
}

function claudeHooks(hooks: readonly EmitHookBinding[]): string {
  const manifest = {
    version: 1,
    hooks: hooks.map((h) => ({ on: h.on, use: h.use })),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// ── Codex: ONE aggregated `AGENTS.md` (Codex's single-file convention). Sections render only when
// non-empty, always in agent → skill → rule order; the leading `\n` on each section/block produces
// the blank-line separators deterministically. ─────────────────────────────────────────────────────

function codexAgents(
  agents: readonly AgentArtifact[],
  skills: readonly SkillArtifact[],
  rules: readonly RuleArtifact[],
): string {
  let out =
    "# AGENTS\n\nGenerated by @caisson/agent-dev from one typed Caisson schema (Codex harness).\n";
  if (agents.length > 0) {
    out += "\n## Agents\n";
    for (const a of agents) {
      out += `\n### ${a.name}\n\n${a.description}\n\n- Capabilities: ${a.capabilities.join(", ")}\n- Tools: ${a.tools.join(", ")}\n- When to invoke: ${a.whenToInvoke}\n`;
    }
  }
  if (skills.length > 0) {
    out += "\n## Skills\n";
    for (const s of skills) {
      out += `\n### ${s.name}\n\n${s.description}\n\n${numberedSteps(s.steps)}\n`;
    }
  }
  if (rules.length > 0) {
    out += "\n## Rules\n";
    for (const r of rules) {
      out += `\n### ${r.name} (${r.severity})\n\n${r.description}\n`;
    }
  }
  return out;
}

// ── Cursor: one MDC project rule per artifact under `.cursor/rules/`. Rules always apply; agent/skill
// guidance is opt-in (`alwaysApply: false`). ───────────────────────────────────────────────────────

function cursorAgent(a: AgentArtifact): string {
  return `---
description: ${yamlScalar(a.description)}
alwaysApply: false
---

# ${a.name} (agent)

${a.description}

- Capabilities: ${a.capabilities.join(", ")}
- Tools: ${a.tools.join(", ")}
- When to invoke: ${a.whenToInvoke}
`;
}

function cursorSkill(s: SkillArtifact): string {
  return `---
description: ${yamlScalar(s.description)}
alwaysApply: false
---

# ${s.name} (skill)

${s.description}

${numberedSteps(s.steps)}
`;
}

function cursorRule(r: RuleArtifact): string {
  return `---
description: ${yamlScalar(r.description)}
alwaysApply: true
---

# ${r.name} (rule, ${r.severity})

${r.description}
`;
}

/**
 * Render one typed schema into the full multi-harness bundle. PURE + deterministic (no fs/clock/env):
 * the same three artifacts fan out to `.claude/`, Codex `AGENTS.md`, and `.cursor/` — proving no
 * single harness is the substrate (ADR-0066). The committed `__golden__/emit/` tree freezes the bytes.
 */
export function renderHarnessBundles(input: EmitInput): EmittedBundle {
  const agents = input.artifacts.filter(
    (a): a is AgentArtifact => a.kind === "agent",
  );
  const skills = input.artifacts.filter(
    (a): a is SkillArtifact => a.kind === "skill",
  );
  const rules = input.artifacts.filter(
    (a): a is RuleArtifact => a.kind === "rule",
  );

  const files: EmittedFile[] = [];

  // Claude Code — one file per artifact (input order), then the hooks manifest.
  for (const a of input.artifacts) {
    switch (a.kind) {
      case "agent":
        files.push({
          path: `.claude/agents/${a.name}.md`,
          content: claudeAgent(a),
        });
        break;
      case "skill":
        files.push({
          path: `.claude/skills/${a.name}.md`,
          content: claudeSkill(a),
        });
        break;
      case "rule":
        files.push({
          path: `.claude/rules/${a.name}.md`,
          content: claudeRule(a),
        });
        break;
      default: {
        const _exhaustive: never = a;
        throw new Error(`unknown artifact kind: ${String(_exhaustive)}`);
      }
    }
  }
  files.push({ path: ".claude/hooks.json", content: claudeHooks(input.hooks) });

  // Codex — one aggregated AGENTS.md.
  files.push({
    path: "AGENTS.md",
    content: codexAgents(agents, skills, rules),
  });

  // Cursor — one .mdc per artifact (input order).
  for (const a of input.artifacts) {
    let content: string;
    switch (a.kind) {
      case "agent":
        content = cursorAgent(a);
        break;
      case "skill":
        content = cursorSkill(a);
        break;
      case "rule":
        content = cursorRule(a);
        break;
      default: {
        const _exhaustive: never = a;
        throw new Error(`unknown artifact kind: ${String(_exhaustive)}`);
      }
    }
    files.push({ path: `.cursor/rules/${a.name}.mdc`, content });
  }

  return { files };
}

// ── Write-path security guards ─────────────────────────────────────────────────────────────────────

// Credential SHAPES the emit refuses to write (rebuild-clean; mirrors the local-store egress-guard
// contract). `.test` is run WITHOUT the global flag so it stays stateless across calls.
const SECRET_SHAPES: readonly {
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

// A `<key><sep><value>` assignment whose KEY names a secret (the value itself is never inspected or
// echoed). Mirrors the egress-guard's secret-name set.
const SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

/** The detector LABEL of the first secret shape found in `text`, or `undefined` if it is clean. */
function detectSecret(text: string): string | undefined {
  for (const shape of SECRET_SHAPES) {
    if (shape.re.test(text)) return shape.label;
  }
  const assignment = /\b([A-Za-z][A-Za-z0-9_-]*)[ \t]*(?:=[ \t]*|:[ \t]+)\S/g;
  for (let m = assignment.exec(text); m !== null; m = assignment.exec(text)) {
    const key = m[1];
    if (key !== undefined && SECRET_NAME.test(key)) {
      return "secret-named assignment";
    }
  }
  return undefined;
}

/** Reject an unsafe bundle-relative emit path before it is resolved against the target root. */
function assertSafeRelativePath(relPath: string): void {
  if (relPath.length === 0) {
    throw new EmitSecurityError("path-escape", "empty emit path");
  }
  if (relPath.includes("\0")) {
    throw new EmitSecurityError(
      "path-escape",
      `emit path contains a null byte: ${JSON.stringify(relPath)}`,
    );
  }
  if (isAbsolute(relPath)) {
    throw new EmitSecurityError(
      "path-escape",
      `emit path must be relative, not absolute: ${relPath}`,
    );
  }
  for (const segment of relPath.split(/[\\/]+/)) {
    if (segment === "..") {
      throw new EmitSecurityError(
        "path-escape",
        `emit path may not contain a ".." segment: ${relPath}`,
      );
    }
  }
}

/**
 * Write a rendered bundle under `targetRoot`, FAIL-CLOSED: every file is validated (path safety +
 * secret scan + no duplicate destination) BEFORE any write, so a single offending file aborts the
 * whole emit with nothing written. Returns the absolute paths written, in bundle order.
 */
export function writeBundle(
  targetRoot: string,
  bundle: EmittedBundle,
): readonly string[] {
  const root = resolve(targetRoot);
  const planned: { readonly dest: string; readonly content: string }[] = [];
  const seen = new Set<string>();

  // Pass 1 — validate everything; never touch the filesystem if any check fails.
  for (const file of bundle.files) {
    assertSafeRelativePath(file.path);
    const dest = resolve(root, file.path);
    if (dest !== root && !dest.startsWith(root + sep)) {
      throw new EmitSecurityError(
        "path-escape",
        `emit path escapes the target root: ${file.path}`,
      );
    }
    if (seen.has(dest)) {
      throw new EmitSecurityError(
        "duplicate-path",
        `two artifacts map to the same emit path: ${file.path}`,
      );
    }
    seen.add(dest);
    const label = detectSecret(file.content);
    if (label !== undefined) {
      // Path + detector label only — the matched secret span is NEVER echoed.
      throw new EmitSecurityError(
        "secret-leak",
        `refusing to emit ${file.path}: content matches a ${label}`,
      );
    }
    planned.push({ dest, content: file.content });
  }

  // Pass 2 — all files validated; write the tree.
  const written: string[] = [];
  for (const { dest, content } of planned) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    written.push(dest);
  }
  return written;
}
