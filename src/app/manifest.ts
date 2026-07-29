import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cyprus VIP Estates",
    short_name: "CVE",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: "#142E2D",
    background_color: "#142E2D",
    display: "standalone",
  };
}
