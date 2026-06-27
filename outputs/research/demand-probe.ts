/**
 * Phase 2 demand probe — reuses prospector's DataForSEO adapter (operator intent:
 * "use prospector research stuff"). PROSPECTOR_RUN unset => echo-only, no writes into
 * the read-only prospector repo. Pulls hard revealed-demand data for the broad
 * productized-template / framework / starter-kit market + each moat direction.
 * Output: demand-data.json in WORKDIR.
 */
import {
  searchVolumeCpc,
  keywordDifficulty,
  serpComposition,
  keywordIdeas,
  googleTrends,
} from "/home/gw/lab/prospector/tools/adapters/dataforseo.ts";

const KEYWORDS = {
  generic_template_market: [
    "saas boilerplate",
    "saas starter kit",
    "nextjs boilerplate",
    "nextjs starter kit",
    "react boilerplate",
    "saas template",
    "full stack boilerplate",
    "saas starter",
    "micro saas boilerplate",
    "supabase starter kit",
    "stripe saas boilerplate",
    "t3 stack boilerplate",
    "indie hacker boilerplate",
    "web app boilerplate",
    "shipfast",
    "makerkit",
    "saas kit",
  ],
  compliance_moat: [
    "compliance software",
    "compliance saas",
    "audit trail software",
    "regulatory compliance software",
    "gdpr compliance tool",
    "hipaa compliant software",
    "soc 2 compliance software",
    "compliance automation software",
    "multi tenant saas",
    "audit log software",
    "legal document automation",
    "regtech",
    "document management compliance",
    "policy management software",
    "compliance management system",
  ],
  local_first_ai_moat: [
    "local first software",
    "on device ai",
    "local ai app",
    "offline ai",
    "private ai",
    "local llm app",
    "edge ai",
    "on device machine learning",
    "local first ai",
    "privacy first ai",
    "self hosted ai",
  ],
  ai_feature_add_moat: [
    "ai feature integration",
    "add ai to app",
    "llm integration",
    "rag pipeline",
    "ai agent framework",
    "ai saas template",
    "ai wrapper",
    "ai pipeline",
    "ai chatbot saas boilerplate",
    "openai api boilerplate",
    "vector search",
  ],
  business_model: [
    "saas lifetime deal",
    "code template marketplace",
    "developer tools subscription",
    "usage based pricing saas",
    "ai credits pricing",
  ],
  agent_os_devtools: [
    "claude code",
    "ai coding agent",
    "developer productivity tools",
    "code generation tool",
    "ai agent boilerplate",
  ],
};

const ALL = [...new Set(Object.values(KEYWORDS).flat())];

const SERP_HEADS = [
  "saas boilerplate",
  "nextjs boilerplate",
  "saas starter kit",
  "compliance software",
  "local first software",
  "on device ai",
  "ai saas template",
  "ai agent framework",
  "audit trail software",
  "multi tenant saas",
  "react boilerplate",
  "compliance saas",
];

const IDEA_SEEDS = [
  "saas boilerplate",
  "compliance software",
  "local first ai",
  "ai starter kit",
];

const TREND_HEADS = [
  "saas boilerplate",
  "local first software",
  "on device ai",
  "ai agent",
];

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | { _error: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[ERR] ${label}: ${(e as Error).message}`);
    return { _error: (e as Error).message };
  }
}

const out: Record<string, unknown> = {
  generated: "2026-06-27",
  keyword_buckets: KEYWORDS,
};
let totalCost = 0;

// 1. Search volume + CPC + competition (one batched task for all keywords)
const vol = await safe("searchVolumeCpc", () => searchVolumeCpc(ALL));
if (!("_error" in vol)) {
  out.volume_cpc = vol.items;
  totalCost += vol.costUsd;
} else out.volume_cpc = vol;

// 2. Keyword difficulty (one bulk task)
const kd = await safe("keywordDifficulty", () => keywordDifficulty(ALL));
if (!("_error" in kd)) {
  out.keyword_difficulty = kd.items;
  totalCost += kd.costUsd;
} else out.keyword_difficulty = kd;

// 3. SERP composition for head terms (who ranks = competitors)
const serps: unknown[] = [];
for (const k of SERP_HEADS) {
  const s = await safe(`serp:${k}`, () => serpComposition(k, { depth: 15 }));
  if (!("_error" in s)) {
    serps.push({
      keyword: k,
      totalResults: s.totalResults,
      top: s.organic.slice(0, 10),
      features: s.serpFeatureTypes,
    });
    totalCost += s.costUsd;
  } else serps.push({ keyword: k, ...s });
}
out.serp_composition = serps;

// 4. Keyword ideas (demand-first adjacent niches, relaxed filters for breadth)
const ideas: unknown[] = [];
for (const seed of IDEA_SEEDS) {
  const i = await safe(`ideas:${seed}`, () =>
    keywordIdeas([seed], {
      limit: 200,
      minVolume: 100,
      minCpc: 0,
      maxVolume: 1_000_000,
      maxKd: 100,
    }),
  );
  if (!("_error" in i)) {
    ideas.push({
      seed,
      count: i.items.length,
      items: i.items
        .sort(
          (a, b) =>
            b.cpcUsd * Math.log10(b.volume + 10) -
            a.cpcUsd * Math.log10(a.volume + 10),
        )
        .slice(0, 40),
    });
    totalCost += i.costUsd;
  } else ideas.push({ seed, ...i });
}
out.keyword_ideas = ideas;

// 5. Google Trends direction
const tr = await safe("googleTrends", () =>
  googleTrends(TREND_HEADS, { timeRange: "past_5_years" }),
);
if (!("_error" in tr)) {
  out.trends = tr.raw;
  totalCost += tr.costUsd;
} else out.trends = tr;

out.total_cost_usd = Number(totalCost.toFixed(4));
await Bun.write(
  "/home/gw/lab/library-research/demand-data.json",
  JSON.stringify(out, null, 2),
);
console.error(
  `\n[TOTAL] demand probe cost: $${totalCost.toFixed(4)} -> demand-data.json`,
);
console.log(
  `DONE. cost=$${totalCost.toFixed(4)} keywords=${ALL.length} serp=${SERP_HEADS.length} ideas=${IDEA_SEEDS.length}`,
);
