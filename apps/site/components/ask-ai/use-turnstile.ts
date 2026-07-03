"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloudflare Turnstile client hook for the Ask-AI widget (ADR-0234 F5). Env-gated on the PUBLIC site
// key; the server verify (lib/ask-ai/turnstile.ts) is fail-CLOSED on TURNSTILE_SECRET, so the two halves
// arm together at DEPLOY. Unlike the waitlist form (a single submit), the widget asks repeatedly and
// Turnstile tokens are single-use — so getToken() hands out the current token, then resets the widget to
// pre-solve a fresh one for the next question. TURNSTILE_SECRET stays server-only; only the site key is
// public. When unset (dev / CI / not-yet-provisioned) getToken resolves undefined and the server bypasses.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const TURNSTILE_API_JS =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileHandle {
  /** True when a site key is configured → the caller renders <Script> + the container div. */
  readonly enabled: boolean;
  /** Container for the (invisible/managed) widget. */
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  /** Wire to the Turnstile <Script>'s onLoad. */
  readonly onScriptLoad: () => void;
  /**
   * Resolve a fresh single-use token, waiting for the managed challenge to solve if needed (≤8s), then
   * resetting the widget so the next call gets a new token. Resolves undefined when unconfigured (dev)
   * or if the challenge does not solve in time — the request proceeds and the server decides (fail-closed
   * in prod, bypass in dev).
   */
  readonly getToken: () => Promise<string | undefined>;
}

export function useTurnstile(): TurnstileHandle {
  const enabled = SITE_KEY !== undefined && SITE_KEY.length > 0;
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string>("");
  const waitersRef = useRef<Array<(token: string) => void>>([]);

  const onScriptLoad = useCallback(() => setLoaded(true), []);

  // A sibling mount (docs widget + ⌘K tab can coexist) may have already loaded api.js — next/script
  // dedupes the tag but only the first instance's onLoad fires, so detect the global directly too.
  useEffect(() => {
    if (enabled && !loaded && window.turnstile !== undefined) setLoaded(true);
  }, [enabled, loaded]);

  // Render the widget once the script + container are ready. Invisible/managed → typically no visible UI.
  useEffect(() => {
    if (
      !enabled ||
      !loaded ||
      containerRef.current === null ||
      window.turnstile === undefined ||
      widgetIdRef.current !== null
    ) {
      return;
    }
    const settle = (token: string): void => {
      tokenRef.current = token;
      const waiters = waitersRef.current;
      waitersRef.current = [];
      for (const resolve of waiters) resolve(token);
    };
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY as string,
      callback: settle,
      "error-callback": () => {
        tokenRef.current = "";
      },
      "expired-callback": () => {
        tokenRef.current = "";
      },
      theme: "auto",
      size: "flexible",
    });
    return () => {
      if (widgetIdRef.current !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [enabled, loaded]);

  const consume = useCallback((token: string): string => {
    tokenRef.current = "";
    // Reset to pre-solve a fresh single-use token for the next question.
    if (widgetIdRef.current !== null && window.turnstile !== undefined) {
      window.turnstile.reset(widgetIdRef.current);
    }
    return token;
  }, []);

  const getToken = useCallback((): Promise<string | undefined> => {
    if (!enabled) return Promise.resolve(undefined);
    if (tokenRef.current.length > 0)
      return Promise.resolve(consume(tokenRef.current));
    return new Promise<string | undefined>((resolve) => {
      const waiter = (token: string): void => {
        clearTimeout(timer);
        resolve(consume(token));
      };
      const timer = setTimeout(() => {
        waitersRef.current = waitersRef.current.filter((w) => w !== waiter);
        resolve(undefined);
      }, 8000);
      waitersRef.current.push(waiter);
    });
  }, [enabled, consume]);

  return { enabled, containerRef, onScriptLoad, getToken };
}
