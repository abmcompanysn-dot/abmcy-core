import type { Article } from "@/lib/types";
import ArticleCard from "./ArticleCard";

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
        Aucun article pour l&apos;instant.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-8">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
