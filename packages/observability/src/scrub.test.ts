import { describe, expect, test } from "bun:test";
import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import * as semconv from "@opentelemetry/semantic-conventions/incubating";
import {
  isSensitiveAttributeKey,
  ScrubbingSpanProcessor,
  scrubAttributes,
  scrubPath,
  SENSITIVE_ATTRIBUTE_KEY,
} from "./scrub.ts";

describe("scrubAttributes", () => {
  test("redacts secret/auth/cookie/token/key-shaped keys", () => {
    const attrs: Record<string, unknown> = {
      "http.request.header.authorization": "Bearer abc.def.ghi",
      "http.request.header.cookie": "session=xyz",
      "http.request.header.x-api-key": "sk-live-1234",
      apiKey: "sk-live-1234",
      access_key: "AKIA...",
      privateKey: "-----BEGIN KEY-----",
      sessionId: "s-1",
      password: "hunter2",
      "user.email": "user@example.com",
      "user.phone": "555-0100",
    };
    scrubAttributes(attrs);
    for (const key of Object.keys(attrs)) {
      expect(attrs[key]).toBe("[REDACTED]");
    }
  });

  test("leaves benign operational attributes untouched", () => {
    const attrs: Record<string, unknown> = {
      "http.method": "GET",
      "http.status_code": 200,
      "http.route": "/query",
      "net.peer.name": "caisson.sh",
      "db.system": "postgresql",
    };
    const before = { ...attrs };
    scrubAttributes(attrs);
    expect(attrs).toEqual(before);
  });

  test("redacts a raw bearer-shaped VALUE even under a non-suspicious key", () => {
    const attrs: Record<string, unknown> = {
      "custom.header": "Bearer some-opaque-token",
    };
    scrubAttributes(attrs);
    expect(attrs["custom.header"]).toBe("[REDACTED]");
  });

  test("non-string values matching no sensitive key pass through unchanged", () => {
    const attrs: Record<string, unknown> = { "retry.count": 3, ok: true };
    scrubAttributes(attrs);
    expect(attrs).toEqual({ "retry.count": 3, ok: true });
  });
});

// Regression: ADR-0117 / audit finding 19d1af0e70d0c2d7. The deny-list's word-anchored PII terms
// (\bemail\b, \bphone\b, \bssn\b, \bdob\b) only ever saw a boundary because every existing test
// above used DOT-separated OTel-convention keys ("user.email") — `.` is a non-word char, so `\b`
// matches. Application code that names a span attribute `userEmail` or `user_email` (both word
// chars either side of the term) silently reached the external OTLP sink unredacted. These cases
// are the mutation check: revert splitKeyWords/isSensitiveAttributeKey and every key below goes red.
describe("isSensitiveAttributeKey — camelCase / snake_case PII boundaries", () => {
  const MUST_REDACT = [
    "userEmail",
    "user_email",
    "emailAddress",
    "email_address",
    "EmailAddress",
    "phoneNumber",
    "customerSsn",
    "userDob",
    "userDOB",
    "firstName",
    "last_name",
    "fullName",
    "dateOfBirth",
    "birthDate",
    "patientMrn",
  ];
  for (const key of MUST_REDACT) {
    test(`redacts ${key}`, () => {
      expect(isSensitiveAttributeKey(key)).toBe(true);
    });
  }

  // The anchors stay load-bearing: an UNanchored `dob` matches inside `adobe`, `mrn` inside `mrna`.
  // If a future "fix" drops the anchors instead of normalizing the key, these go red.
  const MUST_NOT_REDACT = [
    "adobeVersion",
    "dobro",
    "mrnaSequence",
    "userId",
    "requestId",
    "statusCode",
    "durationMs",
    "httpMethod",
    "serviceName",
    "retryCount",
  ];
  for (const key of MUST_NOT_REDACT) {
    test(`leaves ${key} alone`, () => {
      expect(isSensitiveAttributeKey(key)).toBe(false);
    });
  }

  // Widening must be monotone — every key the old raw regex caught must still be caught.
  test("does not regress any secret/credential key shape", () => {
    for (const key of [
      "apiKey",
      "api_key",
      "apikey",
      "x-api-key",
      "sessionId",
      "authorization",
      "Authorization",
      "accessToken",
      "userSecret",
      "cookieJar",
      "privateKey",
      "signingKey",
      "encryptionKey",
      "bearerToken",
      "credentialStore",
      "password",
      "passwd",
      "bearer",
      "socialSecurityNumber",
      "social_security_number",
      "patientId",
    ]) {
      expect(isSensitiveAttributeKey(key)).toBe(true);
    }
  });

  test("scrubAttributes actually drops a camelCase PII attribute end to end", () => {
    const attrs: Record<string, unknown> = {
      userEmail: "user@example.com",
      customerSsn: "123-45-6789",
      phoneNumber: "555-0100",
      requestId: "req-1",
    };
    scrubAttributes(attrs);
    expect(attrs.userEmail).toBe("[REDACTED]");
    expect(attrs.customerSsn).toBe("[REDACTED]");
    expect(attrs.phoneNumber).toBe("[REDACTED]");
    expect(attrs.requestId).toBe("req-1");
  });
});

