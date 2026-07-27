/** A publication-grade primary source plus its optional report-only mechanical watch. */
export interface RegulatorySource {
  label: string;
  url: string;
  /** Article number, section, page, or other specific source locator — never a bare domain. */
  locator: string;
  /**
   * Human-facing precision always lives in `locator`; this only records what an unauthenticated
   * weekly fetch can honestly inspect.
   */
  watch?:
    | { mode: "text"; texts: readonly string[] }
    | {
        mode: "digest";
        algorithm: "sha256";
        digest: string;
        reason: string;
      }
    | { mode: "reachable"; reason: string };
}
