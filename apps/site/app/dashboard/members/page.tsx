// Members (D4, ADR-0176): the account's seats + owner-only add. The active account is resolved in
// `getSession` (lib/auth.ts) from `account_member`; this view lists that account's members
// (tenant-scoped via `listAccountMembers` -> `withTenant`, ADR-0005) and lets an OWNER add a seat.
// A single-user tenant sees just itself (the personal owner row, created on first session resolve).
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AccountMembership } from "@caisson/auth";
import { addAccountMember, listAccountMembers } from "@caisson/org-controls";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FormField,
  Icon,
  StatusChip,
} from "@caisson/ui/components";
import { getDb } from "@/lib/db";
import { requireDashboardSession } from "@/lib/auth";
import { accountHoldsOrgControls } from "@/lib/members-gate";

export const metadata: Metadata = { title: "Members" };

// A better-auth user id (the value `addAccountMember` writes to `account_member.user_id`). Bounded +
// trimmed at the boundary (security floor). ponytail: add-by-user-id, not invite-by-email — the
// email->user lookup + invite flow is the follow-up; the backend seam (addAccountMember) is by id.
const AddMemberInput = z
  .object({
    userId: z.string().trim().min(1).max(200),
  })
  .strict();

/**
 * Fail-closed org-controls entitlement gate (ADR-0257 §1.3): the member-management surface is part of
 * the $249 @caisson/org-controls module. Deny on ANY read error — never a silent allow.
 */
async function isMembersEntitled(accountId: string): Promise<boolean> {
  try {
    return await accountHoldsOrgControls(await getDb(), accountId);
  } catch {
    return false;
  }
}

async function addMemberAction(formData: FormData): Promise<void> {
  "use server";
  const session = await requireDashboardSession("/dashboard/members");
  // Entitlement gate re-checked in the action (defense-in-depth): a POST from an unentitled account
  // is refused here even though the UI hides the form, mirroring the owner-gate defense-in-depth.
  if (!(await isMembersEntitled(session.accountId))) return;
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

  // Fail-closed org-controls gate (ADR-0257 §1.3): no entitlement → the upsell, never the surface.
  if (!(await isMembersEntitled(session.accountId))) {
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
            Multi-user accounts, seats, and SSO are part of Org Controls.
          </p>
        </div>
        <Card style={{ display: "grid", gap: "var(--cs-space-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--cs-space-3)",
            }}
          >
            <Icon name="lock" size="md" />
            <h2
              className="cs-card-title"
              style={{ fontSize: "var(--cs-text-lg)", margin: 0 }}
            >
              Org Controls required
            </h2>
          </div>
          <p className="cs-muted" style={{ margin: 0 }}>
            Add teammates, manage seats, and enable SSO with the Org Controls
            module. Your account isn&apos;t entitled yet.
          </p>
          <div>
            <a href="/dashboard/plan">
              <Button variant="primary">View plans</Button>
            </a>
          </div>
        </Card>
      </div>
    );
  }

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
        empty={<EmptyState icon="users" title="No members yet" />}
      />

      {isOwner && (
        <Card>
          <form
            action={addMemberAction}
            style={{
              display: "grid",
              gap: "var(--cs-space-4)",
              maxWidth: "28rem",
            }}
          >
            <FormField
              label="Add a seat by user id"
              helperText="Paste the exact account/user id of the person to add — invite-by-email isn't available yet."
              mono
            >
              <input
                name="userId"
                required
                maxLength={200}
                placeholder="user_…"
              />
            </FormField>
            <div>
              <Button type="submit" variant="primary">
                Add seat
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
