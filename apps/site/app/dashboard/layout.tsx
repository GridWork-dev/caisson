// The buyer dashboard route group (ADR-0114): authed, force-dynamic, tenant-scoped. Every
// `/dashboard/**` route is gated here — `requireDashboardSession` redirects to `/login` before
// any child route renders, so a child page never has to re-check auth itself.
import type { ReactNode } from "react";
import { Button } from "@caisson/ui/components";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireDashboardSession } from "@/lib/auth";

// Never statically cached — a tenant's dashboard must not be served from a shared cache (no
// cross-tenant leak). `force-dynamic` also forces every child route dynamic.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireDashboardSession("/dashboard");

  const topBar = (
    <form action="/api/auth/sign-out" method="post" style={{ margin: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <span
          className="cs-muted"
          style={{
            fontSize: "var(--cs-text-xs)",
            fontFamily: "var(--cs-font-mono)",
          }}
        >
          {session.accountId}
        </span>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </div>
    </form>
  );

  return <DashboardShell topBar={topBar}>{children}</DashboardShell>;
}
