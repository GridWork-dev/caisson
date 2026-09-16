import { Boundary, Flow, Sheet, SNode, TitleBlock } from "./schematics";
import styles from "./schematics.module.css";

// Guard-surface blueprint sheets (ADR-0377, executing ADR-0378 lock 1 migrate-all). Same hairline
// blueprint-linework register as FieldCryptoSheet / AuditWormSheet in ./schematics.tsx: every
// name is verbatim from the package it depicts, drawn subsets are declared on-sheet where a
// package exposes more than is drawn, and each sheet carries exactly ONE semantic accent element
// (the Boundary — the fail-closed gate the sheet is about). These four replace the legacy
// marketplace-diagrams.tsx mechanism diagrams for the same packages (ToolExecGate, PrivacyGate,
// OrgControlsMutation, RetentionErasure).

// ===== module:tool-exec — the default-deny allowlist gate before execFile spawns anything =====
// Names from src/tool-exec.ts: run(name, args, reason?) looks the name up in the registry (a
// Map<name, CommandSpec> built from ToolExecConfig.allowlist) — an unregistered name throws
// NotFoundError. The matched CommandSpec's argsSchema validates args via parseStrict BEFORE
// anything spawns — a bad shape throws ValidationError. Only then does execFile(command, argv)
// run — never execSync, never shell:true, the validated args ARE the argv array. propose()/
// execute() (ADR-0360 S3) split that same lookup+validate from the actual spawn: propose() parks
// a digest-bound ToolApproval backed by a private record (ADR-0423); execute() consumes it once,
// checks current policy, revalidates the original input, and checks the resulting argv digest.
export function ToolExecSheet() {
  return (
    <Sheet
      title="tool-exec: a default-deny allowlist validates argv against a Zod-strict schema before execFile ever spawns it, and propose/execute splits that validation from the actual spawn"
      bar="packages/tool-exec · allowlist gate, execFile argv, propose/execute"
    >
      <SNode x={8} y={10} w={92} h={26} head="run(name, args)" sub="reason?" />
      <Flow x1={100} y1={23} x2={114} y2={23} />
      <SNode
        x={114}
        y={10}
        w={100}
        h={26}
        head="registry.get"
        sub="CommandSpec"
      />
      <Flow x1={214} y1={23} x2={228} y2={23} />
      <SNode
        x={228}
        y={10}
        w={104}
        h={26}
        head="parseStrict"
        sub="argsSchema"
      />
      <text x={8} y={48} className={styles.noteDanger}>
        no entry ⇒ NotFoundError
      </text>
      <text x={8} y={58} className={styles.noteDanger}>
        bad shape ⇒ ValidationError
      </text>
      {/* the ONE accent element: the actual spawn gate */}
      <Flow x1={280} y1={36} x2={280} y2={66} />
      <Boundary x={148} y={66} w={182} h={48} label="execFile · argv array" />
      <SNode
        x={164}
        y={84}
        w={150}
        h={24}
        head="execFile(cmd, argv)"
        sub="never a shell"
      />
      <text x={8} y={130} className={styles.note}>
        never execSync or shell:true, argv only
      </text>
      <SNode x={8} y={138} w={78} h={26} head="propose()" sub="validate only" />
      <Flow x1={86} y1={151} x2={100} y2={151} />
      <SNode
        x={100}
        y={136}
        w={134}
        h={30}
        head="ToolApproval"
        sub="digest · stored"
      />
      <Flow x1={234} y1={151} x2={248} y2={151} />
      <SNode x={248} y={138} w={80} h={26} head="execute()" sub="revalidates" />
      <TitleBlock x={198} y={168} w={130} text="TOOL-EXEC · 1/1" />
    </Sheet>
  );
}

// ===== module:local-privacy — the default-deny egress gate, fail-closed to offline =====
// Names from src/egress-guard.ts + src/policy.ts: EgressGuard.assertAllowed(url) is the one check
// every outbound request crosses before fetch()/fetchAs() ever reaches fetchWithTimeout — the
// kernel's single audited outbound chokepoint. It fails closed on a non-https scheme (AuthzError)
// and on a host absent from the PrivacyPolicy allowlist (AuthzError; an empty allowlist means the
// branch always fires, so zero egress is the default, not a config choice). assertAllowedFor(url,
// kind) adds purpose-binding: a host must be allowlisted for one of the two closed
// SANCTIONED_SINK_KINDS specifically, so a key sanctioned for one sink can never reach the other.
export function LocalPrivacySheet() {
  return (
    <Sheet
      title="local-privacy: assertAllowed enforces https and an allowlisted host before any request crosses fetchWithTimeout; an empty allowlist blocks every host by construction"
      bar="packages/local-privacy · egress-guard, allowlist, sanctioned sinks"
    >
      <SNode
        x={8}
        y={10}
        w={110}
        h={26}
        head="fetch(url, init)"
        sub="or fetchAs(kind)"
      />
      <Flow x1={118} y1={23} x2={132} y2={23} />
      {/* the ONE accent element: the egress gate itself */}
      <Boundary x={132} y={8} w={196} h={54} label="assertAllowed(url)" />
      <SNode x={144} y={26} w={80} h={22} head="https: only" />
      <SNode x={232} y={26} w={88} h={22} head="host allowlisted" />
      <Flow x1={230} y1={62} x2={230} y2={98} />
      <text x={8} y={76} className={styles.noteDanger}>
        non-https ⇒ AuthzError
      </text>
      <text x={8} y={86} className={styles.noteDanger}>
        host not allowlisted ⇒ AuthzError
      </text>
      <SNode
        x={150}
        y={98}
        w={180}
        h={24}
        head="fetchWithTimeout"
        sub="the ONE outbound seam"
      />
      <text x={8} y={134} className={styles.note}>
        empty allowlist ⇒ zero egress, no fallback
      </text>
      <SNode
        x={8}
        y={140}
        w={150}
        h={24}
        head="model-fetch"
        sub="ONNX host, hash-pinned"
      />
      <SNode
        x={166}
        y={140}
        w={160}
        h={24}
        head="rented-backend"
        sub="opt-in, off by default"
      />
      <TitleBlock x={190} y={168} w={140} text="LOCAL-PRIVACY · 1/1" />
    </Sheet>
  );
}

