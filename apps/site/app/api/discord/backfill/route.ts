// POST /api/discord/backfill — the link-time Discord role sync (ADR-0203). Called by the dashboard
// after a buyer links Discord (or clicks "Sync roles"): resolves the SIGNED-IN user's linked
// Discord id from better-auth's own account list (never a request param — a caller cannot sync
// roles onto an arbitrary Discord user), reads the account's ACTIVE entitlements tenant-scoped,
// and pushes them to the support-bot. Config-gated: an unconfigured bot pair answers
// `{ pushed: false }` — never an error (role sync is best-effort, the money path is elsewhere).
// Takes no body — everything derives from the verified session.
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuth } from "@/lib/auth-server";
import { readEntitlementGrants } from "@/lib/dashboard-reads";
import { readScoped } from "@/lib/db";
import { loadDiscordGrantConfig, pushDiscordGrant } from "@/lib/discord-grant";

// Authed + tenant-scoped — never statically cached.
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const config = loadDiscordGrantConfig();
  const auth = getAuth();
  if (config === null || auth === null) {
    return NextResponse.json({ ok: true, pushed: false });
  }

  // The signed-in user's OWN Discord link (better-auth account list; providerId 'discord').
  let discordUserId = "";
  try {
    const accounts = (await auth.api.listUserAccounts({
      headers: await headers(),
    })) as Array<{ providerId: string; accountId: string }>;
    discordUserId =
      accounts.find((a) => a.providerId === "discord")?.accountId ?? "";
  } catch {
    discordUserId = "";
  }
  if (discordUserId === "") {
    return NextResponse.json({ ok: true, pushed: false });
  }

  const grants = await readScoped(session.accountId, (tx) =>
    readEntitlementGrants(tx, session.accountId),
  );
  const entitlements = [
    ...new Set(
      grants.filter((g) => g.status === "active").map((g) => g.entitlementId),
    ),
  ];
  if (entitlements.length === 0) {
    // Nothing purchased yet — pushing would grant the Customer umbrella to a non-customer.
    return NextResponse.json({ ok: true, pushed: false });
  }

  const pushed = await pushDiscordGrant(config, discordUserId, entitlements);
  return NextResponse.json({ ok: true, pushed });
}
