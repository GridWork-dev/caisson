// The prompt registry API (ADR-0061). Append-only versioning + `name@version` / `name@alias`
// addressing + a mutable alias pointer, all over a `TenantExecutor` (every call runs inside a
// `withTenant` scope, so RLS is the tenant boundary — these functions never filter by account_id in
// app logic to authorize; they pass it for the row's own column + readable errors).
//
// Versioning reuses the kernel `versioning` chain verbatim (ADR-0006): the lineage is derived from
// `supersedes_id`, "current" is the tip nothing supersedes, and `validateVersionSet` flags a fork or
// cycle rather than guessing. Promotion mutates ONLY the alias pointer — never a version row.
import {
  ConflictError,
  NotFoundError,
  currentVersions,
  isUniqueViolation,
  parseStrict,
  versionChain,
} from "@caisson-sh/kernel";
import type { VersionRecord } from "@caisson-sh/kernel";
import type { TenantExecutor } from "@caisson-sh/tenancy-rls";
import { z } from "zod";
import { PROMPT_ALIAS_TABLE, PROMPT_VERSION_TABLE } from "./schema.ts";
import { promptMessagesSchema, renderPrompt, varSpecSchema } from "./render.ts";
import type { PromptMessage, RenderedMessage, VarSpec } from "./render.ts";
// The addressing half lives in its own module so it carries no edge to the DB half above and can
// back the `./browser` entry; the parser and the field schemas are the same ones, not copies.
import { accountId, parsePromptRef, slug } from "./refs.ts";

/** Input to mint a prompt version (the first call is v1; each later call supersedes the tip). */
export const registerPromptInput = z
  .object({
    accountId,
    name: slug,
    messages: promptMessagesSchema,
    varSpec: varSpecSchema,
  })
  .strict();
export type RegisterPromptInput = z.infer<typeof registerPromptInput>;

const versionRef = z
  .object({ accountId, name: slug, version: z.number().int().positive() })
  .strict();
const nameRef = z.object({ accountId, name: slug }).strict();
const aliasRef = z.object({ accountId, name: slug, alias: slug }).strict();

/** Set/promote an alias to a specific version number (the pointer is the only mutable surface). */
export const setAliasInput = z
  .object({
    accountId,
    name: slug,
    alias: slug,
    version: z.number().int().positive(),
  })
  .strict();
export type SetAliasInput = z.infer<typeof setAliasInput>;

/** A resolved, immutable prompt version. */
export interface PromptVersion {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly version: number;
  readonly supersedesId: string | null;
  readonly messages: PromptMessage[];
  readonly varSpec: VarSpec;
  readonly createdAt: string;
}

interface VersionDbRow {
  id: string;
  account_id: string;
  name: string;
  version: number;
  supersedes_id: string | null;
  messages: unknown;
  var_spec: unknown;
  created_at: unknown;
}

