/**
 * Module golden-fixture contract (ADR-0021 §golden). This track defines what a *module's* golden
 * fixture IS; it does NOT redefine the test runner or the bless procedure — those are the shared
 * harness owned by the foundations track (ADR-0013). The ADR-0013 harness consumes these
 * descriptors; the standards gate (ADR-0021/0022) runs them at publish and blocks on a diff.
 *
 * A module's golden fixture = the serialized, DETERMINISTIC output the module produces for a
 * fixed input — e.g. a generated file set, an evidence-pack manifest, a composed config. It is
 * committed under the module's `golden` dir (ADR-0020 manifest field) and re-blessed via the
 * ADR-0013 bless procedure when the output legitimately changes.
 */

/** One golden case: a fixed input, the deterministic output, and where the golden is stored. */
export interface ModuleGoldenCase<I = unknown> {
  /** Stable case name (becomes the golden file/dir stem). */
  name: string;
  /** The fixed input — must be serializable + deterministic (no clocks, no randomness, no env). */
  input: I;
  /** Produce the output to compare against the committed golden. Must be pure for a given input. */
  produce: (input: I) => unknown | Promise<unknown>;
}

/** A module's full golden suite — what the manifest `golden` dir holds. */
export interface ModuleGolden {
  /** The module id this suite belongs to (matches the manifest `id`). */
  module: string;
  /** Dir holding the committed golden artifacts (relative to the module root). */
  goldenDir: string;
  cases: ModuleGoldenCase[];
}

/**
 * Declare a module's golden suite. The ADR-0013 harness imports the result, runs each `produce`,
 * and diffs against `goldenDir`; `bun run gate` (ADR-0022) fails the publish on any diff.
 * Determinism is the module author's contract — the helper only shapes the descriptor.
 */
export function defineModuleGolden(suite: ModuleGolden): ModuleGolden {
  if (!suite.cases.length) {
    throw new Error(
      `module golden suite for ${suite.module} has no cases (ADR-0020 golden-first)`,
    );
  }
  return suite;
}
