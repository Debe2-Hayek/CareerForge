import type { MetadataRoute } from "next";
import { siteOrigin, siteUrl } from "@/lib/site-url";

// Page routes remain crawlable so bots can observe their noindex metadata and
// X-Robots-Tag headers. Only non-document service/callback endpoints are blocked.
const crawlerExcludedRoutes = [
  "/api/",
  "/auth/"
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: crawlerExcludedRoutes
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: siteOrigin
  };
}
