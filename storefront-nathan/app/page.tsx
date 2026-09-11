import { listProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { Hero } from "@/components/Hero";

export const revalidate = 60;

export default async function HomePage() {
  const products = await listProducts({ sort: "newest" }).catch(() => []);

  return (
    <div>
      <Hero />

      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center text-text-muted">
            Aucun produit disponible pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
