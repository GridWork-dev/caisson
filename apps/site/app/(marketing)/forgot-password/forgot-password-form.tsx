"use client";

// Requests a password-reset email (better-auth `requestPasswordReset`). Always shows the same
// success message whether or not the address has an account — an enumeration-safe response,
// matching better-auth's own silent no-op for an unknown email.
import { useState } from "react";
import { Button } from "@caisson/ui/components";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/auth-config";

type Status = "idle" | "sending" | "sent" | "error";

export function ForgotPasswordForm(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    setMessage("");
    await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset-password",
    });
    setStatus("sent");
    setMessage(
      `If ${parsed.data.email} has a password account, a reset link is on its way.`,
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: "var(--cs-space-3)", maxWidth: "24rem" }}
    >
      <label
        htmlFor="forgot-email"
        className="cs-muted"
        style={{ fontSize: "var(--cs-text-sm)" }}
      >
        Email
      </label>
      <input
        id="forgot-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        disabled={status === "sending" || status === "sent"}
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
        disabled={status === "sending" || status === "sent"}
      >
        {status === "sending" ? "Sending…" : "Send reset link"}
      </Button>
      {message !== "" ? (
        <p
          className="cs-muted"
          role={status === "error" ? "alert" : "status"}
          style={{ fontSize: "var(--cs-text-sm)", margin: 0 }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
