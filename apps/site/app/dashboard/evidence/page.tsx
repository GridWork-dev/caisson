import type { Metadata } from "next";
import { z } from "zod";
import { TenantEvidenceDashboard } from "@/components/tenant-evidence-dashboard";
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

export default async function DashboardEvidencePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ seq?: string | string[] }>;
}) {
  const session = await requireDashboardSession(PATH);
  try {
    await assertTenantEvidenceScope(session.accountId);
  } catch {
    return (
      <TenantEvidenceDashboard
        proofError="The row proof is unavailable."
        latestPackError="The evidence pack is unavailable."
      />
    );
  }

  let proxy;
  try {
    proxy = tenantEvidenceProxyFromEnv();
  } catch {
    return (
      <TenantEvidenceDashboard
        proofError="The row proof service is unavailable."
        latestPackError="The evidence-pack service is unavailable."
      />
    );
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

  return (
    <TenantEvidenceDashboard
      {...(proof === undefined ? {} : { proof })}
      {...(proofSeq === undefined ? {} : { proofSeq })}
      {...(proofError === undefined ? {} : { proofError })}
      {...(latestPack === undefined ? {} : { latestPack })}
      {...(latestPackError === undefined ? {} : { latestPackError })}
    />
  );
}