// Second-round hardening (security audit of PR #449). Each block below is one class the first fix
// did not cover, plus the ReDoS the first fix introduced. Numbers are measured, not asserted from
// the fixture: see outputs/audit/2026-08-25-false-close-19d1af0e.md for the full probe sets.
describe("isSensitiveAttributeKey — plural / numbered / fused / unicode forms", () => {
  const MUST_REDACT = [
    "emails",
    "userEmails",
    "phones",
    "ssns",
    "userDobs",
    "mrns",
    "email2",
    "phone2",
    "ssn1",
    "dob2",
    "Email2Address",
    "USEREMAIL2",
    "useremail",
    "emailaddress",
    "phonenumber",
    "homephone",
    "custemail",
    "myssn", // fused lowercase, ssn at the END — the one-side anchor catches it
    "userssn",
    "SSNVALUE", // fused, ssn at the START
    "CUSTOMEREMAIL",
    "eMailAddress",
    "\uff45mail", // fullwidth ｅ — NFKC folds it to `email`
    "\uff41piKey", // fullwidth ａ on a SECRET term — NFKC must run on the raw arm too
    "e-mail", // re-verification round: the separator-inside-the-word spellings
    "E-Mail",
    "e.mail",
    "e_mail",
    "E_MAIL",
    "medical-record-number", // spelled-out mrn
    "medicalRecordNumber",
  ];
  for (const key of MUST_REDACT) {
    test(`redacts ${JSON.stringify(key)}`, () => {
      expect(isSensitiveAttributeKey(key)).toBe(true);
    });
  }

  // `ssn` is guarded on ONE side only: a mid-word `ssN` is an ordinary English cluster.
  // `patient`/`*Name` are guarded so `outpatient`/`lastNameserver` survive. These are the keys a
  // fully unanchored deny-list would falsely drop.
  const MUST_NOT_REDACT = [
    "className",
    "classNames",
    "businessName",
    "businessNumber",
    "processName",
    "lessness",
    "lastNameserver",
    "impatientRetries",
    "outpatientVisits",
    "endobar",
    "description",
  ];
  for (const key of MUST_NOT_REDACT) {
    test(`leaves ${key} alone`, () => {
      expect(isSensitiveAttributeKey(key)).toBe(false);
    });
  }

  // Every OTel semantic-convention attribute a request/db/rpc span carries must survive, or the
  // scrub blinds tracing. `*.address` is the reason `address` is NOT in the deny-list.
  test("never redacts an OTel semconv attribute name", () => {
    for (const key of [
      "net.peer.address",
      "net.peer.name",
      "http.client_ip",
      "http.route",
      "http.method",
      "http.status_code",
      "db.name",
      "db.system",
      "db.statement",
      "host.name",
      "url.full",
      "enduser.id",
      "k8s.pod.name",
      "messaging.destination.name",
      "aws.lambda.invoked_arn",
      "service.name",
      "rpc.method",
      "server.address",
      "client.address",
      "user_agent.original",
      "process.runtime.name",
      "code.namespace",
      "code.function",
      "exception.type",
    ]) {
      expect(isSensitiveAttributeKey(key)).toBe(false);
    }
  });

  // The camelCase splitter must stay linear. `([A-Z]+)([A-Z][a-z])` backtracks quadratically on a
  // long all-caps key (~3.4 s at this size); `([A-Z])` runs in ~20 ms. An attribute NAME is
  // attacker-reachable from any instrumented request, so this is a DoS on the export path.
  test("a 64k-char all-caps key scrubs in linear time", () => {
    const key = "A".repeat(64_000);
    const started = Bun.nanoseconds();
    isSensitiveAttributeKey(key);
    const elapsedMs = (Bun.nanoseconds() - started) / 1e6;
    expect(elapsedMs).toBeLessThan(500);
  });
});

