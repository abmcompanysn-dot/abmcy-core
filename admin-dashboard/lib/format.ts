// Petits utilitaires de formatage lisibles en français.

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

/** Calcule un pourcentage d'usage borné entre 0 et 100. */
export function usagePercent(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  const pct = (used / limit) * 100;
  return Math.max(0, Math.min(100, pct));
}
