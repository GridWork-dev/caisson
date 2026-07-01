// Members (D4, ADR-0176): the account's seats + owner-only add. The active account is resolved in
// `getSession` (lib/auth.ts) from `account_member`; this view lists that account's members
// (tenant-scoped via `listAccountMembers` -> `withTenant`, ADR-0005) and lets an OWNER add a seat.
// A single-user tenant sees just itself (the personal owner row, created on first session resolve).
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type AccountMembership,
  addAccountMember,
  listAccountMembers,
} from "@caisson/auth";
import { Button, DataTable, StatusChip } from "@caisson/ui/components";
import { getDb } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Members" };

// A better-auth user id (the value `addAccountMember` writes to `account_member.user_id`). Bounded +
// trimmed at the boundary (security floor). ponytail: add-by-user-id, not invite-by-email — the
// email->user lookup + invite flow is the follow-up; the backend seam (addAccountMember) is by id.
const AddMemberInput = z
  .object({
    userId: z.string().trim().min(1).max(200),
  })
  .strict();

async function addMemberAction(formData: FormData): Promise<void> {
  "use server";
  const session = await requireDashboardSession("/dashboard/members");
  const parsed = AddMemberInput.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return;
  const db = await getDb();
  // Owner-gated inside addAccountMember (assertCanManageMembers); the actor's role comes from the
  // verified session, never the form — a seat cannot escalate by posting here.
  await addAccountMember(
    db,
    session.role,
    session.accountId,
    parsed.data.userId,
    "seat",
  );
  revalidatePath("/dashboard/members");
}

export default async function DashboardMembersPage() {
  const session = await requireDashboardSession("/dashboard/members");
  const db = await getDb();
  const members = await listAccountMembers(db, session.accountId);
  const isOwner = session.role === "owner";

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Members
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Everyone with access to this account.{" "}
          {isOwner
            ? "As the owner you can add seats."
            : "Only the account owner can add or remove seats."}
        </p>
      </div>

      <DataTable<AccountMembership>
        columns={[
          {
            key: "userId",
            header: "User",
            render: (m) => (
              <span style={{ fontFamily: "var(--cs-font-mono)" }}>
                {m.userId}
              </span>
            ),
          },
          {
            key: "role",
            header: "Role",
            render: (m) => (
              <StatusChip
                label={m.role}
                tone={m.role === "owner" ? "accent" : "muted"}
                dot
              />
            ),
          },
        ]}
        rows={members}
        rowKey={(m) => m.userId}
        empty={<span className="cs-muted">No members yet.</span>}
      />

      {isOwner && (
        <form
          action={addMemberAction}
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "grid", gap: "var(--cs-space-2)" }}>
            <span
              className="cs-muted"
              style={{ fontSize: "var(--cs-text-xs)" }}
            >
              Add a seat by user id
            </span>
            <input
              name="userId"
              required
              maxLength={200}
              placeholder="user_…"
              style={{
                fontFamily: "var(--cs-font-mono)",
                fontSize: "var(--cs-text-sm)",
                padding: "var(--cs-space-2) var(--cs-space-3)",
                border: "1px solid var(--cs-border)",
                borderRadius: "var(--cs-radius-md)",
                background: "var(--cs-surface1)",
                color: "var(--cs-fg)",
                minWidth: "22ch",
              }}
            />
          </label>
          <Button type="submit" variant="primary">
            Add seat
          </Button>
        </form>
      )}
    </div>
  );
}
