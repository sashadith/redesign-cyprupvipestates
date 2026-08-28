// Watchdog for the portals that syndicate our blog via /api/public/v1.
//
// The agreement is that syndicated article pages carry `noindex` — they exist
// on cyprusvipestates.com first and a second indexable copy would compete with
// the original for the same rankings, in four languages, invisibly: the damage
// would show up here only as unexplained impression loss, with the cause on a
// domain we have no Search Console access to.
//
// The agreement is not enforceable from our side — we send body HTML, the
// consumer builds the page head. So this checks the consuming pages instead,
// on a schedule, and shouts when one becomes indexable.
//
// Configure with the URLs the consumer reports once its pages are live:
//   SYNDICATION_WATCH_URLS="https://portal.example/blog/a,https://portal.example/de/blog/b"
import "server-only";
import { SITE_URL } from "@/lib/seo";

export type Verdict =
  /** noindex present, no conflicting canonical — the agreed setup. */
  | "ok"
  /** noindex AND a canonical pointing at us: contradictory, and the noindex can
   *  propagate to the canonical target — i.e. it can deindex OUR article. */
  | "conflicting"
  /** No noindex, but canonical points at us. Weaker than agreed but not
   *  actively harmful — Google usually consolidates onto the original. */
  | "canonical-only"
  /** No noindex, no canonical to us: a fully competing copy. */
  | "indexable"
  /** Could not be fetched — URL changed, portal down, blocked. */
  | "unreachable"
  /** A cyprusvipestates.com URL was configured by mistake. */
  | "not-a-consumer";

export type PageCheck = {
  url: string;
  status: number | null;
  noindex: boolean;
  noindexSource: "header" | "meta" | null;
  canonical: string | null;
  verdict: Verdict;
  detail: string;
};

/** Verdicts that need a human to look now. */
export const CRITICAL_VERDICTS: Verdict[] = ["indexable", "conflicting"];

export function isCritical(v: Verdict): boolean {
  return CRITICAL_VERDICTS.includes(v);
}

