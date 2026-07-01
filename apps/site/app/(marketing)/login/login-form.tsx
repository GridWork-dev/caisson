"use client";

// The buyer sign-in form (client). Magic-link email is the PRIMARY path; OAuth buttons render
// only for providers the server reported as configured (`providers` prop — never a button for an
// unconfigured provider). Deliberately minimal — a copy/design polish pass follows separately.
// The email is validated through the shared `.strict()` boundary schema before any call, so the
// same bound the server trusts is enforced at the edge too.
import { useState } from "react";
import { Button } from "@caisson/ui/components";
import { authClient } from "@/lib/auth-client";
import {
  type OAuthProviderId,
  magicLinkRequestSchema,
} from "@/lib/auth-config";

const PROVIDER_LABEL: Record<OAuthProviderId, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
};

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({
  providers,
  next,
}: {
  providers: OAuthProviderId[];
  next: string;
}): React.ReactElement {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // Guard the redirect target: only a root-relative in-app path is ever followed after sign-in.
  const callbackURL =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = magicLinkRequestSchema.safeParse({ email, callbackURL });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    setMessage("");
    const { error } = await authClient.signIn.magicLink({
      email: parsed.data.email,
      callbackURL,
    });
    if (error) {
      setStatus("error");
      setMessage("Could not send the sign-in link. Try again.");
      return;
    }
    setStatus("sent");
    setMessage(`Check ${parsed.data.email} for your sign-in link.`);
  }

  async function onSocial(provider: OAuthProviderId): Promise<void> {
    await authClient.signIn.social({ provider, callbackURL });
  }

  return (
    <div
      style={{ display: "grid", gap: "var(--cs-space-6)", maxWidth: "24rem" }}
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: "var(--cs-space-3)" }}
      >
        <label
          htmlFor="login-email"
          className="cs-muted"
          style={{ fontSize: "var(--cs-text-sm)" }}
        >
          Email
        </label>
        <input
          id="login-email"
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
            background: "var(--cs-surface)",
            color: "var(--cs-fg)",
            fontSize: "var(--cs-text-base)",
          }}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={status === "sending" || status === "sent"}
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>
      </form>

      {message !== "" ? (
        <p
          className="cs-muted"
          role={status === "error" ? "alert" : "status"}
          style={{ fontSize: "var(--cs-text-sm)", margin: 0 }}
        >
          {message}
        </p>
      ) : null}

      {providers.length > 0 ? (
        <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
          <span
            className="cs-muted"
            style={{ fontSize: "var(--cs-text-xs)", textAlign: "center" }}
          >
            or
          </span>
          {providers.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="ghost"
              onClick={() => {
                void onSocial(provider);
              }}
            >
              {PROVIDER_LABEL[provider]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
