"use client";

// The local-store module's `component` media slide (ADR-0308 full-depth) — the module's own shipped
// surface `@caisson-sh/local-store/ui` <StoreSearch>, rendered live over sample RRF-ranked hits. The
// surface is controlled (the host owns the query); here it's a still-frame — a fixed query with a
// no-op change handler and static results, so nothing pulls interactive state. Loaded via
// next/dynamic (ssr: false) so this commercial-tier tree never lands in the shared client bundle.
// Source: packages/local-store/src/ui/store-search.tsx.
import {
  StoreSearch,
  type StoreSearchResult,
} from "@caisson-sh/local-store/ui";

import { MediaFrame } from "./media-frame";

const QUERY = "fail-closed rls policy";

// score = the fused Reciprocal-Rank-Fusion rank the host would supply, descending.
const RESULTS: readonly StoreSearchResult[] = [
  {
    id: "doc:rls-deny-default",
    text: "A query that never set the tenant context returns zero rows, never everything.",
    score: 0.0182,
  },
  {
    id: "doc:policy-compose",
    text: "Row-level policies compose per table; any single deny wins over an allow.",
    score: 0.0161,
  },
  {
    id: "doc:tenant-guard",
    text: "The tenant guard sets app.current_tenant before every scoped read runs.",
    score: 0.014,
  },
];

export default function LocalStoreDemo() {
  return (
    <MediaFrame label="Hybrid search">
      <div style={{ padding: "var(--cs-space-6)" }}>
        <StoreSearch
          query={QUERY}
          onQueryChange={() => {}}
          results={RESULTS}
          total={1284}
        />
      </div>
    </MediaFrame>
  );
}
