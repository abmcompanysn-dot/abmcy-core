import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="flex flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] no-underline transition hover:-translate-y-1 hover:border-[var(--text-muted)]"
    >
      <div className="relative h-[200px] w-full overflow-hidden bg-[var(--border-color)]">
        {article.cover_image_url ? (
          <Image
            src={article.cover_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {article.category ? (
          <span className="mb-2 text-[0.7rem] font-extrabold tracking-wide text-[var(--accent-red)] uppercase">
            {article.category}
          </span>
        ) : null}
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl leading-tight text-[var(--text-main)]">
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="line-clamp-2 mb-4 text-sm text-[var(--text-muted)]">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between border-t border-[var(--border-color)] pt-4 text-xs text-[var(--text-muted)]">
          <span>{formatDate(article.published_at)}</span>
          <span>{article.view_count} vues</span>
        </div>
      </div>
    </Link>
  );
}
