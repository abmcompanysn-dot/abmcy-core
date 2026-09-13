import type { MetadataRoute } from "next";

const BASE_URL = "https://new.mahu.cards";

/** Route spéciale Next.js, servie sur /robots.txt — autorise tout le site
 * public à l'indexation, sauf /admin (backoffice, sans intérêt pour un
 * moteur de recherche et jamais destiné à apparaître dans des résultats). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
