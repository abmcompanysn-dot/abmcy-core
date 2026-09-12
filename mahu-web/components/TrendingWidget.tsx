import Link from "next/link";
import type { Article } from "@/lib/types";

/** Top articles par vues réelles (article.view_count, incrémenté côté
 * serveur — voir content.Service.IncrementView) : remplace le widget
 * "Analytics Direct" à données codées en dur et le compteur de vues
 * simulé en Math.random() de l'ancien site MAHU-NEW. */
export default function TrendingWidget({ articles }: { articles: Article[] }) {
  const top = [...articles]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="mb-10">
      <h3 className="mb-5 border-l-4 border-[var(--accent-red)] pl-4 font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]">
        Les plus lus
      </h3>
      <div className="flex flex-col gap-4">
        {top.map((article, i) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="flex items-center gap-4 no-underline"
          >
            <span className="text-2xl font-black text-[var(--border-color)]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                {article.title}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {article.view_count} vues
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
