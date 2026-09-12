"use client";

import { useRef, useState } from "react";
import type { Article } from "@/lib/types";

/** Générateur de vidéo brandée MAHU pour le partage réseaux sociaux — pur
 * outil client (Canvas 2D + MediaRecorder → WebM), portage direct de
 * MAHU-NEW/admin.html:710-855. Aucune route backend : le fichier est
 * dessiné et encodé entièrement dans le navigateur, jamais uploadé. */

type Format = "youtube" | "instagram" | "story";

const FORMATS: Record<Format, { label: string; w: number; h: number }> = {
  youtube: { label: "YouTube (1280×720)", w: 1280, h: 720 },
  instagram: { label: "Instagram (1080×1080)", w: 1080, h: 1080 },
  story: { label: "Story (1080×1920)", w: 1080, h: 1920 },
};

const DURATION_MS = 6000;

export default function VideoGenerator({ article }: { article: Article }) {
  const [format, setFormat] = useState<Format>("youtube");
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  async function generate() {
    if (typeof window === "undefined" || !window.MediaRecorder) {
      setError("Votre navigateur ne supporte pas MediaRecorder. Utilisez Chrome ou Edge.");
      return;
    }
    if (!article.cover_image_url) {
      setError("Cet article n'a pas d'image de couverture — ajoutez-en une avant de générer une vidéo.");
      return;
    }

    setError(null);
    setVideoUrl(null);
    setGenerating(true);

    const { w: W, h: H } = FORMATS[format];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Impossible d'initialiser le canevas de rendu.");
      setGenerating(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = article.cover_image_url;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoUrl(URL.createObjectURL(blob));
      setGenerating(false);
    };

    recorder.start(100);
    const startTime = performance.now();

    function drawFrame(ts: number) {
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / DURATION_MS, 1);

      ctx!.drawImage(img, 0, 0, W, H);

      const grad = ctx!.createLinearGradient(0, H * 0.25, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      // Barre de progression rouge
      ctx!.fillStyle = "#E31B23";
      ctx!.fillRect(0, 0, W * t, 7);

      // Logo MAHU
      const logoSize = format === "story" ? 72 : 56;
      ctx!.fillStyle = "white";
      ctx!.font = `900 ${logoSize}px Georgia, serif`;
      ctx!.fillText("MAHU", 60, 60 + logoSize * 0.8);
      ctx!.fillStyle = "#E31B23";
      ctx!.fillRect(60, 60 + logoSize + 5, 90, 7);

      // Badge catégorie (fade-in)
      const category = article.category || "ACTUALITÉ";
      const catT = Math.max(0, (t - 0.2) / 0.3);
      if (catT > 0) {
        ctx!.save();
        ctx!.globalAlpha = catT;
        ctx!.font =
          format === "story" ? "900 26px Inter,sans-serif" : "900 20px Inter,sans-serif";
        const catW = ctx!.measureText(category.toUpperCase()).width + 32;
        ctx!.fillStyle = "#E31B23";
        ctx!.fillRect(60, H - (format === "story" ? 300 : 180), catW, 40);
        ctx!.fillStyle = "white";
        ctx!.fillText(category.toUpperCase(), 76, H - (format === "story" ? 272 : 153));
        ctx!.restore();
      }

      // Titre (fade + glissement, retour à la ligne automatique)
      const ttT = Math.max(0, (t - 0.35) / 0.4);
      if (ttT > 0) {
        ctx!.save();
        ctx!.globalAlpha = ttT;
        const titleSize = format === "story" ? 62 : 50;
        ctx!.font = `700 ${titleSize}px Georgia, serif`;
        ctx!.fillStyle = "white";
        const maxTW = W - 120;
        const words = article.title.split(" ");
        let line = "";
        const lines: string[] = [];
        for (const word of words) {
          const test = line + word + " ";
          if (ctx!.measureText(test).width > maxTW && line) {
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
          ctx!.fillText(l, 60 + (1 - ttT) * 40, startY + i * lineHeight)
        );
        ctx!.restore();
      }

      // Point LIVE clignotant
      const dot = (Math.sin(elapsed / 300) + 1) / 2;
      ctx!.save();
      ctx!.globalAlpha = 0.6 + dot * 0.4;
      ctx!.fillStyle = "#E31B23";
      ctx!.beginPath();
      ctx!.arc(W - 60, 55, 10, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
      ctx!.fillStyle = "white";
      ctx!.font = "bold 15px Inter,sans-serif";
      ctx!.fillText("LIVE", W - 44, 61);

      if (elapsed < DURATION_MS) {
        rafRef.current = requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }

  const shareText = encodeURIComponent(`${article.title} — via MAHU`);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/articles/${article.id}`
      : "";

  return (
    <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]">
        Vidéo brandée pour les réseaux sociaux
      </h3>

      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(FORMATS).map(([key, f]) => (
          <button
            key={key}
            onClick={() => setFormat(key as Format)}
            disabled={generating}
            className={`rounded px-3 py-2 text-xs font-semibold ${
              format === key
                ? "bg-[var(--accent-red)] text-white"
                : "border border-[var(--border-color)] text-[var(--text-muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="mb-4 rounded bg-[var(--accent-red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {generating ? "Génération en cours (6s)..." : "Générer la vidéo"}
      </button>

      {error ? (
        <p className="mb-4 rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--text-main)]">
          {error}
        </p>
      ) : null}

      {videoUrl ? (
        <div>
          <video
            src={videoUrl}
            controls
            playsInline
            className="max-h-[360px] w-full rounded bg-black"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={videoUrl}
              download={`mahu_${article.slug}.webm`}
              className="rounded bg-[var(--accent-red)] px-3 py-2 text-xs font-semibold text-white"
            >
              ⬇ Télécharger
            </a>
            <a
              href="https://www.youtube.com/upload"
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
            >
              ▶ YouTube
            </a>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
            >
              📸 Instagram
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${shareText}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
            >
              📘 Facebook
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)]"
            >
              𝕏 Twitter
            </a>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Format WebM • téléchargez puis importez sur YouTube / Instagram / Facebook.
          </p>
        </div>
      ) : null}
    </div>
  );
}