/** jsonb comes back parsed from PGlite/pg; tolerate a string form defensively, then validate. */
function coerceJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function mapVersion(row: VersionDbRow): PromptVersion {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    version: row.version,
    supersedesId: row.supersedes_id,
    messages: parseStrict(promptMessagesSchema, coerceJson(row.messages)),
    varSpec: parseStrict(varSpecSchema, coerceJson(row.var_spec)),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

const SELECT_COLS =
  "id, account_id, name, version, supersedes_id, messages, var_spec, created_at";

/** All versions of `name`, raw rows (ascending version is not assumed — the chain derives order). */
async function fetchLineage(
  tx: TenantExecutor,
  account: string,
  name: string,
): Promise<VersionDbRow[]> {
  const { rows } = await tx.query<VersionDbRow>(
    `SELECT ${SELECT_COLS} FROM ${PROMPT_VERSION_TABLE} WHERE account_id = $1 AND name = $2`,
    [account, name],
  );
  return rows;
}

const toRecord = (r: VersionDbRow): VersionRecord => ({
  id: r.id,
  supersedesId: r.supersedes_id,
});

/**
 * Mint a prompt version. The first version of a name is v1 (root); each later call derives the
 * current tip via the kernel `versioning` chain and supersedes it (v = tip.version + 1). Concurrent
 * minting of the same `(name, version)` hits the unique index → `ConflictError` (retry resolves it).
 */
export async function registerPrompt(
  tx: TenantExecutor,
  input: RegisterPromptInput,
): Promise<PromptVersion> {
  const {
    accountId: account,
    name,
    messages,
    varSpec,
  } = parseStrict(registerPromptInput, input);

  const lineage = await fetchLineage(tx, account, name);
  // `currentVersions` validates the set (flags fork/cycle, ADR-0006) and returns the tip(s); an
  // append-only single lineage has exactly one tip, or zero for a brand-new name.
  const tips = currentVersions(lineage.map(toRecord));
  const tip = tips[0];
  const tipRow =
    tip === undefined ? undefined : lineage.find((r) => r.id === tip.id);
  const version = tipRow === undefined ? 1 : tipRow.version + 1;
  const supersedesId = tipRow?.id ?? null;

  const id = crypto.randomUUID();
  try {
    await tx.query(
      `INSERT INTO ${PROMPT_VERSION_TABLE}
         (id, account_id, name, version, supersedes_id, messages, var_spec)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        id,
        account,
        name,
        version,
        supersedesId,
        JSON.stringify(messages),
        JSON.stringify(varSpec),
      ],
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError("Prompt version already exists", {
        name,
        version,
      });
    }
    throw err;
  }

  return {
    id,
    accountId: account,
    name,
    version,
    supersedesId,
    messages,
    varSpec,
    createdAt: new Date().toISOString(),
  };
}

/** Fetch an exact `name@version`. Fail-closed: a missing row (or another tenant's) is 404. */
export async function getVersion(
  tx: TenantExecutor,
  input: z.infer<typeof versionRef>,
): Promise<PromptVersion> {
  const { accountId: account, name, version } = parseStrict(versionRef, input);
  const { rows } = await tx.query<VersionDbRow>(
    `SELECT ${SELECT_COLS} FROM ${PROMPT_VERSION_TABLE}
       WHERE account_id = $1 AND name = $2 AND version = $3`,
    [account, name, version],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError("Prompt version not found", { name, version });
  }
  return mapVersion(row);
}

/** The current version (the lineage tip nothing supersedes). 404 if the name has no versions. */
export async function getCurrentVersion(
  tx: TenantExecutor,
  input: z.infer<typeof nameRef>,
): Promise<PromptVersion> {
  const { accountId: account, name } = parseStrict(nameRef, input);
  const lineage = await fetchLineage(tx, account, name);
  const tips = currentVersions(lineage.map(toRecord));
  const tip = tips[0];
  if (tip === undefined) {
    throw new NotFoundError("Prompt not found", { name });
  }
  const row = lineage.find((r) => r.id === tip.id);
  if (row === undefined) {
    throw new NotFoundError("Prompt not found", { name });
  }
  return mapVersion(row);
}

/** The full lineage of `name`, oldest (root) → newest (tip), via the kernel `versionChain`. */
export async function listVersions(
  tx: TenantExecutor,
  input: z.infer<typeof nameRef>,
): Promise<PromptVersion[]> {
  const { accountId: account, name } = parseStrict(nameRef, input);
  const lineage = await fetchLineage(tx, account, name);
  if (lineage.length === 0) return [];
  const records = lineage.map(toRecord);
  const tip = currentVersions(records)[0];
  if (tip === undefined) return [];
  const byId = new Map(lineage.map((r) => [r.id, r]));
  return versionChain(records, tip.id).map((rec) => {
    const row = byId.get(rec.id);
    if (row === undefined) {
      throw new NotFoundError("Prompt version not found", { name });
    }
    return mapVersion(row);
  });
}

/** Point an alias at a version (insert or promote). Mutates ONLY the pointer — never a version row. */
export async function setAlias(
  tx: TenantExecutor,
  input: SetAliasInput,
): Promise<void> {
  const {
    accountId: account,
    name,
    alias,
    version,
  } = parseStrict(setAliasInput, input);
  // Resolve the target version first so a dangling alias can never be written (fail-closed).
  const target = await getVersion(tx, { accountId: account, name, version });
  await tx.query(
    `INSERT INTO ${PROMPT_ALIAS_TABLE} (account_id, name, alias, version_id, updated_at)
       VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (account_id, name, alias)
       DO UPDATE SET version_id = EXCLUDED.version_id, updated_at = now()`,
    [account, name, alias, target.id],
  );
}

/** Resolve `name@alias` → the version it points at. 404 if the alias is unset. */
export async function getAlias(
  tx: TenantExecutor,
  input: z.infer<typeof aliasRef>,
): Promise<PromptVersion> {
  const { accountId: account, name, alias } = parseStrict(aliasRef, input);
  const { rows } = await tx.query<{ version_id: string }>(
    `SELECT version_id FROM ${PROMPT_ALIAS_TABLE}
       WHERE account_id = $1 AND name = $2 AND alias = $3`,
    [account, name, alias],
  );
  const ptr = rows[0];
  if (ptr === undefined) {
    throw new NotFoundError("Prompt alias not found", { name, alias });
  }
  const { rows: vrows } = await tx.query<VersionDbRow>(
    `SELECT ${SELECT_COLS} FROM ${PROMPT_VERSION_TABLE} WHERE id = $1`,
    [ptr.version_id],
  );
  const row = vrows[0];
  if (row === undefined) {
    throw new NotFoundError("Prompt alias not found", { name, alias });
  }
  return mapVersion(row);
}

/** Resolve any `name@version|alias|<current>` reference to its immutable version. */
export async function resolvePrompt(
  tx: TenantExecutor,
  account: string,
  ref: string,
): Promise<PromptVersion> {
  const acct = parseStrict(accountId, account);
  const parsed = parsePromptRef(ref);
  switch (parsed.kind) {
    case "current":
      return getCurrentVersion(tx, { accountId: acct, name: parsed.name });
    case "version":
      return getVersion(tx, {
        accountId: acct,
        name: parsed.name,
        version: parsed.version,
      });
    case "alias":
      return getAlias(tx, {
        accountId: acct,
        name: parsed.name,
        alias: parsed.alias,
      });
  }
}

/** Render a resolved version's template with untrusted vars (the injection-safe boundary). */
export function renderVersion(
  version: PromptVersion,
  rawVars: unknown,
): RenderedMessage[] {
  return renderPrompt(version.messages, version.varSpec, rawVars);
}
