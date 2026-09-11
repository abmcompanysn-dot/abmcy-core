import { listProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

export const revalidate = 60;

export default async function HomePage() {
  const products = await listProducts({ sort: "newest" }).catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-medium uppercase tracking-widest text-accent-secondary">
          Produits numériques
        </span>
        <h1 className="mt-4 font-(family-name:--font-display) text-4xl font-bold tracking-tight text-balance text-text sm:text-5xl">
          Des ressources prêtes à télécharger
        </h1>
        <p className="mt-4 text-balance text-lg text-text-muted">
          Ebooks, templates et fichiers numériques. Payez en Wave, Orange
          Money, MTN MoMo ou carte — recevez votre lien de téléchargement
          immédiatement.
        </p>
      </div>

      <div className="mt-16">
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
