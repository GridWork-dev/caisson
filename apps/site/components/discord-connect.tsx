"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@caisson/ui/components";

import { authClient } from "@/lib/auth-client";

/**
 * The dashboard's Discord seam (ADR-0201). Unlinked: a Connect button → better-auth `linkSocial`
 * (OAuth redirect; the callback returns to the plan page with `?discord=linked`). Linked: a
 * "Sync roles" button POSTing `/api/discord/backfill` — the same call the `?discord=linked`
 * return fires automatically, so buy-then-link converges without a manual step. Rendered only
 * when the server says the discord provider is configured (env-gated, inert otherwise).
 */
export function DiscordConnect({ linked }: { linked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const autoSynced = useRef(false);

  async function backfill(): Promise<void> {
    setBusy(true);
    try {
      // Same-origin authed POST; 10s guard (the fetchWithTimeout rule, inlined — importing the
      // kernel helper into a client bundle would drag server-only modules across the boundary).
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 10_000);
      try {
        await fetch("/api/discord/backfill", {
          method: "POST",
          signal: controller.signal,
        });
        setSynced(true);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Best-effort sync — the button stays available to retry.
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Auto-backfill exactly once when returning from the OAuth link redirect.
    if (!linked || autoSynced.current) return;
    if (
      new URLSearchParams(window.location.search).get("discord") !== "linked"
    ) {
      return;
    }
    autoSynced.current = true;
    void backfill();
  }, [linked]);

  if (linked) {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => void backfill()}
      >
        {busy ? "Syncing…" : synced ? "Roles synced" : "Sync Discord roles"}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void authClient.linkSocial({
          provider: "discord",
          callbackURL: "/dashboard/plan?discord=linked",
        });
      }}
    >
      {busy ? "Redirecting…" : "Connect Discord"}
    </Button>
  );
}
