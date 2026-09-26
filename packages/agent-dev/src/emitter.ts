// src/emitter.ts — the thin, ENGINE-NEUTRAL multi-harness emitter (ADR-0066, extended ADR-0264).
// Renders ONE typed Caisson schema (agent-kernel `Artifact`s + lifecycle hook bindings) into
// per-harness config bundles: `.claude/` for Claude Code (agents + `skills/<name>/SKILL.md` directory
// skills + rules + a hooks manifest), the universal `.agents/skills/<name>/SKILL.md` cross-tool skills
// surface (agentskills.io standard; byte-identical SKILL.md to the Claude copy),
// a single aggregated `AGENTS.md` — the universal multi-tool BASE layer Codex, Cursor, Devin, Zed,
// Gemini CLI, and the Copilot coding agent all read natively (ADR-0264) — per-artifact `.cursor/
// rules/*.mdc` for Cursor, Devin Desktop (`.devin/rules/`, mirrored to the `.windsurf/rules/` legacy
// path), GitHub Copilot (`.github/copilot-instructions.md` + per-artifact `.github/instructions/`),
// and Cline (`.clinerules/`). The binding contract VERIFY re-asks (ADR-0066): Claude Code is ONE emit
// target among several — no harness is the substrate; the same schema fans out to every harness
// shape. The emitter NEVER runs an LLM, imports a vendor SDK, or reads a credential — it is a pure
// render plus a guarded write.
//
// ADR-0264 extends the source IR with an optional `activation`/`paths` pair on `RuleArtifact` and
// `SkillArtifact` (absent ⇒ `always`, today's behavior). A target that cannot represent the source's
// activation intent (a path scope, a manual-only trigger) NEVER silently degrades: it pushes a
// specific `EmittedBundle.warnings[]` entry instead. Rendering the WARNINGS is done in
// `renderHarnessBundles` (the orchestrator) so each per-target render helper below stays a small pure
// function of its inputs.
//
// Two responsibilities, deliberately split:
//   `renderHarnessBundles` — a PURE, deterministic transform (no clock/randomness/env/fs). Its
//     byte-stable output is pinned by the `__golden__/emit/` tree (ADR-0013) and reproduced exactly.
//   `writeBundle`          — the GUARDED egress to disk. Two threats this gate closes:
//     (1) path traversal escaping the emit target dir — every bundle-relative path is rejected if it
//         is absolute, carries a null byte, or contains a `..` segment, and the `path.resolve`d
//         destination MUST sit under the resolved target root (`startsWith(root + sep)`); and
//     (2) a credential leaking into an emitted bundle — every file's content is scanned and the whole
//         emit is REFUSED (fail-closed, nothing written) if a secret shape is found. The refusal
//         message carries only the file path + the detector LABEL, never the matched secret span.
//
// The secret scan is intentionally a self-contained refusal guard, NOT a cross-import of
// `@caisson-sh/local-store`'s `scrubForEgress`: that primitive REDACTS before a cloud embed, whereas the
// emitter must FAIL LOUDLY so the buyer fixes the authored source rather than ship a silently-mangled
// config — and an emitter has no business depending on the sqlite memory store for one predicate. The
// detected shapes mirror that guard's contract (industry-standard credential shapes).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type {
  AgentArtifact,
  Artifact,
  RuleArtifact,
  SkillArtifact,
} from "@caisson-sh/agent-kernel";

/** A lifecycle hook binding: a `${phase}:${act}` point handled by a named artifact in the bundle. */
export interface EmitHookBinding {
  readonly on: string;
  readonly use: string;
}

/** The ONE typed schema the multi-harness emitter renders (the engine-neutral source of truth). */
export interface EmitInput {
  readonly artifacts: readonly Artifact[];
  readonly hooks: readonly EmitHookBinding[];
  /**
   * Trust gate for a skill's `scripts` (executable content). Omitted / `false` ⇒ scripts are WITHHELD
   * (one fidelity warning per script-carrying skill, never a silent drop); `true` ⇒ they emit under
   * `<skill-dir>/scripts/`. `references`/`assets` are inert bundled content and always emit regardless.
   * The edition composer sets this from artifact ORIGIN (`index.ts`): the curated Caisson default set is
   * trusted (always `true`); a caller-supplied override is untrusted (honors the caller's opt-in).
   */
  readonly allowScripts?: boolean;
}

