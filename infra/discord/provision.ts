#!/usr/bin/env bun
/**
 * Caisson Discord server provisioner (ADR-0109, research-backed IA).
 *
 * Idempotent: every role/category/channel is matched by name first and created only if missing, so
 * re-running converges instead of duplicating. Drives the bot token (the bot has admin in the guild)
 * against the Discord REST v10 API. Builds:
 *   • server identity — icon (the brand mark), name, verification level 2 (MEDIUM)
 *   • roles — Staff, Customer, the four edition roles, Member (Founder = the operator's own role)
 *   • 6 categories + ~20 text channels with the per-channel permission overwrites from the IA spec
 *
 * v1 ships TEXT channels (type 0) so nothing depends on Community being enabled. Community-gated
 * upgrades (forum #support/#bug-reports/#feature-requests, announcement #announcements/#changelog,
 * Onboarding, AutoMod) are a follow-up after the operator flips Community in the dashboard — this
 * script reports whether Community is on and which upgrades remain.
 *
 * Prints a NAME → ID map at the end (feed the channel/role ids into the bot's Railway env).
 *
 * Usage: DISCORD_TOKEN=... bun infra/discord/provision.ts   (GUILD_ID defaults to the Caisson guild)
 * Not product code — an operational one-shot. Bounded-timeout fetch + 429 backoff.
 */
import { readFileSync } from "node:fs";
import { fetchWithTimeout } from "@caisson-sh/kernel";

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_TOKEN ?? "";
const GUILD = process.env.GUILD_ID ?? "1521508737133842533";
const BOT_USER_ID = process.env.BOT_USER_ID ?? "1521511011809493043";
const ICON_PATH = process.env.ICON_PATH ?? "";

if (TOKEN.length === 0) {
  console.error("DISCORD_TOKEN is required.");
  process.exit(1);
}

// --- permission bits (BigInt; Discord wants allow/deny as stringified bitfields) ---
const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const MANAGE_MESSAGES = 1n << 13n;
const EMBED_LINKS = 1n << 14n;
const ATTACH_FILES = 1n << 15n;
const READ_HISTORY = 1n << 16n;
const ADD_REACTIONS = 1n << 6n;
const CREATE_PUBLIC_THREADS = 1n << 35n;
const CREATE_PRIVATE_THREADS = 1n << 36n;
const SEND_IN_THREADS = 1n << 38n;
const KICK = 1n << 1n;
const BAN = 1n << 2n;
const MODERATE = 1n << 40n;
const MANAGE_THREADS = 1n << 34n;
const VIEW_AUDIT_LOG = 1n << 7n;

const bit = (...bits: bigint[]): string =>
  bits.reduce((a, b) => a | b, 0n).toString();