// `googlebot` as well as the generic `robots` — a googlebot-scoped noindex is a
// legitimate way to do this, and reading only `robots` reported such a page as
// fully indexable (caught in testing, 2026-08-28).
const META_ROBOTS_RE =
  /<meta[^>]+name\s*=\s*["']?(?:robots|googlebot)["']?[^>]*>/gi;
const CONTENT_RE = /content\s*=\s*["']([^"']*)["']/i;
const CANONICAL_RE =
  /<link[^>]+rel\s*=\s*["']?canonical["']?[^>]*>/i;
const HREF_RE = /href\s*=\s*["']([^"']*)["']/i;

/**
 * Classify one fetched page. Pure — the fetching lives in checkUrl() so this
 * can be exercised with synthetic inputs.
 */
export function classify(input: {
  url: string;
  status: number | null;
  xRobotsTag: string | null;
  html: string | null;
  error?: string;
}): PageCheck {
  const { url, status, xRobotsTag, html } = input;

  // Our own pages are supposed to be indexable and self-canonical — scoring
  // them against the consumer rules would report a permanent false alarm. A
  // cyprusvipestates.com URL in the watch list is a configuration mistake.
  if (url.startsWith(SITE_URL)) {
    return {
      url, status, noindex: false, noindexSource: null, canonical: null,
      verdict: "not-a-consumer",
      detail: "This is our own site. SYNDICATION_WATCH_URLS must list the consuming portal's URLs only.",
    };
  }

  if (input.error || status === null || status >= 400) {
    return {
      url,
      status,
      noindex: false,
      noindexSource: null,
      canonical: null,
      verdict: "unreachable",
      detail: input.error ?? `HTTP ${status}`,
    };
  }

  // Only the head matters, and it keeps the regex work bounded on big pages.
  const head = (html ?? "").slice(0, 200_000);

  let noindex = false;
  let noindexSource: "header" | "meta" | null = null;

  if (xRobotsTag && /\bnoindex\b/i.test(xRobotsTag)) {
    noindex = true;
    noindexSource = "header";
  }

  if (!noindex) {
    // A page can carry several robots metas (a generic one plus googlebot-
    // specific). Any of them saying noindex counts.
    for (const tag of head.match(META_ROBOTS_RE) ?? []) {
      const content = tag.match(CONTENT_RE)?.[1] ?? "";
      if (/\bnoindex\b/i.test(content)) {
        noindex = true;
        noindexSource = "meta";
        break;
      }
    }
  }

  const canonicalTag = head.match(CANONICAL_RE)?.[0] ?? null;
  const canonical = canonicalTag ? canonicalTag.match(HREF_RE)?.[1] ?? null : null;
  const canonicalToOrigin = !!canonical && canonical.startsWith(SITE_URL);

  if (noindex && canonicalToOrigin) {
    return {
      url, status, noindex, noindexSource, canonical,
      verdict: "conflicting",
      detail:
        `noindex (${noindexSource}) AND rel=canonical -> ${canonical}. ` +
        "Contradictory: the noindex can be applied to the canonical target, " +
        "which would deindex the original. One or the other, never both.",
    };
  }
  if (noindex) {
    return {
      url, status, noindex, noindexSource, canonical,
      verdict: "ok",
      detail: `noindex via ${noindexSource}`,
    };
  }
  if (canonicalToOrigin) {
    return {
      url, status, noindex, noindexSource, canonical,
      verdict: "canonical-only",
      detail:
        `No noindex, but rel=canonical -> ${canonical}. Weaker than agreed; ` +
        "search engines usually consolidate onto the original, but the page is indexable.",
    };
  }
  return {
    url, status, noindex, noindexSource, canonical,
    verdict: "indexable",
    detail: canonical
      ? `Indexable, and rel=canonical points elsewhere (${canonical}) — a competing copy.`
      : "Indexable with no canonical — a fully competing copy of our article.",
  };
}

export async function checkUrl(url: string, timeoutMs = 15_000): Promise<PageCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Identify ourselves — an operator seeing this in their logs should be
        // able to tell what it is without guessing.
        "User-Agent": "CyprusVipEstates-SyndicationWatch/1.0 (+https://cyprusvipestates.com)",
      },
    });
    const html = await res.text();
    return classify({
      url,
      status: res.status,
      xRobotsTag: res.headers.get("x-robots-tag"),
      html,
    });
  } catch (e) {
    return classify({
      url,
      status: null,
      xRobotsTag: null,
      html: null,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearTimeout(timer);
  }
}

export function watchedUrls(): string[] {
  return (process.env.SYNDICATION_WATCH_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export type WatchResult =
  | { skipped: true; reason: string }
  | { skipped: false; checks: PageCheck[]; critical: PageCheck[]; warnings: PageCheck[] };

export async function runSyndicationWatch(): Promise<WatchResult> {
  const urls = watchedUrls();
  if (!urls.length) {
    return { skipped: true, reason: "SYNDICATION_WATCH_URLS not configured" };
  }
  // Sequential — a handful of URLs on someone else's server, no reason to
  // arrive as a burst.
  const checks: PageCheck[] = [];
  for (const url of urls) checks.push(await checkUrl(url));

  return {
    skipped: false,
    checks,
    critical: checks.filter((c) => isCritical(c.verdict)),
    warnings: checks.filter(
      (c) => c.verdict === "canonical-only" || c.verdict === "unreachable" || c.verdict === "not-a-consumer",
    ),
  };
}

/** Telegram/alert body. Admin-facing, so English per the project convention. */
export function buildAlert(result: Extract<WatchResult, { skipped: false }>): string {
  const lines: string[] = [];
  const entry = (c: PageCheck) => {
    lines.push("");
    lines.push(`• ${c.url}`);
    lines.push(`  ${c.verdict.toUpperCase()} — ${c.detail}`);
  };

  if (result.critical.length) {
    lines.push(`🚨 Syndicated blog pages are indexable (${result.critical.length})`);
    lines.push("");
    lines.push("These compete with our own blog for the same rankings:");
    result.critical.forEach(entry);
  } else {
    lines.push(`⚠️ Syndication check needs attention (${result.warnings.length})`);
  }

  // Warnings are listed separately — lumping them under the critical heading
  // read as if an unreachable URL were also cannibalising us.
  if (result.warnings.length) {
    lines.push("");
    lines.push(result.critical.length ? "Also worth a look:" : "");
    result.warnings.forEach(entry);
  }

  lines.push("");
  lines.push(
    `Checked ${result.checks.length} URL(s). Fix: restore noindex on the consuming ` +
      "pages, or revoke that portal's key in BLOG_API_KEYS.",
  );
  return lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n");
}
