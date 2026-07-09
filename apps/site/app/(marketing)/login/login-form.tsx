"use client";

// The buyer sign-in form (client). Magic-link email is the PRIMARY path; a password mode is
// offered alongside it (sign in / create account); OAuth buttons render only for providers the
// server reported as configured (`providers` prop — never a button for an unconfigured
// provider). Deliberately minimal — a copy/design polish pass follows separately. Every field is
// validated through the shared `.strict()` boundary schemas before any call, so the same bound
// the server trusts is enforced at the edge too.
import { useState } from "react";
import Link from "next/link";
import { Button } from "@caisson/ui/components";
import { trackEvent } from "@/lib/analytics";
import { authClient } from "@/lib/auth-client";
import {
  type OAuthProviderId,
  magicLinkRequestSchema,
  passwordSignInSchema,
  passwordSignUpSchema,
} from "@/lib/auth-config";
import { encodeSignupIntentCookie } from "@/lib/signup-intent";

// Docs-funnel signup signal (ADR-0254 gap #12, Option C). There is no server-side "is this a
// new account" signal available at the client for the magic-link/OAuth flows (better-auth
// treats them as sign-in-or-create uniformly) — so intent is read from the same
// create-account toggle the UI already shows the visitor (`passwordMode === "signup"`), which
// applies uniformly across all three actions below since it's shared component state, not
// scoped to the password form alone. Cookie codec + full rationale: `@/lib/signup-intent`.
function setSignupIntentCookie(
  signupSource: string | undefined,
  plausibleAlreadyFired: boolean,
): void {
  document.cookie = encodeSignupIntentCookie(
    signupSource,
    plausibleAlreadyFired,
  );
}

const PROVIDER_LABEL: Record<OAuthProviderId, string> = {
  github: "Continue with GitHub",
  google: "Continue with Google",
  discord: "Continue with Discord",
};

const fieldStyle: React.CSSProperties = {
  padding: "var(--cs-space-3)",
  borderRadius: "var(--cs-radius-md)",
  border: "1px solid var(--cs-border)",
  background: "var(--cs-surface-1)",
  color: "var(--cs-fg)",
  fontSize: "var(--cs-text-base)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--cs-text-sm)",
};

type Status = "idle" | "sending" | "sent" | "error";
type Mode = "magiclink" | "password";
type PasswordMode = "signin" | "signup";

