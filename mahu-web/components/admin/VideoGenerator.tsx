"use client";

import { useRef, useState } from "react";
import type { Article } from "@/lib/types";
import {
  drawBrandOverlay,
  pickMimeType,
  VIDEO_FORMATS,
  type VideoFormat,
} from "@/lib/videoBranding";

/** Générateur de vidéo brandée MAHU pour le partage réseaux sociaux — pur
 * outil client (Canvas 2D + MediaRecorder → WebM), portage direct de
 * MAHU-NEW/admin.html:710-855. Aucune route backend : le fichier est
 * dessiné et encodé entièrement dans le navigateur, jamais uploadé.
 * L'overlay (logo/badge/titre/point LIVE) est partagé avec
 * VideoImportBrander.tsx via lib/videoBranding.ts. */

const DURATION_MS = 6000;

export default function VideoGenerator({ article }: { article: Article }) {
  const [format, setFormat] = useState<VideoFormat>("youtube");
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

    const { w: W, h: H } = VIDEO_FORMATS[format];
    const mimeType = pickMimeType();

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
      drawBrandOverlay({
        ctx: ctx!,
        width: W,
        height: H,
        format,
        title: article.title,
        category: article.category ?? "",
        t,
        elapsedMs: elapsed,
      });

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
        {Object.entries(VIDEO_FORMATS).map(([key, f]) => (
          <button
            key={key}
            onClick={() => setFormat(key as VideoFormat)}
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