// ===== module:org-controls — the owner-gated cross-tenant write role, plus WorkOS SSO =====
// Names from src/admin-write.ts + src/workos.ts + src/membership.ts: assertCanManageMembers
// throws AuthzError unless the caller's role is "owner". withAdminWrite opens a transaction and
// SET LOCAL ROLE admin_write for its life, but only after a fail-closed pre-flight refuses a
// SUPERUSER or BYPASSRLS role (the same class of bug FORCE ROW LEVEL SECURITY guards against).
// The role's own RLS policy (buildAdminWritePolicySql) is `TO admin_write USING (true) WITH CHECK
// (true)`, granting SELECT/INSERT/UPDATE only, never DELETE — the mutation surface soft-revokes.
// createWorkosSsoProvider's authorizationUrl/exchangeCode drive the sign-in half of SSO only.
export function OrgControlsSheet() {
  return (
    <Sheet
      title="org-controls: assertCanManageMembers gates every seat mutation on the caller's role; withAdminWrite crosses into a role-scoped RLS policy only after a SUPERUSER or BYPASSRLS role is refused"
      bar="packages/org-controls · admin-write RLS, role guard, WorkOS SSO"
    >
      <SNode
        x={8}
        y={10}
        w={132}
        h={26}
        head="assertCanManageMembers"
        sub="role === owner?"
      />
      <Flow x1={140} y1={23} x2={154} y2={23} />
      {/* the ONE accent element: the cross-tenant write role gate */}
      <Boundary x={154} y={8} w={176} h={58} label="withAdminWrite(db, fn)" />
      <SNode
        x={166}
        y={24}
        w={152}
        h={24}
        head="SET LOCAL ROLE"
        sub="admin_write"
      />
      <text x={8} y={48} className={styles.noteDanger}>
        not owner ⇒ AuthzError
      </text>
      <text x={8} y={76} className={styles.noteDanger}>
        SUPERUSER / BYPASSRLS ⇒ refused
      </text>
      <Flow x1={242} y1={66} x2={242} y2={90} />
      <SNode
        x={158}
        y={90}
        w={168}
        h={24}
        head="TO admin_write"
        sub="USING(true) WITH CHECK(true)"
      />
      <text x={8} y={128} className={styles.note}>
        GRANT SELECT/INSERT/UPDATE, no DELETE
      </text>
      <SNode
        x={8}
        y={136}
        w={104}
        h={26}
        head="authorizationUrl"
        sub="AuthKit / connection"
      />
      <Flow x1={112} y1={149} x2={126} y2={149} />
      <SNode
        x={126}
        y={136}
        w={100}
        h={26}
        head="exchangeCode"
        sub="POST /sso/token"
      />
      <Flow x1={226} y1={149} x2={240} y2={149} />
      <SNode
        x={240}
        y={134}
        w={88}
        h={30}
        head="WorkosSsoProfile"
        sub="userId · email"
      />
      <TitleBlock x={198} y={168} w={132} text="ORG-CONTROLS · 1/1" />
    </Sheet>
  );
}

// ===== module:retention-runner — per-target error isolation, one reason-tagged audit row =====
// Names from src/run-erasure.ts + src/types.ts + src/targets.ts: runErasure validates the request
// with parseStrict(erasureRequestSchema) before anything runs (an unknown field or an
// unrecognized reason throws ValidationError). eraseOne (drawn as the boundary's caption) wraps
// each target.erase() call in a try/catch, so one target's throw lands in its own TargetResult
// rather than aborting the run or the sibling targets. The three reference targets are drawn
// exactly as named: object-storage-purge, cascade-db-delete, orphan-record-sweep. sink.record(row)
// then writes exactly one row, tagged with one of the three closed ERASURE_REASONS.
export function RetentionRunnerSheet() {
  return (
    <Sheet
      title="retention-runner: runErasure fans a validated request out to every registered target with per-target error isolation, a throw is caught, not propagated, then writes exactly one reason-tagged audit row"
      bar="packages/retention-runner · runErasure, target isolation, audit sink"
    >
      <SNode
        x={8}
        y={12}
        w={160}
        h={26}
        head="runErasure(req)"
        sub="parseStrict · strict req"
      />
      <text x={8} y={50} className={styles.noteDanger}>
        unknown field / bad reason ⇒ ValidationError
      </text>
      <Flow x1={88} y1={38} x2={88} y2={64} />
      {/* the ONE accent element: per-target error isolation */}
      <Boundary
        x={8}
        y={64}
        w={324}
        h={58}
        label="eraseOne · a throw is caught, not thrown"
      />
      <SNode x={18} y={82} w={100} h={26} head="object-storage-purge" />
      <SNode
        x={126}
        y={82}
        w={100}
        h={26}
        head="cascade-db-delete"
        sub="a throw lands here"
      />
      <SNode x={234} y={82} w={90} h={26} head="orphan-record-sweep" />
      <Flow x1={170} y1={122} x2={170} y2={138} />
      <SNode
        x={92}
        y={138}
        w={156}
        h={28}
        head="sink.record(row)"
        sub="auto_90d · ccpa_request · operator_manual"
      />
      <TitleBlock x={198} y={168} w={132} text="RETENTION-RUNNER · 1/1" />
    </Sheet>
  );
}
