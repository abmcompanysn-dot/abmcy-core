import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getArticle, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import ArticleViewTracker from "@/components/ArticleViewTracker";

type Props = { params: Promise<{ id: string }> };

/** Server Component (contrairement au reste du site) : les balises
 * Open Graph doivent être générées côté serveur pour que les crawlers de
 * partage (WhatsApp, Facebook, Twitter) — qui n'exécutent pas le
 * JavaScript côté client — voient le vrai titre/image/extrait de
 * l'article plutôt que le fallback générique du layout racine. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await getArticle(id);
    const description =
      article.excerpt || article.body.slice(0, 160).trim() + "…";
    return {
      title: `${article.title} | MAHU`,
      description,
      openGraph: {
        title: article.title,
        description,
        type: "article",
        url: `/articles/${article.id}`,
        images: article.cover_image_url ? [{ url: article.cover_image_url }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description,
        images: article.cover_image_url ? [article.cover_image_url] : [],
      },
    };
  } catch {
    return { title: "Article | MAHU" };
  }
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;

  let article;
  try {
    article = await getArticle(id);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Impossible de charger cet article.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
        <p className="mb-6 text-sm text-[var(--text-muted)]">{message}</p>
        <Link href="/" className="text-sm text-[var(--accent-red)]">
          ← Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <ArticleViewTracker id={article.id} />

      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--text-muted)] no-underline hover:text-[var(--accent-red)]"
      >
        ← Retour à l&apos;accueil
      </Link>

      {article.category ? (
        <span className="mb-3 inline-block bg-[var(--accent-red)] px-3 py-1 text-[0.7rem] font-bold tracking-wide text-white uppercase">
          {article.category}
        </span>
      ) : null}

      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--text-main)] sm:text-5xl">
        {article.title}
      </h1>

      <div className="mb-6 flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>{formatDate(article.published_at)}</span>
        <span>{article.view_count} vues</span>
        {article.region ? <span>{article.region}</span> : null}
      </div>

      {article.cover_image_url ? (
        <div className="relative mb-8 h-[320px] w-full overflow-hidden sm:h-[420px]">
          <Image
            src={article.cover_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <div className="space-y-4 text-lg leading-relaxed whitespace-pre-line text-[var(--text-main)]">
        {article.body}
      </div>
    </main>
  );
}
