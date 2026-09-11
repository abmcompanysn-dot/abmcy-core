export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/5 bg-bg-secondary">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-text-muted">
        <p>Paiement sécurisé — Wave, Orange Money, MTN MoMo, carte bancaire.</p>
        <p>© {year} Nathan. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