// The credential terms (`token`, `session`, `authoriz`, `password`, `secret`) sit
// inside real OTel attribute names, so the scrub blanked LLM usage and session correlation on
// every span. An EXACT semconv name skips the credential arm only — the PII arm is unconditional,
// because `user.email` and `user.full_name` are semconv names too. The census below is the full
// set the package exports (read at test time, never hand-copied), so a version bump that adds a
// name the deny-list catches fails here instead of silently blanking a new attribute.
describe("isSensitiveAttributeKey — OTel semconv exemption", () => {
  const ALL_SEMCONV = [
    ...new Set(
      Object.entries(semconv as Record<string, unknown>)
        .filter(
          (entry): entry is [string, string] =>
            entry[0].startsWith("ATTR_") && typeof entry[1] === "string",
        )
        .map(([, name]) => name),
    ),
  ].sort();

  // Literal on purpose: the expectation must be anchored to something the implementation cannot
  // move. If the pinned semconv version grows a new PII-shaped name, this list is the review gate.
  const PII_SEMCONV = ["user.email", "user.full_name"];

  // The 19 names that only a credential term catches — none carries a credential.
  const CREDENTIAL_TERM_SEMCONV = [
    "aspnetcore.authorization.policy",
    "aspnetcore.authorization.result",
    "aspnetcore.identity.password_check_result",
    "aspnetcore.identity.token_purpose",
    "aspnetcore.identity.token_verified",
    "aws.secretsmanager.secret.arn",
    "gen_ai.request.max_tokens",
    "gen_ai.token.type",
    "gen_ai.usage.cache_creation.input_tokens",
    "gen_ai.usage.cache_read.input_tokens",
    "gen_ai.usage.completion_tokens",
    "gen_ai.usage.input_tokens",
    "gen_ai.usage.output_tokens",
    "gen_ai.usage.prompt_tokens",
    "gen_ai.usage.reasoning.output_tokens",
    "mcp.session.id",
    "process.session_leader.pid",
    "session.id",
    "session.previous_id",
  ];

  test("the census is the package's full exported name set", () => {
    expect(ALL_SEMCONV.length).toBeGreaterThanOrEqual(889);
    for (const name of [...PII_SEMCONV, ...CREDENTIAL_TERM_SEMCONV]) {
      expect(ALL_SEMCONV).toContain(name);
    }
  });

  test("exactly the PII-class semconv names redact; every other exported name survives", () => {
    expect(ALL_SEMCONV.filter(isSensitiveAttributeKey)).toEqual(PII_SEMCONV);
  });

  for (const name of CREDENTIAL_TERM_SEMCONV) {
    test(`passes ${name}`, () => {
      expect(isSensitiveAttributeKey(name)).toBe(false);
    });
  }

  // Negative guard: the exemption must never reach the PII arm.
  for (const name of PII_SEMCONV) {
    test(`still redacts ${name}`, () => {
      expect(isSensitiveAttributeKey(name)).toBe(true);
    });
  }

  // Negative guard: exact-match only. A case variant, a plausible-but-unexported dotted name, or
  // the `http.request.header.<key>` template (exported as a function, so never a member) all go
  // through the credential arm unchanged.
  for (const key of [
    "Session.Id",
    "SESSION.ID",
    "session.token",
    "session.cookie",
    "gen_ai.api_key",
    "gen_ai.usage.input_tokens.secret",
    "mcp.session.authorization",
    "http.request.header.authorization",
    "http.request.header.cookie",
    "http.response.header.set-cookie",
    "sessionId",
    "session_id",
    "accessToken",
  ]) {
    test(`exemption is exact-match only: ${key} still redacts`, () => {
      expect(isSensitiveAttributeKey(key)).toBe(true);
    });
  }

  // The deprecated union regex and the two arms must stay term-for-term identical: over the whole
  // census, the raw regex flags exactly the redacted set plus the exempted set — nothing else.
  test("the raw SENSITIVE_ATTRIBUTE_KEY still equals credential arm + PII arm over the census", () => {
    const rawHits = ALL_SEMCONV.filter(
      (name) =>
        SENSITIVE_ATTRIBUTE_KEY.test(name) ||
        SENSITIVE_ATTRIBUTE_KEY.test(name.replace(/[_-]/g, " ")),
    );
    expect(rawHits).toEqual(
      [...PII_SEMCONV, ...CREDENTIAL_TERM_SEMCONV].sort(),
    );
  });

  test("scrubAttributes keeps LLM usage and drops user.email on the same span", () => {
    const attrs: Record<string, unknown> = {
      "gen_ai.usage.input_tokens": 1200,
      "gen_ai.usage.output_tokens": 350,
      "session.id": "sess-01",
      "mcp.session.id": "mcp-01",
      "user.email": "user@example.com",
      "http.request.header.authorization": "Bearer abc",
    };
    scrubAttributes(attrs);
    expect(attrs["gen_ai.usage.input_tokens"]).toBe(1200);
    expect(attrs["gen_ai.usage.output_tokens"]).toBe(350);
    expect(attrs["session.id"]).toBe("sess-01");
    expect(attrs["mcp.session.id"]).toBe("mcp-01");
    expect(attrs["user.email"]).toBe("[REDACTED]");
    expect(attrs["http.request.header.authorization"]).toBe("[REDACTED]");
  });
});

