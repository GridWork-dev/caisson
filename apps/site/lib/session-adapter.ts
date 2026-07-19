// The better-auth adapter decorator (ADR-0366 Path B) that makes the buyer session token
// hash-at-rest. Attached at the ONE construction site (`auth-server.ts` `createAuth()`) by
// wrapping the already-built Kysely `DBAdapter` for the "session" model only — every other
// model (user/account/verification) passes straight through untouched, and every session
// operation that doesn't reference the `token` field passes through untouched too.
//
// COUPLING (state it plainly, per the SPEC this ADR overrides — `outputs/specs/deferred-respec/
// SPEC-auth-session-token-hashing.md`): this decorator assumes better-auth's internal session
// queries key exclusively on a `Where` entry with `field === "token"` — a single `eq`/undefined-
// operator string value (create/findOne/update/delete) or a single `operator: "in"` string-array
// value (findMany/deleteMany's plural forms), the exact shape
// `better-auth/dist/db/internal-adapter.mjs`'s `createSession` / `findSession` / `findSessions` /
// `updateSession` / `deleteSession` / `deleteSessions` build today (better-auth 1.6.23). A future
// better-auth upgrade that changes this shape is NOT silently absorbed: `rewriteTokenWhere` throws
// loudly instead of guessing, and `auth-server.test.ts` exercises a REAL sign-in flow through this
// wrap on every run — either failure surfaces immediately, never a quiet broken lookup.
import type { DBAdapter, DBTransactionAdapter, Where } from "better-auth/types";
import { deriveTokenLookupKey } from "@caisson/auth";

const SESSION_MODEL = "session";

type Row = Record<string, unknown>;

/**
 * Rewrite a session-model `where` clause's `token` entry (if any) from raw value(s) to HMAC
 * lookup key(s), returning a function that maps a result row's (now-hashed) `token` field back
 * to the raw value the caller queried with. A `where` with no `token` entry passes through
 * unchanged. Throws if a `token` entry doesn't match one of the two shapes better-auth builds
 * today (the conformance guard described in the file header).
 */
function rewriteTokenWhere(
  where: Where[] | undefined,
  hmacKey: string,
): { where: Where[] | undefined; restoreToken: (value: unknown) => unknown } {
  const passthrough = {
    where,
    restoreToken: (value: unknown): unknown => value,
  };
  if (!where) return passthrough;
  const tokenEntries = where.filter((w) => w.field === "token");
  if (tokenEntries.length === 0) return passthrough;
  if (tokenEntries.length > 1) {
    throw new Error(
      "session-adapter: multiple `token` where-entries — better-auth's session query shape changed; update the ADR-0366 wrap.",
    );
  }
  const entry = tokenEntries[0] as Where;
  if (
    entry.operator === "in" &&
    Array.isArray(entry.value) &&
    entry.value.every((v) => typeof v === "string")
  ) {
    const raws = entry.value as string[];
    const byLookupKey = new Map(
      raws.map((raw) => [deriveTokenLookupKey(raw, hmacKey), raw]),
    );
    const newWhere = where.map((w) =>
      w === entry ? { ...w, value: [...byLookupKey.keys()] } : w,
    );
    return {
      where: newWhere,
      restoreToken: (value) =>
        typeof value === "string" && byLookupKey.has(value)
          ? (byLookupKey.get(value) as string)
          : value,
    };
  }
  if (
    typeof entry.value === "string" &&
    (entry.operator === undefined || entry.operator === "eq")
  ) {
    const raw = entry.value;
    const lookupKey = deriveTokenLookupKey(raw, hmacKey);
    const newWhere = where.map((w) =>
      w === entry ? { ...w, value: lookupKey } : w,
    );
    return { where: newWhere, restoreToken: (): string => raw };
  }
  throw new Error(
    "session-adapter: unrecognized `token` where-entry shape — better-auth's session query shape changed; update the ADR-0366 wrap.",
  );
}

function restoreRow<T>(
  row: T | null,
  restoreToken: (value: unknown) => unknown,
): T | null {
  if (row === null || typeof row !== "object") return row;
  const record = row as Row;
  if (!("token" in record)) return row;
  return { ...record, token: restoreToken(record.token) } as T;
}

/**
 * Wrap a better-auth `DBAdapter` so the `session` model's `token` column is written/read as its
 * HMAC-SHA-256 lookup key (ADR-0366) instead of the raw bearer token. Every other model, and
 * every session query that doesn't touch `token`, passes straight through to `base`.
 */
