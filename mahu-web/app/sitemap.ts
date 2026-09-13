import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/api";

const BASE_URL = "https://new.mahu.cards";

/** Sitemap dynamique — inclut l'accueil et chaque article publié, généré
 * à la demande par Next.js (route spéciale app/sitemap.ts, servie sur
 * /sitemap.xml). Un échec de l'API ne doit pas faire planter le
 * sitemap : mieux vaut un sitemap réduit (juste l'accueil) qu'aucun
 * sitemap du tout. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  try {
    const articles = await listArticles();
    for (const article of articles) {
      entries.push({
        url: `${BASE_URL}/articles/${article.id}`,
        lastModified: article.published_at
          ? new Date(article.published_at)
          : new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // API injoignable au moment de la génération — on renvoie quand même
    // le sitemap réduit plutôt que de faire échouer la route entière.
  }

  return entries;
}
