// Petits utilitaires de formatage lisibles en français.

/** Formate un montant en FCFA (francs CFA), sans décimales. */
export function formatFCFA(amount: number): string {
  if (!Number.isFinite(amount)) return "0 FCFA";
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} FCFA`;
}

/** Formate une date ISO en date + heure lisible (fr-FR). */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Convertit un nombre d'octets en chaîne lisible (Ko, Mo, Go...). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 o";
  if (bytes === 0) return "0 o";

  const units = ["o", "Ko", "Mo", "Go", "To"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}
