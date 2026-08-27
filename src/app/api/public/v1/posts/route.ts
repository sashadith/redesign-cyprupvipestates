// GET /api/public/v1/posts — paginated article index for external consumers.
//
//   ?lang=de|en|pl|ru   restrict to one language (omit = all four)
//   ?since=<ISO-8601>   only articles changed at/after this instant (delta sync)
//   ?page=1&limit=50    pagination (limit max 100)
//
// Auth: X-API-Key (see src/lib/publicApi/auth.ts). Summaries only — no article
// body; fetch /api/public/v1/posts/<slug>?lang=<lang> for that.
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/publicApi/auth";
import { listPosts, EXPORTED_LOCALES } from "@/lib/publicApi/blogFeed";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);

  const lang = searchParams.get("lang")?.trim() || undefined;
  if (lang && !EXPORTED_LOCALES.includes(lang as any)) {
    return NextResponse.json(
      { error: "invalid_lang", message: `lang must be one of: ${EXPORTED_LOCALES.join(", ")}` },
      { status: 400 },
    );
  }

  const sinceRaw = searchParams.get("since")?.trim();
  let since: Date | undefined;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "invalid_since", message: "since must be an ISO-8601 timestamp." }, { status: 400 });
    }
    since = parsed;
  }

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));

  try {
    const { total, posts } = await listPosts({ lang, since, page, limit });
    return NextResponse.json(
      {
        posts,
        page,
        limit,
        total,
        hasMore: page * limit < total,
        // Feed this back as `since` on the next sync run.
        syncedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("[public-api] list posts failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
