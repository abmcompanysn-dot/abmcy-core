// Overlay de branding MAHU partagé entre le générateur de vidéo pur
// (VideoGenerator.tsx, image de couverture → vidéo animée) et l'import de
// fichier externe brandé (VideoImportBrander.tsx, vidéo/audio importé →
// même overlay superposé) — même logique de dessin, portée de
// MAHU-NEW/admin.html:756-836 (drawFrame) et :1042-1095 (drawMahuBrand).

export type VideoFormat = "youtube" | "instagram" | "story";

export const VIDEO_FORMATS: Record<
  VideoFormat,
  { label: string; w: number; h: number }
> = {
  youtube: { label: "YouTube (1280×720)", w: 1280, h: 720 },
  instagram: { label: "Instagram (1080×1080)", w: 1080, h: 1080 },
  story: { label: "Story (1080×1920)", w: 1080, h: 1920 },
};

export interface BrandOverlayInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  format: VideoFormat;
  title: string;
  category: string;
  /** 0..1, progression de l'animation d'entrée (logo/badge/titre) — pour
   * un import de fichier long, l'appelant peut la clamper à 1 après les
   * premières secondes plutôt que de la garder liée à `elapsedMs`. */
  t: number;
  elapsedMs: number;
}

/** Dessine le bandeau MAHU (dégradé, barre de progression, logo, badge
 * catégorie, titre, point LIVE) par-dessus le frame courant du canvas —
 * n'importe quelle image/vidéo doit déjà être dessinée en fond par
 * l'appelant avant cet appel. */
export function drawBrandOverlay({
  ctx,
  width: W,
  height: H,
  format,
  title,
  category,
  t,
  elapsedMs,
}: BrandOverlayInput): void {
  const grad = ctx.createLinearGradient(0, H * 0.25, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Barre de progression rouge
  ctx.fillStyle = "#E31B23";
  ctx.fillRect(0, 0, W * t, 7);

  // Logo MAHU
  const logoSize = format === "story" ? 72 : 56;
  ctx.fillStyle = "white";
  ctx.font = `900 ${logoSize}px Georgia, serif`;
  ctx.fillText("MAHU", 60, 60 + logoSize * 0.8);
  ctx.fillStyle = "#E31B23";
  ctx.fillRect(60, 60 + logoSize + 5, 90, 7);

  // Badge catégorie (fade-in)
  const cat = category || "ACTUALITÉ";
  const catT = Math.max(0, (t - 0.2) / 0.3);
  if (catT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(catT, 1);
    ctx.font =
      format === "story" ? "900 26px Inter,sans-serif" : "900 20px Inter,sans-serif";
    const catW = ctx.measureText(cat.toUpperCase()).width + 32;
    ctx.fillStyle = "#E31B23";
    ctx.fillRect(60, H - (format === "story" ? 300 : 180), catW, 40);
    ctx.fillStyle = "white";
    ctx.fillText(cat.toUpperCase(), 76, H - (format === "story" ? 272 : 153));
    ctx.restore();
  }

  // Titre (fade + glissement, retour à la ligne automatique)
  const ttT = Math.max(0, (t - 0.35) / 0.4);
  if (ttT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(ttT, 1);
    const titleSize = format === "story" ? 62 : 50;
    ctx.font = `700 ${titleSize}px Georgia, serif`;
    ctx.fillStyle = "white";
    const maxTW = W - 120;
    const words = title.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxTW && line) {
        lines.push(line.trim());
        line = word + " ";
      } else {
        line = test;
      }
    }
    if (line.trim()) lines.push(line.trim());
    const shownLines = lines.slice(0, 3);
    const lineHeight = titleSize * 1.25;
    const startY =
      H - (format === "story" ? 230 : 120) - (shownLines.length - 1) * lineHeight;
    shownLines.forEach((l, i) =>
      ctx.fillText(l, 60 + (1 - Math.min(ttT, 1)) * 40, startY + i * lineHeight)
    );
    ctx.restore();
  }

  // Point LIVE clignotant
  const dot = (Math.sin(elapsedMs / 300) + 1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.6 + dot * 0.4;
  ctx.fillStyle = "#E31B23";
  ctx.beginPath();
  ctx.arc(W - 60, 55, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "white";
  ctx.font = "bold 15px Inter,sans-serif";
  ctx.fillText("LIVE", W - 44, 61);
}

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  return MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
}
