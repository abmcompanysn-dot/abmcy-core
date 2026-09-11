import { notFound } from "next/navigation";
import { ApiError, getProduct } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AddToCartButton } from "@/components/AddToCartButton";

export default async function ProductPage({
  params,
}: PageProps<"/produits/[id]">) {
  const { id } = await params;

  const product = await getProduct(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });

  if (!product) notFound();

  const images = product.images ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl border border-white/5 bg-bg-secondary">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[0].url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-8xl font-(family-name:--font-display) font-bold text-white/10">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.category && (
            <span className="text-sm font-medium uppercase tracking-widest text-accent-secondary">
              {product.category}
            </span>
          )}
          <h1 className="mt-3 font-(family-name:--font-display) text-3xl font-bold tracking-tight text-balance text-text sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl font-bold text-accent">
            {formatFCFA(product.price)}
          </p>

          {product.description && (
            <p className="mt-6 text-base leading-relaxed text-text-muted">
              {product.description}
            </p>
          )}

          <div className="mt-10">
            <AddToCartButton
              productId={product.id}
              name={product.name}
              price={product.price}
            />
          </div>

          <p className="mt-6 text-xs text-text-muted">
            Fichier livré par lien de téléchargement sécurisé, immédiatement
            après paiement.
          </p>
        </div>
      </div>
    </div>
  );
}
