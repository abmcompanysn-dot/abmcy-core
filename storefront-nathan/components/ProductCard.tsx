import Link from "next/link";
import type { Product } from "@/lib/api";
import { formatFCFA } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const cover = product.images?.[0]?.url;

  return (
    <Link
      href={`/produits/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-bg-secondary transition-colors hover:border-accent/40"
    >
      <div className="aspect-[4/3] overflow-hidden bg-black/20">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-(family-name:--font-display) font-bold text-white/10">
            {product.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {product.category && (
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {product.category}
          </span>
        )}
        <h3 className="font-(family-name:--font-display) text-base font-semibold text-text">
          {product.name}
        </h3>
        <p className="mt-auto text-lg font-bold text-accent">
          {formatFCFA(product.price)}
        </p>
      </div>
    </Link>
  );
}