export function LoginForm({
  providers,
  next,
  signupSource,
}: {
  providers: OAuthProviderId[];
  next: string;
  signupSource?: string | undefined;
}): React.ReactElement {
  const [mode, setMode] = useState<Mode>("magiclink");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // Guard the redirect target: only a root-relative in-app path is ever followed after sign-in.
  const callbackURL =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  async function onMagicLinkSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = magicLinkRequestSchema.safeParse({ email, callbackURL });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    setMessage("");
    // Magic link is sign-in-or-create uniformly — mark signup intent only when the visitor has
    // told us so via the create-account toggle (see the file-header comment on the ceiling
    // this accepts). Plausible's `signup_complete` fires later, at the dashboard landing.
    if (passwordMode === "signup") {
      setSignupIntentCookie(signupSource, false);
    }
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

  async function onPasswordSignIn(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = passwordSignInSchema.safeParse({
      email,
      password,
      callbackURL,
    });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Enter a valid email and password.");
      return;
    }
    setStatus("sending");
    setMessage("");
    const { error } = await authClient.signIn.email(parsed.data);
    if (error) {
      setStatus("error");
      setMessage(
        error.status === 403
          ? "Verify your email before signing in — check your inbox."
          : "Incorrect email or password.",
      );
      return;
    }
    setStatus("sent");
    setMessage("Signed in.");
  }

  async function onPasswordSignUp(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = passwordSignUpSchema.safeParse({
      name,
      email,
      password,
      callbackURL,
    });
    if (!parsed.success) {
      setStatus("error");
      setMessage(
        "Enter your name, a valid email, and an 8+ character password.",
      );
      return;
    }
    setStatus("sending");
    setMessage("");
    const { error } = await authClient.signUp.email(parsed.data);
    if (error) {
      setStatus("error");
      setMessage("Could not create that account. Try again.");
      return;
    }
    // Definite signup — fire Plausible's `signup_complete` right here (there's no immediate
    // dashboard landing for the password flow; it requires an email-verify round trip first).
    // `plausibleAlreadyFired: true` tells the eventual dashboard-landing read (post-verify) to
    // skip re-firing it and only capture PostHog's `account_created`.
    trackEvent("signup_complete", { source: "password" });
    setSignupIntentCookie(signupSource, true);
    setStatus("sent");
    setMessage(
      `Check ${parsed.data.email} to verify your account before signing in.`,
    );
  }

  async function onSocial(provider: OAuthProviderId): Promise<void> {
    // Same intent-toggle signal as magic link — OAuth has no separate signup/signin button set.
    if (passwordMode === "signup") {
      setSignupIntentCookie(signupSource, false);
    }
    await authClient.signIn.social({ provider, callbackURL });
  }

  const busy = status === "sending" || status === "sent";

  return (
    <div
      style={{ display: "grid", gap: "var(--cs-space-6)", maxWidth: "24rem" }}
    >
      {mode === "magiclink" ? (
        <form
          onSubmit={onMagicLinkSubmit}
          style={{ display: "grid", gap: "var(--cs-space-3)" }}
        >
          <label htmlFor="login-email" className="cs-muted" style={labelStyle}>
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
            disabled={busy}
            style={fieldStyle}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {status === "sending" ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={
            passwordMode === "signin" ? onPasswordSignIn : onPasswordSignUp
          }
          style={{ display: "grid", gap: "var(--cs-space-3)" }}
        >
          {passwordMode === "signup" ? (
            <>
              <label
                htmlFor="login-name"
                className="cs-muted"
                style={labelStyle}
              >
                Name
              </label>
              <input
                id="login-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                disabled={busy}
                style={fieldStyle}
              />
            </>
          ) : null}
          <label
            htmlFor="login-pw-email"
            className="cs-muted"
            style={labelStyle}
          >
            Email
          </label>
          <input
            id="login-pw-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={busy}
            style={fieldStyle}
          />
          <label
            htmlFor="login-password"
            className="cs-muted"
            style={labelStyle}
          >
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={
              passwordMode === "signin" ? "current-password" : "new-password"
            }
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={busy}
            style={fieldStyle}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {status === "sending"
              ? "Please wait…"
              : passwordMode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--cs-text-xs)",
            }}
          >
            <button
              type="button"
              className="cs-muted"
              onClick={() => {
                setStatus("idle");
                setMessage("");
                setPasswordMode(
                  passwordMode === "signin" ? "signup" : "signin",
                );
              }}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {passwordMode === "signin"
                ? "New here? Create an account"
                : "Have an account? Sign in"}
            </button>
            {passwordMode === "signin" ? (
              <Link href="/forgot-password" className="cs-muted">
                Forgot password?
              </Link>
            ) : null}
          </div>
        </form>
      )}

      {message !== "" ? (
        // An error must read as visually distinct from a success/info message — previously both
        // used the identical muted style, so an invalid-submit error (e.g. wrong password) never
        // registered as an error to the eye (CAISSON-69). Mirrors plan-purchase-row.tsx's error
        // treatment: cs-footnote + the danger token; success/info stay muted.
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

      <button
        type="button"
        className="cs-muted"
        onClick={() => {
          setStatus("idle");
          setMessage("");
          setMode(mode === "magiclink" ? "password" : "magiclink");
        }}
        style={{
          background: "none",
          border: 0,
          cursor: "pointer",
          padding: 0,
          fontSize: "var(--cs-text-xs)",
          textAlign: "center",
        }}
      >
        {mode === "magiclink"
          ? "Prefer a password? Sign in with email + password"
          : "Prefer a link? Sign in with a magic link"}
      </button>

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
