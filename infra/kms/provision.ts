#!/usr/bin/env bun
/**
 * Caisson field-crypto KMS live-proof provisioner (ADR-0221, executes the KMS-1/KMS-2 locks).
 *
 * PRINT-ONLY (KMS-2=B2): this script makes NO AWS call and creates NO persistent resource. Unlike the
 * WORM provisioner (which creates a long-lived Object-Lock bucket), the KMS live proof self-provisions
 * its own throwaway CMKs per run and lets AWS's 7-day pending-deletion window reap them — so there is
 * nothing to provision here except the IAM authorization, which is emitted for the operator to attach.
 *
 * KMS-1=A1 — ONE shared "live-proof prover" principal: the statements below are ADDED to the EXISTING
 * WORM prover's policy (infra/worm/provision.ts printProverPolicy), not a second credential. Each
 * statement is tag-scoped least-privilege (aws:RequestTag / kms:ResourceTag on the Purpose tag), so
 * the broader-but-still-scoped surface never touches a real tenant CMK. Prover creds stay separate
 * from product creds (ADR-0201).
 *
 * No persistent production default CMK is created (KMS-2=B2): a real per-customer CMK is a
 * first-customer concern, so readiness-and-backlog's `Field KMS (alt)` row stays open by design.
 *
 * Usage: bun infra/kms/provision.ts   (no env, no creds — it only prints)
 * Not product code — an operational one-shot (infra/ is outside the package gates).
 */

/** The one tag every proof CMK carries; the whole prover policy is conditioned on it. */
const PURPOSE = "caisson-field-crypto-live-proof";

/** The tag-scoped ABAC statements to ADD to the shared WORM live-proof prover principal (KMS-1=A1). */
function proverPolicyStatements(): readonly unknown[] {
  return [
    {
      Sid: "KmsProofCreate",
      Effect: "Allow",
      // The key ARN does not exist yet at CreateKey time — authorize on the REQUEST tag instead.
      Action: ["kms:CreateKey", "kms:TagResource"],
      Resource: "*",
      Condition: {
        StringEquals: { "aws:RequestTag/Purpose": PURPOSE },
      },
    },
    {
      Sid: "KmsProofOps",
      Effect: "Allow",
      // Subsequent ops target existing keys — condition on the RESOURCE tag (AWS's documented
      // tag-authorization pattern). Scoped to keys the prover itself tagged with Purpose.
      // CreateAlias/DeleteAlias are NOT here (CAISSON-14) — see KmsProofAlias below: aliases
      // cannot carry tags, so kms:ResourceTag/Purpose can never match an alias resource and would
      // silently deny every CreateAlias call the live proof makes.
      Action: [
        "kms:GenerateDataKey",
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion",
      ],
      Resource: "*",
      Condition: {
        StringEquals: { "kms:ResourceTag/Purpose": PURPOSE },
      },
    },
    {
      // CAISSON-14 fix: aliases are untaggable, so CreateAlias/DeleteAlias get their own statement
      // scoped by alias-NAME prefix instead of kms:ResourceTag. The key leg of each call (the CMK
      // the alias points at) is still narrowed by the existing ResourceTag/Purpose condition — AWS
      // evaluates the condition per applicable resource, so the alias leg is bounded by its ARN
      // pattern below and the key leg by the tag condition.
      Sid: "KmsProofAlias",
      Effect: "Allow",
      Action: ["kms:CreateAlias", "kms:DeleteAlias"],
      Resource: [`arn:aws:kms:*:*:alias/${PURPOSE}-*`, "arn:aws:kms:*:*:key/*"],
      Condition: {
        StringEquals: { "kms:ResourceTag/Purpose": PURPOSE },
      },
    },
  ];
}

function printProverPolicy(): void {
  const policy = { Version: "2012-10-17", Statement: proverPolicyStatements() };
  console.log(
    "\nKMS live-proof IAM statements (KMS-1=A1 — ADD these to the EXISTING WORM live-proof prover\n" +
      "principal alongside its S3 statements; do NOT mint a second credential — ADR-0221):",
  );
  console.log(JSON.stringify(policy, null, 2));
}

printProverPolicy();
console.log(
  `\ndone (print-only; no AWS call, no persistent resource — KMS-2=B2).\n` +
    `live proof: CAISSON_KMS_LIVE=1 AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… ` +
    `bun run --cwd packages/field-crypto test:live`,
);
