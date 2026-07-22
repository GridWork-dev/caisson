"use client";

// Submits the new password against the one-time token (better-auth `resetPassword`). The token
// is passed down from the page (which reads it server-side from `?token=` and only renders this
// form when a token is present) — this component never has to represent a "missing token" state
// itself, so the page's messaging and the form's are never in conflict.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@caisson/ui/components";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/auth-config";

type Status = "idle" | "sending" | "done" | "error";

export function ResetPasswordForm({
  token,
}: {
  token: string;
}): React.ReactElement {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, newPassword });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setStatus("sending");
    setMessage("");
    const { error } = await authClient.resetPassword(parsed.data);
    if (error) {
      setStatus("error");
      setMessage(
        "That reset link is invalid or has expired. Request a new one.",
      );
      return;
    }
    setStatus("done");
    setMessage("Password updated. You can sign in now.");
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: "var(--cs-space-3)", maxWidth: "24rem" }}
    >
      <label
        htmlFor="reset-new-password"
        className="cs-muted"
        style={{ fontSize: "var(--cs-text-sm)" }}
      >
        New password
      </label>
      <input
        id="reset-new-password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="••••••••"
        disabled={status === "sending" || status === "done"}
        style={{
          padding: "var(--cs-space-3)",
          borderRadius: "var(--cs-radius-md)",
          border: "1px solid var(--cs-border)",
          background: "var(--cs-surface-1)",
          color: "var(--cs-fg)",
          fontSize: "var(--cs-text-base)",
        }}
      />
      <Button
        type="submit"
        variant="primary"
        disabled={status === "sending" || status === "done"}
      >
        {status === "sending" ? "Updating…" : "Update password"}
      </Button>
      {message !== "" ? (
        <p
          className={status === "error" ? "cs-footnote" : "cs-muted"}
          role={status === "error" ? "alert" : "status"}
          style={{
            fontSize: "var(--cs-text-sm)",
            margin: 0,
            color: status === "error" ? "var(--cs-danger)" : undefined,
          }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
