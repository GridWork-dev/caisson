// Stage 4's PORT and its two node-clean pieces: the `AlertChannel` interface, the isolation
// wrapper `deliverAll` relies on, and the in-memory capture driver. Carved out of `channels.ts`
// (ADR-0396) so `orchestrator.ts` can reach `deliverAll` without value-importing the five NETWORK
// drivers, which pull `node:crypto` (webhook HMAC) and `@caisson-sh/kernel/node` (the DNS-resolving
// SSRF re-check). Nothing here fetches, hashes, or resolves a hostname — that is the whole point.
// Every name below is still exported from `.` exactly as before; `channels.ts` imports what it
// needs from here, so there is one implementation of the isolation rule, not two.
import type { AlertEvent } from "./types.ts";

export interface DeliveryResult {
  channel: string;
  ok: boolean;
  error?: string;
}

/** The port: one method, transport-agnostic, the only seam `deliverAll` depends on. */
export interface AlertChannel {
  name: string;
  deliver(event: AlertEvent): Promise<DeliveryResult>;
}

/** Shared by every driver's own catch — a message, never a stack. */
export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Runs `channel.deliver`, catching any throw/rejection into a failed `DeliveryResult` — the
 * isolation boundary `deliverAll` relies on regardless of whether a driver self-catches. */
async function attemptDeliver(
  channel: AlertChannel,
  event: AlertEvent,
): Promise<DeliveryResult> {
  try {
    return await channel.deliver(event);
  } catch (err) {
    return { channel: channel.name, ok: false, error: toErrorMessage(err) };
  }
}

/** Delivers `event` to every channel; one failing channel never prevents the rest from running. */
export async function deliverAll(
  event: AlertEvent,
  channels: readonly AlertChannel[],
): Promise<DeliveryResult[]> {
  return Promise.all(channels.map((channel) => attemptDeliver(channel, event)));
}

/** A test driver that records every delivered event in memory; never touches the network. */
export interface CaptureChannel extends AlertChannel {
  readonly delivered: readonly AlertEvent[];
}

export function createCaptureChannel(name = "capture"): CaptureChannel {
  const delivered: AlertEvent[] = [];
  return {
    name,
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      delivered.push(event);
      return { channel: name, ok: true };
    },
    get delivered(): readonly AlertEvent[] {
      return delivered;
    },
  };
}
