"use client";

// The GitHub sign-in trigger (ADR-0283). `signIn.social` is a core better-auth client method — no
// plugin required, unlike the buyer site's magic-link flow. The allowlist check happens
// server-side (databaseHooks at account-creation, the session recheck on every later request) —
// this button has no client-side awareness of who is or isn't authorized.
import { useState } from "react";
import { Button } from "@caisson/ui/components";
import { adminAuthClient } from "@/lib/admin-auth-client";

export function LoginButton({ next }: { next: string }): React.ReactElement {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  async function onSignIn(): Promise<void> {
    setStatus("pending");
    const { error } = await adminAuthClient.signIn.social({
      provider: "github",
      callbackURL: next,
    });
    if (error) setStatus("error");
  }

  return (
    <div className="stack" style={{ gap: "var(--cs-space-3)" }}>
      <Button
        type="button"
        variant="primary"
        disabled={status === "pending"}
        onClick={() => void onSignIn()}
      >
        {status === "pending" ? "Redirecting…" : "Continue with GitHub"}
      </Button>
      {status === "error" ? (
        <p
          className="muted"
          role="alert"
          style={{ fontSize: "var(--cs-text-sm)" }}
        >
          Could not start GitHub sign-in. Try again.
        </p>
      ) : null}
    </div>
  );
}
