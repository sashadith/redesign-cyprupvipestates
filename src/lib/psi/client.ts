// PageSpeed Insights v5 API — free tier, plain API key (no service account,
// no OAuth). Prefers real CrUX field data (28-day rolling real-user metrics)
// and falls back to the Lighthouse lab run in the same response when a URL
// doesn't have enough real-user traffic for CrUX to report on it (common for
// low-traffic Development pages) — see docs at
// https://developers.google.com/speed/docs/insights/v5/get-started.
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export function isPsiConfigured(): boolean {
  return !!process.env.PSI_API_KEY;
}

export type CwvReading = {
  lcp: number; // ms
  cls: number; // unitless (e.g. 0.05)
  inp: number | null; // ms — not always available
  perfScore: number; // 0-100
  source: "field" | "lab";
};

type PsiResponse = {
  loadingExperience?: {
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number }; // CrUX scales this x100 (15 = 0.15)
      INTERACTION_TO_NEXT_PAINT?: { percentile: number };
    };
  };
  lighthouseResult?: {
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      "interaction-to-next-paint"?: { numericValue?: number };
      "experimental-interaction-to-next-paint"?: { numericValue?: number };
    };
    categories?: { performance?: { score?: number } };
  };
};

export async function fetchCwv(url: string): Promise<CwvReading> {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey) throw new Error("PSI_API_KEY not configured");

  const qs = new URLSearchParams({ url, key: apiKey, strategy: "mobile", category: "performance" });
  const res = await fetch(`${PSI_ENDPOINT}?${qs.toString()}`);
  if (!res.ok) throw new Error(`PSI request failed for ${url}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as PsiResponse;

  const audits = data.lighthouseResult?.audits ?? {};
  const perfScore = Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100);

  const fieldLcp = data.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
  const fieldCls = data.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
  if (fieldLcp != null && fieldCls != null) {
    const fieldInp = data.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
    return { lcp: fieldLcp, cls: fieldCls / 100, inp: fieldInp ?? null, perfScore, source: "field" };
  }

  const labLcp = audits["largest-contentful-paint"]?.numericValue ?? 0;
  const labCls = audits["cumulative-layout-shift"]?.numericValue ?? 0;
  const labInp = audits["interaction-to-next-paint"]?.numericValue ?? audits["experimental-interaction-to-next-paint"]?.numericValue ?? null;
  return { lcp: labLcp, cls: labCls, inp: labInp, perfScore, source: "lab" };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
