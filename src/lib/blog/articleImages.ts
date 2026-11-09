// Article images for the blog MCP tools (2026-11-09), as absolute URLs that
// render_instagram_carousel accepts. The cover goes through urlFor — the same
// resolver the public article uses for its hero and og:image — so the two
// cannot drift apart. Each image is stored once, as its original, so that path
// is also our largest hosted version.
import { urlFor } from "@/sanity/sanity.client";
import { absoluteUploadsUrl, contentBlocksToMarkdown } from "./blocksToMarkdown";

/** The article's cover (previewImage) as an absolute https://cyprusvipestates.com/uploads/… URL; null when none. */
export function coverImageUrl(previewImage: unknown): string | null {
  if (!previewImage) return null;
  try {
    return absoluteUploadsUrl(urlFor(previewImage).url());
  } catch {
    return null;
  }
}

/** Every image referenced in the article body, absolute, in body order, each once; [] when none. */
export function bodyImageUrls(contentBlocks: unknown): string[] {
  return contentBlocksToMarkdown(contentBlocks).images;
}