/** One emitted file: a bundle-relative POSIX path and its byte-stable text content. */
export interface EmittedFile {
  readonly path: string;
  readonly content: string;
}

/** The full multi-harness bundle: every emitted file (matched against the committed golden tree), plus
 * every fidelity warning a target raised when it could not represent the source's activation intent
 * (ADR-0264) — never a silent degrade. Empty when every target fully represents every artifact. */
export interface EmittedBundle {
  readonly files: readonly EmittedFile[];
  readonly warnings: readonly string[];
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

/** Shared prose body for a "rule-like" per-artifact file — every target that renders one file per
 * artifact (Cursor, Devin/Windsurf, GitHub Copilot per-instruction, Cline) shares this exact wording,
 * authored once so the cross-target bytes agree. */
function artifactBody(a: Artifact): string {
  switch (a.kind) {
    case "agent":
      return `# ${a.name} (agent)\n\n${a.description}\n\n- Capabilities: ${a.capabilities.join(", ")}\n- Tools: ${a.tools.join(", ")}\n- When to invoke: ${a.whenToInvoke}\n`;
    case "skill":
      return `# ${a.name} (skill)\n\n${a.description}\n\n${numberedSteps(a.steps)}\n`;
    case "rule":
      return `# ${a.name} (rule, ${a.severity})\n\n${a.description}\n`;
    default: {
      const _exhaustive: never = a;
      throw new Error(`unknown artifact kind: ${String(_exhaustive)}`);
    }
  }
}

/**
 * A rule/skill's effective activation for the NEW ADR-0264 targets (Devin/Windsurf, GitHub Copilot,
 * Cline) — these have no legacy default to preserve, so an absent `activation` resolves to `always`
 * (unconditionally included, matching the pre-existing Codex `AGENTS.md`/Claude-rule behavior).
 * Agents are deliberately NOT rendered into these targets (see `renderHarnessBundles`): they carry no
 * activation field, and none of these tools has a sub-agent concept — only rule/skill activation is
 * representable here.
 */
function resolveActivation(a: RuleArtifact | SkillArtifact): {
  readonly mode: "always" | "paths" | "manual";
  readonly paths: readonly string[];
} {
  const mode = a.activation ?? "always";
  return { mode, paths: mode === "paths" ? (a.paths ?? []) : [] };
}

/**
 * The bundled files a skill ships into ONE SKILL.md directory root (`.claude/skills/<name>` or the
 * universal `.agents/skills/<name>`): `references` + `assets` unconditionally, `scripts` only when
 * `allowScripts`. Each lands under its category subdir (`<root>/references|assets|scripts/<file.path>`);
 * every emitted file rides the existing `writeBundle` gate (path-escape + secret scan) unchanged.
 */
function skillBundle(
  s: SkillArtifact,
  dirRoot: string,
  allowScripts: boolean,
): EmittedFile[] {
  const out: EmittedFile[] = [];
  for (const f of s.references ?? []) {
    out.push({ path: `${dirRoot}/references/${f.path}`, content: f.content });
  }
  for (const f of s.assets ?? []) {
    out.push({ path: `${dirRoot}/assets/${f.path}`, content: f.content });
  }
  if (allowScripts) {
    for (const f of s.scripts ?? []) {
      out.push({ path: `${dirRoot}/scripts/${f.path}`, content: f.content });
    }
  }
  return out;
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

/**
 * Render a skill as an agentskills.io SKILL.md (frontmatter + body). Emitted BYTE-IDENTICALLY at both
 * `.claude/skills/<name>/SKILL.md` and the universal `.agents/skills/<name>/SKILL.md` —
 * the twin-path precedent Devin/Windsurf already set. The optional spec fields (license,
 * compatibility, allowed-tools, metadata) render only when present, right after `description`; the
 * `allowed-tools` bare-token array joins to the spec's space-separated string, and every value goes
 * through `yamlScalar` so no authored content can break out of the frontmatter. Frontmatter is
 * spec-pure (operator lock 2026-07-17): `trigger` is NOT emitted — agentskills.io has no such field;
 * trigger intent still reaches consumers via the AGENTS.md aggregate and the artifact itself.
 */
function skillMarkdown(s: SkillArtifact): string {
  let optional = "";
  if (s.license !== undefined) {
    optional += `license: ${yamlScalar(s.license)}\n`;
  }
  if (s.compatibility !== undefined) {
    optional += `compatibility: ${yamlScalar(s.compatibility)}\n`;
  }
  if (s.allowedTools !== undefined) {
    optional += `allowed-tools: ${yamlScalar(s.allowedTools.join(" "))}\n`;
  }
  if (s.metadata !== undefined) {
    optional += "metadata:\n";
    for (const [key, value] of Object.entries(s.metadata)) {
      optional += `  ${yamlScalar(key)}: ${yamlScalar(value)}\n`;
    }
  }
  return `---
name: ${s.name}
description: ${yamlScalar(s.description)}
${optional}---

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

/** Shared "one aggregated file" section renderer — agent → skill → rule, each section only when
 * non-empty — reused by both `codexAgents` (AGENTS.md) and `copilotInstructionsFile` (the GitHub
 * Copilot repo-wide file) so the two aggregate targets agree on structure byte-for-byte. */
function aggregatedSections(
  agents: readonly AgentArtifact[],
  skills: readonly SkillArtifact[],
  rules: readonly RuleArtifact[],
): string {
  let out = "";
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

// ── AGENTS.md: ONE aggregated file — the universal multi-tool BASE layer (ADR-0264 supersedes the
// prior "Codex harness" framing; Codex, Cursor, Devin, Zed, Gemini CLI, and the Copilot coding agent
// all read AGENTS.md natively). `codexAgents` stays the private render-function name (API-safe) and
// its emitted content/path are UNCHANGED by ADR-0264 — only this doc comment + the manifest/index.ts
// description are reframed.
function codexAgents(
  agents: readonly AgentArtifact[],
  skills: readonly SkillArtifact[],
  rules: readonly RuleArtifact[],
): string {
  return (
    "# AGENTS\n\nGenerated by @caisson-sh/agent-dev from one typed Caisson schema (Codex harness).\n" +
    aggregatedSections(agents, skills, rules)
  );
}

// ── Cursor: one MDC project rule per artifact under `.cursor/rules/`, deriving `alwaysApply`/`globs`
// from the rule/skill `activation`/`paths` fields (ADR-0264 — fixes the shipped degrade where
// cursorRule hardcoded `alwaysApply: true`). All three activation states are representable in
// Cursor's own convention (Always/Auto-Attached/Manual), so this target never warns. An artifact
// that omits `activation` entirely keeps its PRE-EXISTING default so already-authored content is
// byte-unaffected: a rule defaulted to always-applied (the bug this ADR fixes, coincidentally the
// correct rule default), a skill/agent defaulted to opt-in (`alwaysApply: false`, no globs). ────────

function cursorActivation(
  legacyDefaultAlwaysApply: boolean,
  activation: "always" | "paths" | "manual" | undefined,
  paths: readonly string[] | undefined,
): { readonly alwaysApply: boolean; readonly globs?: readonly string[] } {
  if (activation === "paths") return { alwaysApply: false, globs: paths ?? [] };
  if (activation === "manual") return { alwaysApply: false };
  if (activation === "always") return { alwaysApply: true };
  return { alwaysApply: legacyDefaultAlwaysApply };
}

function cursorFrontmatter(
  description: string,
  act: { readonly alwaysApply: boolean; readonly globs?: readonly string[] },
): string {
  const globsLine =
    act.globs !== undefined ? `\nglobs:\n${yamlList(act.globs)}` : "";
  return `description: ${yamlScalar(description)}\nalwaysApply: ${act.alwaysApply}${globsLine}`;
}

function cursorAgent(a: AgentArtifact): string {
  // No activation field on AgentArtifact — preserves the pre-existing opt-in default verbatim.
  return `---
${cursorFrontmatter(a.description, { alwaysApply: false })}
---

${artifactBody(a)}`;
}

function cursorSkill(s: SkillArtifact): string {
  const act = cursorActivation(false, s.activation, s.paths);
  return `---
${cursorFrontmatter(s.description, act)}
---

${artifactBody(s)}`;
}

function cursorRule(r: RuleArtifact): string {
  const act = cursorActivation(true, r.activation, r.paths);
  return `---
${cursorFrontmatter(r.description, act)}
---

${artifactBody(r)}`;
}

// ── Devin Desktop (+ legacy Windsurf fallback, ADR-0264): one rule file per rule/skill, mirrored
// byte-identically under both `.devin/rules/` and `.windsurf/rules/` (Cognition's 2026-06-02
// rebrand — the legacy path is kept so either installed base picks it up). All three activation
// states map onto Devin/Windsurf's native `trigger` enum, so this target never warns. ───────────────

function devinContent(a: RuleArtifact | SkillArtifact): string {
  const { mode, paths } = resolveActivation(a);
  const trigger =
    mode === "paths" ? "glob" : mode === "manual" ? "manual" : "always_on";
  const globsBlock = trigger === "glob" ? `\nglobs:\n${yamlList(paths)}` : "";
  return `---
trigger: ${trigger}${globsBlock}
---

${artifactBody(a)}`;
}

// ── GitHub Copilot (ADR-0264): a repo-wide aggregate (`.github/copilot-instructions.md`, the same
// agent → skill → rule aggregation as AGENTS.md) plus one path-scoped instructions file per
// rule/skill. `applyTo` derives from `paths`; an artifact with no path scope still emits (applyTo:
// "**", repo-wide) but the caller (`renderHarnessBundles`) records a fidelity warning, since an
// unscoped Copilot instructions file is a real behavior difference worth flagging, not a silent
// degrade. ──────────────────────────────────────────────────────────────────────────────────────────

function copilotInstructionsFile(
  agents: readonly AgentArtifact[],
  skills: readonly SkillArtifact[],
  rules: readonly RuleArtifact[],
): string {
  return (
    "# Copilot instructions\n\nGenerated by @caisson-sh/agent-dev from one typed Caisson schema (GitHub Copilot harness; ADR-0264).\n" +
    aggregatedSections(agents, skills, rules)
  );
}

function copilotInstructionFile(
  a: RuleArtifact | SkillArtifact,
  applyTo: string,
): string {
  return `---
applyTo: ${yamlScalar(applyTo)}
---

${artifactBody(a)}`;
}

// ── Cline (ADR-0264): one rule file per rule/skill under `.clinerules/`, with an OPTIONAL `paths`
// frontmatter block — Cline has no file-level "manual" convention, so a `manual`-activated artifact
// is emitted as always-active with a fidelity warning (the caller records it) rather than silently
// dropping the author's intent. ────────────────────────────────────────────────────────────────────

function clineContent(a: RuleArtifact | SkillArtifact): string {
  const { mode, paths } = resolveActivation(a);
  const frontmatter =
    mode === "paths" ? `---\npaths:\n${yamlList(paths)}\n---\n\n` : "";
  return `${frontmatter}${artifactBody(a)}`;
}

/** Claude Code has no scoping mechanism for a rule/skill's `activation`/`paths` (rules always load;
 * skills already have their own separate `trigger` axis) — `paths` or `manual` on either always
 * pushes a fidelity warning (ADR-0264, never a silent degrade). */
function warnIfUnrepresentedByClaudeCode(
  warnings: string[],
  a: RuleArtifact | SkillArtifact,
): void {
  if (a.activation === "paths" || a.activation === "manual") {
    warnings.push(
      `Claude Code: ${a.kind} '${a.name}' uses '${a.activation}' activation, which .claude/${a.kind}s/ has no mechanism to represent — it always loads.`,
    );
  }
}

/**
 * Render one typed schema into the full multi-harness bundle. PURE + deterministic (no fs/clock/env):
 * the same artifacts fan out to `.claude/`, `AGENTS.md`, `.cursor/`, Devin/Windsurf, GitHub Copilot,
 * and Cline — proving no single harness is the substrate (ADR-0066/0264). The committed
 * `__golden__/emit/` tree freezes the bytes; `warnings[]` is populated in the SAME fixed per-target,
 * per-artifact order as the files so it stays deterministic and golden-pinnable.
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
  // Rule/skill artifacts only — the four rule/instruction targets below (Devin/Windsurf, Copilot
  // per-artifact, Cline) have no sub-agent concept and agents carry no activation field to render.
  const scopable = input.artifacts.filter(
    (a): a is RuleArtifact | SkillArtifact => a.kind !== "agent",
  );

  const files: EmittedFile[] = [];
  const warnings: string[] = [];
  const allowScripts = input.allowScripts === true;

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
          path: `.claude/skills/${a.name}/SKILL.md`,
          content: skillMarkdown(a),
        });
        files.push(...skillBundle(a, `.claude/skills/${a.name}`, allowScripts));
        warnIfUnrepresentedByClaudeCode(warnings, a);
        {
          // Executable content is trust-gated: withheld scripts are DISCLOSED once per skill (never a
          // silent drop), reusing the ADR-0264 fidelity-warning channel. Pushed here (the one loop that
          // visits every skill once) so the `.agents` twin loop below does not duplicate it.
          const scriptCount = a.scripts?.length ?? 0;
          if (!allowScripts && scriptCount > 0) {
            warnings.push(
              `Skill '${a.name}' declares ${scriptCount} script(s) withheld from emission; pass allowScripts to include them.`,
            );
          }
        }
        break;
      case "rule":
        files.push({
          path: `.claude/rules/${a.name}.md`,
          content: claudeRule(a),
        });
        warnIfUnrepresentedByClaudeCode(warnings, a);
        break;
      default: {
        const _exhaustive: never = a;
        throw new Error(`unknown artifact kind: ${String(_exhaustive)}`);
      }
    }
  }
  files.push({ path: ".claude/hooks.json", content: claudeHooks(input.hooks) });

  // .agents/skills — the universal cross-tool SKILL.md home (agentskills.io standard: Codex's current
  // home, Cursor-compatible). A SKILLS-ONLY surface: rules/agents do not emit here. The
  // SKILL.md bytes are IDENTICAL to `.claude/skills/<name>/SKILL.md` (the twin-path precedent). Like
  // Claude Code, this surface has no mechanism for a skill's `activation` scope — a `paths`/`manual`
  // skill pushes a fidelity warning (ADR-0264, never a silent degrade).
  for (const s of skills) {
    files.push({
      path: `.agents/skills/${s.name}/SKILL.md`,
      content: skillMarkdown(s),
    });
    files.push(...skillBundle(s, `.agents/skills/${s.name}`, allowScripts));
    if (s.activation === "paths" || s.activation === "manual") {
      warnings.push(
        `.agents (universal skills): skill '${s.name}' uses '${s.activation}' activation, which .agents/skills/ has no mechanism to represent — it always loads.`,
      );
    }
  }

  // AGENTS.md — the universal multi-tool base layer (one aggregated file; ADR-0264 §4).
  files.push({
    path: "AGENTS.md",
    content: codexAgents(agents, skills, rules),
  });

  // Cursor — one .mdc per artifact (input order); never warns (all 3 activation states representable).
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

  // Devin Desktop + legacy Windsurf fallback — byte-identical content at both paths; never warns.
  for (const a of scopable) {
    const content = devinContent(a);
    files.push({ path: `.devin/rules/${a.name}.md`, content });
    files.push({ path: `.windsurf/rules/${a.name}.md`, content });
  }

  // GitHub Copilot — one repo-wide aggregate, then one path-scoped instructions file per artifact.
  files.push({
    path: ".github/copilot-instructions.md",
    content: copilotInstructionsFile(agents, skills, rules),
  });
  for (const a of scopable) {
    const { paths } = resolveActivation(a);
    const applyTo = paths.length > 0 ? paths.join(",") : "**";
    files.push({
      path: `.github/instructions/${a.name}.instructions.md`,
      content: copilotInstructionFile(a, applyTo),
    });
    if (paths.length === 0) {
      warnings.push(
        `GitHub Copilot: ${a.kind} '${a.name}' has no path scope declared; .github/instructions/${a.name}.instructions.md applies repo-wide (applyTo: "**").`,
      );
    }
  }

  // Cline — one rule file per artifact; `manual` activation has no file-level Cline equivalent.
  for (const a of scopable) {
    files.push({ path: `.clinerules/${a.name}.md`, content: clineContent(a) });
    if (resolveActivation(a).mode === "manual") {
      warnings.push(
        `Cline: ${a.kind} '${a.name}' uses 'manual' activation, which .clinerules/ cannot represent at file level; emitting as always-active.`,
      );
    }
  }

  return { files, warnings };
}

// ── Write-path security guards ─────────────────────────────────────────────────────────────────────

// Credential SHAPES the emit refuses to write (mirrors the local-store egress-guard contract).
// `.test` is run WITHOUT the global flag so it stays stateless across calls.
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
