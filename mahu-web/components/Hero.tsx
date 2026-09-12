import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/types";

export default function Hero({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="relative mb-10 flex h-[70vh] min-h-[320px] items-end overflow-hidden no-underline"
    >
      {article.cover_image_url ? (
        <Image
          src={article.cover_image_url}
          alt={article.title}
          fill
          priority
          sizes="100vw"
          className="object-cover brightness-40"
        />
      ) : (
        <div className="absolute inset-0 bg-[var(--bg-card)]" />
      )}
      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-8">
        {article.category ? (
          <span className="mb-4 inline-block bg-[var(--accent-red)] px-3 py-1 text-[0.7rem] font-bold tracking-wide text-white uppercase">
            {article.category}
          </span>
        ) : null}
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight text-white sm:text-6xl">
          {article.title}
        </h1>
      </div>
    </Link>
  );
}
