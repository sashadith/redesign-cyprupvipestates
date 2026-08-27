// GET /api/public/v1/posts/<slug>?lang=de — one full article as HTML.
//
// The body arrives pre-serialized (`html`) so the consumer only supplies CSS.
// Project listings and lead forms are NOT exported: each is an empty
// <div data-cvp-embed="…"> placeholder, described in `embeds`, that the
// consumer fills with its own inventory / form.
//
// `canonicalUrl` must be emitted as <link rel="canonical"> on the consuming
// page — these articles exist on cyprusvipestates.com first, and two live
// copies without a canonical is self-inflicted duplicate content.
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/publicApi/auth";
import { getPostDetail, EXPORTED_LOCALES } from "@/lib/publicApi/blogFeed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = authenticate(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang")?.trim();
  if (!lang || !EXPORTED_LOCALES.includes(lang as any)) {
    return NextResponse.json(
      { error: "invalid_lang", message: `lang is required and must be one of: ${EXPORTED_LOCALES.join(", ")}` },
      { status: 400 },
    );
  }

  const slug = decodeURIComponent(params.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });

  try {
    const post = await getPostDetail(lang, slug);
    if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Weak ETag off the row's updatedAt: a delta sync that re-fetches an
    // unchanged article gets a 304 and skips the payload entirely.
    const etag = `W/"${post.id}-${new Date(post.updatedAt).getTime()}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    if (post.unsupportedBlockTypes.length) {
      console.warn(
        `[public-api] ${lang}/${slug}: unsupported block types skipped — ${post.unsupportedBlockTypes.join(", ")}`,
      );
    }

    return NextResponse.json(post, {
      headers: { ETag: etag, "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("[public-api] post detail failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
