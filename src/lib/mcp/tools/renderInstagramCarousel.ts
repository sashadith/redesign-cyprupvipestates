import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { RenderInput } from "@/lib/social/carousel/schema";
import { ImageRejected } from "@/lib/social/carousel/imagePolicy";
import { RenderError, renderCarousel } from "@/lib/social/carousel/render";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

// render_instagram_carousel (2026-11-05): six 1080×1350 JPG slides from one of the
// two approved designs (assets/social-templates/), rendered with headless Chromium
// on the server and stored under /uploads/social/<ISO week>/<slug>-<lang>/. Layout
// rules are checked on the rendered pixels before anything is saved; a slide that
// cannot be fitted is an error naming the slide and the rule, never a saved file.
export const CAROUSEL_TOOL = "render_instagram_carousel";

export function registerRenderInstagramCarousel(server: McpServer) {
  server.registerTool(
    CAROUSEL_TOOL,
    {
      title: "Render Instagram carousel",
      description:
        'Renders an Instagram carousel (6 JPG slides, 1080×1350, plus a preview sheet) from one of the two approved designs and stores it on cyprusvipestates.com. template "project" (dark): a published development — `slug` is its slug; take images, amenities and vatNote from crm_get_project. template "cyprus" (light): a "why Cyprus" topic — `slug` is a free kebab-case name. Text only in the input; logos, portrait, phone, the four advantages, frame and footer are fixed in the design. Images must be https://cyprusvipestates.com/uploads/… URLs (e.g. crm_get_project `gallery`, or blog_get_article / blog_list_articles `coverImageUrl` and `bodyImageUrls`, which are under /uploads/images/); anything else is rejected. Each headline has exactly one marked phrase (`markedWords`, must occur once). `postingDate` (YYYY-MM-DD) picks the folder week; re-rendering the same slug, language and week replaces the earlier set. Layout rules (bottom line, eyebrow gap, price line, marking, portrait/frame) are enforced; the heading may shrink to 72 %, beyond that the call fails with the slide and rule and nothing is saved. Returns the 6 slide URLs, the preview URL and a per-slide report.',
      inputSchema: RenderInput,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      runTool(
        CAROUSEL_TOOL,
        contextFromAuthInfo(ctx.http?.authInfo),
        null,
        async () => {
          const args = input as RenderInput;
          if (args.template === "project") {
            const dev = await prisma.development.findFirst({ where: { slug: args.slug, publishStatus: "published" }, select: { id: true } });
            if (!dev) throw new ToolError("not_found", `No published project with slug "${args.slug}".`);
          } else {
            // Both templates share /uploads/social/<week>/<slug>-<lang>/: a topic slug that equals a
            // project slug would replace that project's carousel of the same week.
            const clash = await prisma.development.findFirst({ where: { slug: args.slug }, select: { id: true } });
            if (clash) throw new ToolError("validation", `"${args.slug}" is a project slug; give the cyprus carousel its own name.`);
          }
          try {
            return await renderCarousel(args);
          } catch (e) {
            if (e instanceof ImageRejected) throw new ToolError("image_rejected", e.message);
            if (e instanceof RenderError) throw new ToolError(e.code, e.message);
            throw e;
          }
        },
        { detail: () => ({ template: (input as RenderInput).template, lang: (input as RenderInput).lang, slug: (input as RenderInput).slug }) },
      ),
  );
}
