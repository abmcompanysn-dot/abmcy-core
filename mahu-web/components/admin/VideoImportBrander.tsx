"use client";

import { useRef, useState } from "react";
import type { Article } from "@/lib/types";
import {
  drawBrandOverlay,
  pickMimeType,
  VIDEO_FORMATS,
  type VideoFormat,
} from "@/lib/videoBranding";

/** Import d'un fichier vidéo ou audio existant, avec le branding MAHU
 * (overlay logo/badge/titre) réappliqué par-dessus — portage de
 * MAHU-NEW/admin.html:865-1040 (openVideoImport, handleImportFile,
 * brandImportedVideo). Deux chemins distincts :
 *  - vidéo : rejoue le fichier, dessine chaque frame sur un canvas avec
 *    l'overlay superposé, capture l'audio original via Web Audio API et
 *    le recombine avec le flux vidéo du canvas.
 *  - audio seul : dessine l'image de couverture de l'article en fond +
 *    un visualiseur de fréquences (AnalyserNode) + l'overlay MAHU.
 * Aucune route backend : tout se passe dans le navigateur. */
export default function VideoImportBrander({ article }: { article: Article }) {
  const [format, setFormat] = useState<VideoFormat>("youtube");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<"video" | "audio" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResultUrl(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setKind(f.type.startsWith("audio/") ? "audio" : "video");
  }

  async function brand() {
    if (!file || !kind) return;
    if (typeof window === "undefined" || !window.MediaRecorder) {
      setError("Votre navigateur ne supporte pas MediaRecorder. Utilisez Chrome ou Edge.");
      return;
    }

    setError(null);
    setResultUrl(null);
    setProcessing(true);

    const { w: W, h: H } = VIDEO_FORMATS[format];
    const mimeType = pickMimeType();
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Impossible d'initialiser le canevas de rendu.");
      setProcessing(false);
      return;
    }

    const title = article.title;
    const category = article.category ?? "";
    const chunks: BlobPart[] = [];

    try {
      if (kind === "video") {
        const sourceEl = document.createElement("video");
        sourceEl.src = URL.createObjectURL(file);
        sourceEl.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          sourceEl.onloadedmetadata = resolve;
          sourceEl.onerror = resolve;
        });

        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const audioCtx = new AudioContextCtor();
        const audioSrc = audioCtx.createMediaElementSource(sourceEl);
        const audioDest = audioCtx.createMediaStreamDestination();
        audioSrc.connect(audioDest);
        audioSrc.connect(audioCtx.destination);

        const vidStream = canvas.captureStream(30);
        const combined = new MediaStream([
          ...vidStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks(),
        ]);

        const recorder = new MediaRecorder(combined, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            audioCtx.close();
            resolve();
          };
        });

        await sourceEl.play();
        recorder.start(100);

        function brandFrame() {
          if (sourceEl.ended) {
            recorder.stop();
            return;
          }
          ctx!.drawImage(sourceEl, 0, 0, W, H);
          drawBrandOverlay({
            ctx: ctx!,
            width: W,
            height: H,
            format,
            title,
            category,
            t: Math.min(sourceEl.currentTime / (sourceEl.duration || 1), 1),
            elapsedMs: sourceEl.currentTime * 1000,
          });
          requestAnimationFrame(brandFrame);
        }
        requestAnimationFrame(brandFrame);

        await stopped;
      } else {
        // Audio seul : image de couverture en fond + visualiseur de
        // fréquences + overlay MAHU par-dessus.
        const bgImg = new Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.src = article.cover_image_url || "";
        await new Promise((resolve) => {
          bgImg.onload = resolve;
          bgImg.onerror = resolve;
        });

        const audioCtx = new AudioContext();
        const arrayBuf = await file.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        const src = audioCtx.createBufferSource();
        src.buffer = audioBuf;
        const dest = audioCtx.createMediaStreamDestination();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        src.connect(analyser);
        analyser.connect(dest);
        src.connect(audioCtx.destination);

        const vidStream = canvas.captureStream(30);
        const combined = new MediaStream([
          ...vidStream.getTracks(),
          ...dest.stream.getTracks(),
        ]);
        const recorder = new MediaRecorder(combined, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const startMs = performance.now();
        const durMs = audioBuf.duration * 1000;

        src.start();
        recorder.start(100);

        function audioFrame(ts: number) {
          const elapsed = ts - startMs;
          if (elapsed >= durMs + 500) {
            recorder.stop();
            src.stop();
            audioCtx.close();
            return;
          }
          analyser.getByteFrequencyData(freqData);

          ctx!.drawImage(bgImg, 0, 0, W, H);
          ctx!.fillStyle = "rgba(0,0,0,0.55)";
          ctx!.fillRect(0, 0, W, H);

          const barW = W / freqData.length;
          const baseY = H * 0.72;
          ctx!.fillStyle = "rgba(227,27,35,0.85)";
          freqData.forEach((v, i) => {
            const bh = (v / 255) * H * 0.25;
            ctx!.fillRect(i * barW, baseY - bh, barW - 1, bh);
            ctx!.fillRect(i * barW, baseY, barW - 1, bh * 0.4);
          });

          drawBrandOverlay({
            ctx: ctx!,
            width: W,
            height: H,
            format,
            title,
            category,
            t: Math.min(elapsed / durMs, 1),
            elapsedMs: elapsed,
          });
          requestAnimationFrame(audioFrame);
        }
        requestAnimationFrame(audioFrame);

        await stopped;
      }

      const blob = new Blob(chunks, { type: "video/webm" });
      setResultUrl(URL.createObjectURL(blob));
    } catch {
      setError("Impossible d'appliquer le branding à ce fichier.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]">
        Importer un fichier et appliquer le branding MAHU
      </h3>

      <label className="mb-4 flex h-24 cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border-color)] text-sm text-[var(--text-muted)] hover:border-[var(--accent-red)]">
        {file ? file.name : "Choisir une vidéo ou un fichier audio"}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          onChange={handleFileChange}
          disabled={processing}
          className="hidden"
        />
      </label>

      {previewUrl && kind === "video" ? (
        <video
          src={previewUrl}
          controls
          className="mb-4 max-h-[240px] w-full rounded bg-black"
        />
      ) : null}
      {previewUrl && kind === "audio" ? (
        <audio src={previewUrl} controls className="mb-4 w-full" />
      ) : null}

      {file ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            {Object.entries(VIDEO_FORMATS).map(([key, f]) => (
              <button
                key={key}
                onClick={() => setFormat(key as VideoFormat)}
                disabled={processing}
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
            onClick={brand}
            disabled={processing}
            className="mb-4 rounded bg-[var(--accent-red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {processing ? "Application du branding..." : "Appliquer le branding MAHU"}
          </button>
        </>
      ) : null}

      {error ? (
        <p className="mb-4 rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--text-main)]">
          {error}
        </p>
      ) : null}

      {resultUrl ? (
        <div>
          <video
            src={resultUrl}
            controls
            playsInline
            className="max-h-[360px] w-full rounded bg-black"
          />
          <a
            href={resultUrl}
            download={`mahu_${article.slug}_brande.webm`}
            className="mt-3 inline-block rounded bg-[var(--accent-red)] px-3 py-2 text-xs font-semibold text-white"
          >
            ⬇ Télécharger
          </a>
        </div>
      ) : null}
    </div>
  );
}