export function wrapSessionAdapter(
  base: DBAdapter,
  hmacKey: string,
): DBAdapter {
  return {
    ...base,
    // The `any` bound here mirrors `DBAdapter["create"]`'s own generic constraint exactly (better-
    // auth's upstream type, `@better-auth/core/db/adapter`) — required for structural assignment,
    // not a locally-introduced escape hatch; nothing in this function body is typed `any`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async create<T extends Record<string, any>, R = T>(data: {
      model: string;
      data: Omit<T, "id">;
      select?: string[] | undefined;
      forceAllowId?: boolean | undefined;
    }): Promise<R> {
      const rawData = data.data as Row;
      const raw =
        data.model === SESSION_MODEL && typeof rawData.token === "string"
          ? (rawData.token as string)
          : undefined;
      if (raw === undefined) return base.create<T, R>(data);
      const result = await base.create<T, R>({
        ...data,
        data: { ...data.data, token: deriveTokenLookupKey(raw, hmacKey) },
      });
      return restoreRow(result, () => raw) as R;
    },
    async findOne<T>(data: {
      model: string;
      where: Where[];
      select?: string[] | undefined;
      join?: Parameters<DBAdapter["findOne"]>[0]["join"];
    }): Promise<T | null> {
      if (data.model !== SESSION_MODEL) return base.findOne<T>(data);
      const { where, restoreToken } = rewriteTokenWhere(data.where, hmacKey);
      const result = await base.findOne<T>({
        ...data,
        where: where as Where[],
      });
      return restoreRow(result, restoreToken);
    },
    async findMany<T>(data: {
      model: string;
      where?: Where[] | undefined;
      limit?: number | undefined;
      select?: string[] | undefined;
      sortBy?: { field: string; direction: "asc" | "desc" } | undefined;
      offset?: number | undefined;
      join?: Parameters<DBAdapter["findMany"]>[0]["join"];
    }): Promise<T[]> {
      if (data.model !== SESSION_MODEL) return base.findMany<T>(data);
      const { where, restoreToken } = rewriteTokenWhere(data.where, hmacKey);
      const results = await base.findMany<T>({ ...data, where });
      return results.map((row) => restoreRow(row, restoreToken) as T);
    },
    async update<T>(data: {
      model: string;
      where: Where[];
      update: Record<string, unknown>;
    }): Promise<T | null> {
      if (data.model !== SESSION_MODEL) return base.update<T>(data);
      const { where, restoreToken } = rewriteTokenWhere(data.where, hmacKey);
      let update = data.update;
      let restore = restoreToken;
      const newRaw = (update as Row).token;
      if (typeof newRaw === "string") {
        update = { ...update, token: deriveTokenLookupKey(newRaw, hmacKey) };
        restore = (): string => newRaw;
      }
      const result = await base.update<T>({
        ...data,
        where: where as Where[],
        update,
      });
      return restoreRow(result, restore);
    },
    async updateMany(data) {
      if (data.model !== SESSION_MODEL) return base.updateMany(data);
      const { where } = rewriteTokenWhere(data.where, hmacKey);
      // Same rule as `update`: a `token` in the update payload is a RAW value that must never
      // reach the DB unhashed — the wrap's whole contract is throw-loudly-or-hash, never pass
      // through silently.
      const newRaw = (data.update as Row).token;
      const update =
        typeof newRaw === "string"
          ? { ...data.update, token: deriveTokenLookupKey(newRaw, hmacKey) }
          : data.update;
      return base.updateMany({ ...data, where: where as Where[], update });
    },
    async delete(data) {
      if (data.model !== SESSION_MODEL) return base.delete(data);
      const { where } = rewriteTokenWhere(data.where, hmacKey);
      return base.delete({ ...data, where: where as Where[] });
    },
    async deleteMany(data) {
      if (data.model !== SESSION_MODEL) return base.deleteMany(data);
      const { where } = rewriteTokenWhere(data.where, hmacKey);
      return base.deleteMany({ ...data, where: where as Where[] });
    },
    async consumeOne<T>(data: {
      model: string;
      where: Where[];
    }): Promise<T | null> {
      if (data.model !== SESSION_MODEL) return base.consumeOne<T>(data);
      const { where, restoreToken } = rewriteTokenWhere(data.where, hmacKey);
      const result = await base.consumeOne<T>({
        ...data,
        where: where as Where[],
      });
      return restoreRow(result, restoreToken);
    },
    async incrementOne<T>(data: {
      model: string;
      where: Where[];
      increment: Record<string, number>;
      set?: Record<string, unknown> | undefined;
    }): Promise<T | null> {
      if (data.model !== SESSION_MODEL) return base.incrementOne<T>(data);
      const { where, restoreToken } = rewriteTokenWhere(data.where, hmacKey);
      const result = await base.incrementOne<T>({
        ...data,
        where: where as Where[],
      });
      return restoreRow(result, restoreToken);
    },
    async count(data) {
      if (data.model !== SESSION_MODEL) return base.count(data);
      const { where } = rewriteTokenWhere(data.where, hmacKey);
      return base.count({ ...data, where });
    },
    transaction(cb) {
      return base.transaction((trx) =>
        cb(
          wrapSessionAdapter(trx as DBAdapter, hmacKey) as DBTransactionAdapter,
        ),
      );
    },
  };
}
