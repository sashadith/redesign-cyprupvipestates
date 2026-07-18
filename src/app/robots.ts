import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/c/", // token-protected client presentation pages — also carry their own noindex meta + X-Robots-Tag
          "/_next",
          "/_assets",
          "/_static",
          "*?gtm",
          "*?utm",
          "*?gclid",
          "*?from",
          "*?gbraid",
          "*?matchtype=",
        ],
      },
    ],
    sitemap: "https://cyprusvipestates.com/sitemap.xml",
    host: "https://cyprusvipestates.com",
  };
}
