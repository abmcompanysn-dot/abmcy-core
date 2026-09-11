export function Hero() {
  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden border-b border-white/5 sm:min-h-[640px]">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* Assombrit la vidéo pour garder le texte lisible, et fond vers le
          noir en bas pour raccorder proprement avec le reste de la page. */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/55 to-bg" />

      <div className="relative mx-auto max-w-2xl px-6 py-24 text-center sm:py-32">
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
    </section>
  );
}
