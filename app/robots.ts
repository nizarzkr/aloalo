// robots.txt généré — le dashboard et les routes techniques ne doivent pas être
// indexés ; seule la vitrine et les pages légales le sont.
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/onboarding", "/join", "/dev", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
