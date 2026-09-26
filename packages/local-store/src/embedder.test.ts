// Unit tests for the Embedder port seam (ADR-0067). Engine-neutral + offline: the embedder is a
// TEST-DOUBLE here (no live cloud call in CI). Proves the FTS5 floor (`undefined` ⇒ no vector) and
// the fail-closed dimension contract (a wrong-width vector throws, never corrupts the index).
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { assertEmbeddingDim, embedOrSkip, type Embedder } from "./embedder.ts";

/** A deterministic test-double embedder — returns a fixed-width vector, never a network call. */
function stubEmbedder(dim: number, fill = 0.5): Embedder {
  return { dim, embed: () => Promise.resolve(new Array(dim).fill(fill)) };
}

/** A misbehaving double that returns the wrong width — exercises the fail-closed guard. */
function wrongWidthEmbedder(declaredDim: number, actualDim: number): Embedder {
  return {
    dim: declaredDim,
    embed: () => Promise.resolve(new Array(actualDim).fill(0)),
  };
}

describe("Embedder port (ADR-0067)", () => {
  test("no embedder configured ⇒ undefined (the FTS5-only floor)", async () => {
    expect(await embedOrSkip(undefined, "any text")).toBeUndefined();
  });

  test("a configured embedder ⇒ a dim-correct vector", async () => {
    const vector = await embedOrSkip(stubEmbedder(3), "hello");
    expect(vector).toEqual([0.5, 0.5, 0.5]);
  });

  test("a wrong-width embedding throws (fail-closed, flag-never-guess)", async () => {
    await expect(
      embedOrSkip(wrongWidthEmbedder(3, 2), "hello"),
    ).rejects.toThrow(ValidationError);
  });

  test("assertEmbeddingDim throws on mismatch and passes on a match", () => {
    expect(() => assertEmbeddingDim(3, [1, 0])).toThrow(ValidationError);
    expect(() => assertEmbeddingDim(3, [1, 0, 0])).not.toThrow();
  });
});
