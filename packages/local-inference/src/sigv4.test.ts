// Unit tests for the hand-rolled SigV4 signer (ADR-0209). The derivation is pinned against the
// DOCUMENTED AWS test vectors — the worked IAM ListUsers example (fixed date 20150830T123600Z,
// region us-east-1, service iam, credentials AKIDEXAMPLE / wJalrXUtnFEMI/K7MDENG+bPx…) and the
// signing-key derivation example (20120215/us-east-1/iam) — so signature correctness is proven
// independent of any live AWS call. Every pinned hex constant below was additionally re-derived
// out-of-band with openssl's HMAC chain before being committed (2026-07-02).
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { deriveSigningKey, signSigV4 } from "./sigv4.ts";

/** The documented AWS example credentials (public test constants, not secrets). */
const ACCESS_KEY_ID = "AKIDEXAMPLE";
const SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";

describe("deriveSigningKey — the documented AWS derivation vector", () => {
  test("20120215 / us-east-1 / iam derives the documented kSigning", () => {
    const key = deriveSigningKey(
      SECRET_ACCESS_KEY,
      "20120215",
      "us-east-1",
      "iam",
    );
    expect(key.toString("hex")).toBe(
      "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
    );
  });
});

describe("signSigV4 — the documented IAM ListUsers example (20150830T123600Z)", () => {
  // GET https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08 with content-type + host +
  // x-amz-date signed. The docs example does NOT sign x-amz-content-sha256, so the header is
  // switched off to reproduce the vector byte-for-byte (the payload hash still terminates the
  // canonical request).
  const result = signSigV4(
    {
      method: "GET",
      url: new URL(
        "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
      ),
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: "",
      region: "us-east-1",
      service: "iam",
      date: new Date("2015-08-30T12:36:00Z"),
      includeBodyHashHeader: false,
    },
    { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  );

  test("canonical request matches the documented block exactly", () => {
    expect(result.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "Action=ListUsers&Version=2010-05-08",
        "content-type:application/x-www-form-urlencoded; charset=utf-8",
        "host:iam.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "content-type;host;x-amz-date",
        // Hex(SHA256("")) — the empty payload hash.
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
    expect(
      createHash("sha256")
        .update(result.canonicalRequest, "utf8")
        .digest("hex"),
    ).toBe("f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59");
  });

  test("string to sign matches the documented block exactly", () => {
    expect(result.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20150830T123600Z",
        "20150830/us-east-1/iam/aws4_request",
        "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59",
      ].join("\n"),
    );
  });

  test("signature and Authorization header match the documented values", () => {
    expect(result.signature).toBe(
      "5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
    expect(result.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
        "SignedHeaders=content-type;host;x-amz-date, " +
        "Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
    );
    expect(result.headers["x-amz-date"]).toBe("20150830T123600Z");
    // The vector omits the body-hash header; the signer must not sneak it in.
    expect(result.headers["x-amz-content-sha256"]).toBeUndefined();
  });
});

describe("signSigV4 — the Bedrock posture (defaults)", () => {
  const url = new URL(
    "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.titan-embed-text-v2%3A0/invoke",
  );
  const body = JSON.stringify({ inputText: "hello" });
  const date = new Date("2026-07-02T00:00:00Z");

  test("x-amz-content-sha256 is attached, signed, and equals SHA256(body) by default", () => {
    const result = signSigV4(
      {
        method: "POST",
        url,
        headers: { "content-type": "application/json" },
        body,
        region: "us-east-1",
        service: "bedrock",
        date,
      },
      { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    );
    const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
    expect(result.headers["x-amz-content-sha256"]).toBe(bodyHash);
    expect(result.headers.authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date,",
    );
    expect(result.headers.authorization).toContain(
      `Credential=${ACCESS_KEY_ID}/20260702/us-east-1/bedrock/aws4_request,`,
    );
  });

  test("the canonical path is double-URI-encoded (the non-S3 rule: %3A → %253A)", () => {
    const result = signSigV4(
      {
        method: "POST",
        url,
        body,
        region: "us-east-1",
        service: "bedrock",
        date,
      },
      { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    );
    const canonicalPath = result.canonicalRequest.split("\n")[1];
    expect(canonicalPath).toBe(
      "/model/amazon.titan-embed-text-v2%253A0/invoke",
    );
  });

  test("an STS session token is attached AND signed (x-amz-security-token)", () => {
    const result = signSigV4(
      {
        method: "POST",
        url,
        body,
        region: "us-east-1",
        service: "bedrock",
        date,
      },
      {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
        sessionToken: "session-token-value",
      },
    );
    expect(result.headers["x-amz-security-token"]).toBe("session-token-value");
    expect(result.headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,",
    );
  });
});
