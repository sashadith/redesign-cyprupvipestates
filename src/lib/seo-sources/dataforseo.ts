import type { SeoSourceAdapter, SeoSourceStatus } from "./types";

// Future provider: DataForSEO (rank tracking + keyword volume + competitor
// gap data — the Advisor layer's likely source for "who else ranks for this
// keyword and where" questions GSC itself can't answer). FOUNDATION ONLY —
// typed interface + config check, no API calls implemented. Env vars are
// named now so a future implementer doesn't have to invent the convention:
//   DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD (HTTP Basic Auth, per DataForSEO's
//   own API docs) — unset in every environment today, on purpose.

export type KeywordRanking = {
  keyword: string;
  locale: string;
  position: number | null;
  searchVolume: number | null;
  checkedAt: Date;
};

export type CompetitorGap = {
  keyword: string;
  ourPosition: number | null;
  competitorDomain: string;
  competitorPosition: number | null;
};

export interface DataForSeoAdapter extends SeoSourceAdapter {
  getKeywordRankings(params: { keywords: string[]; locale: string }): Promise<KeywordRanking[]>;
  getCompetitorGaps(params: { domain: string; competitors: string[] }): Promise<CompetitorGap[]>;
}

function isConfigured(): boolean {
  return !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD;
}

function getStatus(): SeoSourceStatus {
  return isConfigured() ? { configured: true } : { configured: false, reason: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set" };
}

function notImplemented(): never {
  throw new Error("dataforseo adapter is a foundation stub — not implemented yet");
}

export const dataForSeoAdapter: DataForSeoAdapter = {
  name: "dataforseo",
  getStatus,
  async getKeywordRankings() {
    notImplemented();
  },
  async getCompetitorGaps() {
    notImplemented();
  },
};
