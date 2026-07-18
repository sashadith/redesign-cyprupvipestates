import type { SeoSourceAdapter, SeoSourceStatus } from "./types";

// Future provider: Google Business Profile (local-search insights + reviews
// for the Paphos office — relevant to a real-estate agency's local SEO in a
// way GSC's own web-search data doesn't cover: map views, direction requests,
// call clicks, review volume/rating). FOUNDATION ONLY — typed interface +
// config check, no API calls implemented. Would reuse the same
// service-account pattern as src/lib/gsc/client.ts (Business Profile
// Performance API also supports service-account auth once the account is
// added as a manager of the location), hence the similarly-named env vars:
//   GBP_SERVICE_ACCOUNT_KEY_PATH, GBP_LOCATION_ID — unset today, on purpose.

export type GbpInsights = {
  locationId: string;
  views: number;
  searches: number;
  calls: number;
  directionRequests: number;
  periodStart: Date;
  periodEnd: Date;
};

export type GbpReview = {
  id: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
};

export interface GbpAdapter extends SeoSourceAdapter {
  getLocationInsights(params: { locationId: string; periodStart: Date; periodEnd: Date }): Promise<GbpInsights>;
  getReviews(params: { locationId: string }): Promise<GbpReview[]>;
}

function isConfigured(): boolean {
  return !!process.env.GBP_SERVICE_ACCOUNT_KEY_PATH && !!process.env.GBP_LOCATION_ID;
}

function getStatus(): SeoSourceStatus {
  return isConfigured() ? { configured: true } : { configured: false, reason: "GBP_SERVICE_ACCOUNT_KEY_PATH / GBP_LOCATION_ID not set" };
}

function notImplemented(): never {
  throw new Error("gbp adapter is a foundation stub — not implemented yet");
}

export const gbpAdapter: GbpAdapter = {
  name: "gbp",
  getStatus,
  async getLocationInsights() {
    notImplemented();
  },
  async getReviews() {
    notImplemented();
  },
};