describe("scrubPath", () => {
  test("redacts a UUID segment", () => {
    expect(scrubPath("/users/3fa85f64-5717-4562-b3fc-2c963f66afa6")).toBe(
      "/users/:id",
    );
  });

  test("redacts an email segment", () => {
    expect(scrubPath("/accounts/user@example.com/profile")).toBe(
      "/accounts/:id/profile",
    );
  });

  test("redacts a long hex/base64-ish token segment", () => {
    expect(scrubPath("/verify/a1b2c3d4e5f6a7b8c9d0")).toBe("/verify/:id");
  });

  test("redacts a pure-numeric id segment", () => {
    expect(scrubPath("/orders/48291")).toBe("/orders/:id");
  });

  test("leaves a clean static path unchanged", () => {
    expect(scrubPath("/api/users/list")).toBe("/api/users/list");
  });

  test("the email shape: a dot is needed after the first domain character", () => {
    expect(scrubPath("/u/a@b.c.d")).toBe("/u/:id");
    expect(scrubPath("/u/a@.b.c")).toBe("/u/:id");
    expect(scrubPath("/u/a@..c")).toBe("/u/:id");
    expect(scrubPath("/u/a@.c")).toBe("/u/a@.c");
    expect(scrubPath("/u/a@b.")).toBe("/u/a@b.");
    expect(scrubPath("/u/a@b.c@d")).toBe("/u/a@b.c@d");
    expect(scrubPath("/u/@b.c")).toBe("/u/@b.c");
  });

  test("a near-miss email segment is scanned in linear time", () => {
    // Tens of seconds when the pattern retries at every one of the 200,000 dots.
    const path = `/u/!@${"!.".repeat(200_000)}@`;
    const started = performance.now();
    expect(scrubPath(path)).toBe(path);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

/** A minimal `SpanProcessor` double that records every span handed to `onEnd`. */
function createRecordingProcessor(): SpanProcessor & {
  ended: ReadableSpan[];
} {
  const ended: ReadableSpan[] = [];
  return {
    ended,
    onStart(_span: Span, _parentContext: Context): void {},
    onEnd(span: ReadableSpan): void {
      ended.push(span);
    },
    forceFlush(): Promise<void> {
      return Promise.resolve();
    },
    shutdown(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function fakeReadableSpan(attributes: Record<string, unknown>): ReadableSpan {
  return { attributes } as unknown as ReadableSpan;
}

describe("ScrubbingSpanProcessor", () => {
  test("scrubs attributes before forwarding onEnd to the wrapped processor", () => {
    const next = createRecordingProcessor();
    const processor = new ScrubbingSpanProcessor(next);
    const span = fakeReadableSpan({ authorization: "secret-value", ok: 1 });

    processor.onEnd(span);

    expect(next.ended).toHaveLength(1);
    expect(next.ended[0]?.attributes).toEqual({
      authorization: "[REDACTED]",
      ok: 1,
    });
  });

  test("delegates forceFlush and shutdown to the wrapped processor", async () => {
    let flushed = false;
    let shutdown = false;
    const next: SpanProcessor = {
      onStart(): void {},
      onEnd(): void {},
      forceFlush(): Promise<void> {
        flushed = true;
        return Promise.resolve();
      },
      shutdown(): Promise<void> {
        shutdown = true;
        return Promise.resolve();
      },
    };
    const processor = new ScrubbingSpanProcessor(next);

    await processor.forceFlush();
    await processor.shutdown();

    expect(flushed).toBe(true);
    expect(shutdown).toBe(true);
  });
});