interface Overwrite {
  id: string;
  type: 0 | 1; // 0 = role, 1 = member
  allow: string;
  deny: string;
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetchWithTimeout(
      `${API}${path}`,
      {
        method,
        headers: {
          authorization: `Bot ${TOKEN}`,
          "content-type": "application/json",
          "user-agent": "CaissonProvisioner (caisson.sh, 1.0)",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      { timeoutMs: 20_000 },
    );
    if (res.status === 429) {
      const j = (await res.json().catch(() => ({}))) as {
        retry_after?: number;
      };
      const wait = Math.ceil((j.retry_after ?? 1) * 1000) + 250;
      console.error(`  …429 rate-limited, waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `${method} ${path} → ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }
  throw new Error(`${method} ${path} → exhausted 429 retries`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Role {
  id: string;
  name: string;
  tags?: { bot_id?: string };
}
interface Channel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

async function main(): Promise<void> {
  console.log(`Provisioning guild ${GUILD}…`);
  const guild = await api<{ name: string; features: string[] }>(
    "GET",
    `/guilds/${GUILD}`,
  );
  const community = guild.features.includes("COMMUNITY");
  console.log(
    `  guild "${guild.name}" · Community ${community ? "ENABLED" : "not enabled"}`,
  );

  const roles = await api<Role[]>("GET", `/guilds/${GUILD}/roles`);
  const channels = await api<Channel[]>("GET", `/guilds/${GUILD}/channels`);
  const everyone = GUILD; // @everyone role id == guild id
  const botRole = roles.find((r) => r.tags?.bot_id === BOT_USER_ID);
  if (!botRole)
    console.error(
      "  ! bot's managed role not found — overwrites for the bot are skipped",
    );

  const ids: Record<string, string> = {};

  // --- roles (create if missing by name) ---
  async function ensureRole(
    name: string,
    opts: { permissions?: string; color?: number; hoist?: boolean } = {},
  ): Promise<string> {
    const existing = roles.find((r) => r.name === name);
    if (existing) {
      ids[`role:${name}`] = existing.id;
      console.log(`  role = ${name} (exists)`);
      return existing.id;
    }
    const created = await api<Role>("POST", `/guilds/${GUILD}/roles`, {
      name,
      permissions: opts.permissions ?? "0",
      color: opts.color ?? 0,
      hoist: opts.hoist ?? false,
      mentionable: false,
    });
    roles.push(created);
    ids[`role:${name}`] = created.id;
    console.log(`  role + ${name}`);
    await sleep(300);
    return created.id;
  }

  const staffId = await ensureRole("Staff", {
    permissions: bit(
      KICK,
      BAN,
      MODERATE,
      MANAGE_MESSAGES,
      MANAGE_THREADS,
      VIEW_AUDIT_LOG,
    ),
    color: 0x43bcd0,
    hoist: true,
  });
  const customerId = await ensureRole("Customer", {
    color: 0x2b9ebd,
    hoist: true,
  });
  const roleCompliance = await ensureRole("Compliance");
  const roleAiKit = await ensureRole("AI Production Kit");
  const roleLocalFirst = await ensureRole("Local-first AI");
  const roleAgentic = await ensureRole("Agentic-Dev");
  const memberId = await ensureRole("Member", {
    permissions: bit(EMBED_LINKS, ATTACH_FILES),
  });

  // --- overwrite presets ---
  const staffBot = (extra: bigint = 0n): Overwrite[] => {
    const o: Overwrite[] = [
      {
        id: staffId,
        type: 0,
        allow: bit(VIEW, SEND, READ_HISTORY, extra),
        deny: "0",
      },
    ];
    if (botRole)
      o.push({ id: botRole.id, type: 0, allow: bit(VIEW, SEND), deny: "0" });
    return o;
  };
  const READONLY: Overwrite[] = [
    {
      id: everyone,
      type: 0,
      allow: bit(VIEW, READ_HISTORY, ADD_REACTIONS),
      deny: bit(
        SEND,
        CREATE_PUBLIC_THREADS,
        CREATE_PRIVATE_THREADS,
        SEND_IN_THREADS,
      ),
    },
    ...staffBot(MANAGE_MESSAGES),
  ];
  const gated = (roleId: string): Overwrite[] => [
    { id: everyone, type: 0, allow: "0", deny: bit(VIEW) },
    { id: roleId, type: 0, allow: bit(VIEW, SEND, READ_HISTORY), deny: "0" },
    ...staffBot(),
  ];
  const PRIVATE: Overwrite[] = [
    { id: everyone, type: 0, allow: "0", deny: bit(VIEW) },
    ...staffBot(),
  ];

  // --- categories + channels ---
  async function ensureCategory(
    name: string,
    overwrites: Overwrite[] = [],
  ): Promise<string> {
    const existing = channels.find((c) => c.type === 4 && c.name === name);
    if (existing) {
      ids[`cat:${name}`] = existing.id;
      console.log(`  category = ${name} (exists)`);
      return existing.id;
    }
    const created = await api<Channel>("POST", `/guilds/${GUILD}/channels`, {
      name,
      type: 4,
      permission_overwrites: overwrites,
    });
    channels.push(created);
    ids[`cat:${name}`] = created.id;
    console.log(`  category + ${name}`);
    await sleep(300);
    return created.id;
  }

  async function ensureChannel(
    name: string,
    parentId: string,
    opts: { topic?: string; overwrites?: Overwrite[] } = {},
  ): Promise<string> {
    const existing = channels.find((c) => c.type === 0 && c.name === name);
    if (existing) {
      ids[`chan:${name}`] = existing.id;
      console.log(`    # ${name} (exists)`);
      return existing.id;
    }
    const created = await api<Channel>("POST", `/guilds/${GUILD}/channels`, {
      name,
      type: 0,
      parent_id: parentId,
      ...(opts.topic ? { topic: opts.topic } : {}),
      ...(opts.overwrites ? { permission_overwrites: opts.overwrites } : {}),
    });
    channels.push(created);
    ids[`chan:${name}`] = created.id;
    console.log(`    # + ${name}`);
    await sleep(300);
    return created.id;
  }

  const startHere = await ensureCategory("START HERE");
  await ensureChannel("welcome", startHere, {
    overwrites: READONLY,
    topic: "What Caisson is + the server map.",
  });
  await ensureChannel("rules", startHere, {
    overwrites: READONLY,
    topic: "Community rules.",
  });
  await ensureChannel("announcements", startHere, {
    overwrites: READONLY,
    topic: "Official news.",
  });
  await ensureChannel("changelog", startHere, {
    overwrites: READONLY,
    topic: "Release + version drops.",
  });

  const community_ = await ensureCategory("COMMUNITY");
  await ensureChannel("introductions", community_, {
    topic: "New members + their stack.",
  });
  await ensureChannel("general", community_, { topic: "Broad discussion." });
  await ensureChannel("showcase", community_, {
    topic: "What I built on Caisson.",
  });
  await ensureChannel("off-topic", community_, {
    topic: "Lightweight chatter.",
  });

  const help = await ensureCategory("HELP & SUPPORT");
  await ensureChannel("ask-ai", help, {
    topic:
      "First-line AI support — ask anything, the bot answers from the docs.",
  });
  await ensureChannel("support", help, {
    topic: "Human support; the bot escalates here.",
  });
  await ensureChannel("bug-reports", help, { topic: "One bug per post." });
  await ensureChannel("feature-requests", help, {
    topic: "One request per post; react to vote.",
  });

  const editions = await ensureCategory("EDITIONS");
  await ensureChannel("base-substrate", editions, {
    topic: "Apache-2.0 base — open to everyone.",
  });
  await ensureChannel("compliance", editions, {
    overwrites: gated(roleCompliance),
    topic: "Compliance edition.",
  });
  await ensureChannel("ai-production-kit", editions, {
    overwrites: gated(roleAiKit),
    topic: "AI Production Kit edition.",
  });
  await ensureChannel("local-first-ai", editions, {
    overwrites: gated(roleLocalFirst),
    topic: "Local-first AI edition.",
  });
  await ensureChannel("agentic-dev", editions, {
    overwrites: gated(roleAgentic),
    topic: "Agentic-Dev edition.",
  });

  const customers = await ensureCategory("CUSTOMERS");
  await ensureChannel("customer-lounge", customers, {
    overwrites: gated(customerId),
    topic: "Any paid customer.",
  });

  const team = await ensureCategory("TEAM", PRIVATE);
  // children created with NO overwrites inherit (sync to) the private category.
  await ensureChannel("team", team);
  await ensureChannel("mod-log", team);
  await ensureChannel("support-ops", team);
  await ensureChannel("bot-config", team);

  // --- server identity ---
  console.log("Setting server identity…");
  const patch: Record<string, unknown> = {
    name: "Caisson",
    verification_level: 2,
  };
  if (ICON_PATH) {
    try {
      const png = readFileSync(ICON_PATH);
      patch.icon = `data:image/png;base64,${png.toString("base64")}`;
    } catch (e) {
      console.error(
        `  ! could not read icon ${ICON_PATH}: ${(e as Error).message}`,
      );
    }
  }
  if (community)
    patch.description =
      "Compliance-grade code infrastructure — composable base + premium editions.";
  await api("PATCH", `/guilds/${GUILD}`, patch);
  console.log(
    `  name=Caisson · verification=MEDIUM${patch.icon ? " · icon set" : ""}`,
  );

  // --- id map for the bot env ---
  console.log("\n=== NAME → ID (wire into the bot's Railway env) ===");
  console.log(JSON.stringify(ids, null, 2));
  console.log("\nBot env mapping:");
  console.log(
    `  SUPPORT_CHANNEL_ID   = ${ids["chan:ask-ai"]}   (needs Message Content Intent)`,
  );
  console.log(`  WELCOME_CHANNEL_ID   = ${ids["chan:welcome"]}`);
  console.log(`  SUPPORT_HUMAN_ROLE_ID= ${staffId}   (Staff)`);
  console.log(
    `  MEMBER_ROLE_ID       = ${memberId}   (needs Server Members Intent)`,
  );
  console.log(`  CUSTOMER_ROLE_ID     = ${customerId}`);
  console.log(`  ROLE_COMPLIANCE_ID   = ${roleCompliance}`);
  console.log(`  ROLE_AI_KIT_ID       = ${roleAiKit}`);
  console.log(`  ROLE_LOCAL_FIRST_ID  = ${roleLocalFirst}`);
  console.log(`  ROLE_AGENTIC_ID      = ${roleAgentic}`);

  if (!community) {
    console.log(
      "\n⚠ Community NOT enabled — text channels created. This script does not convert channel",
    );
    console.log(
      "  types after the fact: once Community is enabled in the dashboard, manually convert",
    );
    console.log(
      "  #support/#bug-reports/#feature-requests to forum and #announcements/#changelog to",
    );
    console.log(
      "  announcement type in Discord's UI, and add Onboarding + AutoMod there too.",
    );
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
