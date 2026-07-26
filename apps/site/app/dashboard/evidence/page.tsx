import type { Metadata } from "next";
import type { SessionContext } from "@caisson/auth";
import type { RateDecision } from "@caisson/rate-limit";
import { z } from "zod";
import {
  TenantEvidenceDashboard,
  type TenantEvidenceDashboardProps,
} from "@/components/tenant-evidence-dashboard";
import { requireDashboardSession } from "@/lib/auth";
import {
  TenantEvidenceProxyError,
  type LatestEvidencePackResponse,
  type TenantProofResponse,
} from "@/lib/tenant-evidence";
import {
  assertTenantEvidenceScope,
  tenantEvidenceProxyFromEnv,
} from "@/lib/tenant-evidence-runtime";
import { checkTenantEvidenceRateLimit } from "@/lib/tenant-evidence-rate-limit";

export const metadata: Metadata = { title: "Audit evidence" };

const PATH = "/dashboard/evidence";
const seqSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));

function unavailableMessage(
  error: unknown,
  absentMessage: string,
  unavailableMessage: string,
): string {
  if (error instanceof TenantEvidenceProxyError && error.kind === "not-found") {
    return absentMessage;
  }
  return unavailableMessage;
}

export interface DashboardEvidenceDependencies {
  readonly getSession: (path: string) => Promise<SessionContext>;
  readonly checkRateLimit: (
    accountId: string,
  ) => RateDecision | Promise<RateDecision>;
  readonly assertTenantScope: (accountId: string) => Promise<void>;
  readonly getProxy: typeof tenantEvidenceProxyFromEnv;
}

const dashboardEvidenceDependencies: DashboardEvidenceDependencies = {
  getSession: requireDashboardSession,
  checkRateLimit: checkTenantEvidenceRateLimit,
  assertTenantScope: assertTenantEvidenceScope,
  getProxy: tenantEvidenceProxyFromEnv,
};

export async function loadDashboardEvidencePage(
  searchParams: Promise<{ seq?: string | string[] }>,
  deps: DashboardEvidenceDependencies = dashboardEvidenceDependencies,
): Promise<TenantEvidenceDashboardProps> {
  const session = await deps.getSession(PATH);
  const rate = await deps.checkRateLimit(session.accountId);
  if (!rate.allowed) {
    return {
      proofError: "The row proof is temporarily rate limited.",
      latestPackError: "The evidence pack is temporarily rate limited.",
    };
  }

  try {
    await deps.assertTenantScope(session.accountId);
  } catch {
    return {
      proofError: "The row proof is unavailable.",
      latestPackError: "The evidence pack is unavailable.",
    };
  }

  let proxy;
  try {
    proxy = deps.getProxy();
  } catch {
    return {
      proofError: "The row proof service is unavailable.",
      latestPackError: "The evidence-pack service is unavailable.",
    };
  }

  let latestPack: LatestEvidencePackResponse | undefined;
  let latestPackError: string | undefined;
  try {
    latestPack = await proxy.getLatestEvidencePack(session.accountId);
  } catch (error) {
    latestPackError = unavailableMessage(
      error,
      "No persisted evidence pack is available.",
      "The latest evidence pack is unavailable.",
    );
  }

  const { seq: rawSeq } = await searchParams;
  let proof: TenantProofResponse | undefined;
  let proofSeq: number | undefined;
  let proofError: string | undefined;
  if (rawSeq !== undefined) {
    const parsedSeq = seqSchema.safeParse(rawSeq);
    if (!parsedSeq.success) {
      proofError = "Enter a non-negative integer row sequence.";
    } else {
      proofSeq = parsedSeq.data;
      try {
        proof = await proxy.getProof(session.accountId, proofSeq);
      } catch (error) {
        proofError = unavailableMessage(
          error,
          "No proof exists for that row.",
          "The row proof is unavailable.",
        );
      }
    }
  }

  return {
    ...(proof === undefined ? {} : { proof }),
    ...(proofSeq === undefined ? {} : { proofSeq }),
    ...(proofError === undefined ? {} : { proofError }),
    ...(latestPack === undefined ? {} : { latestPack }),
    ...(latestPackError === undefined ? {} : { latestPackError }),
  };
}

export default async function DashboardEvidencePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ seq?: string | string[] }>;
}) {
  return (
    <TenantEvidenceDashboard
      {...await loadDashboardEvidencePage(searchParams)}
    />
  );
}
