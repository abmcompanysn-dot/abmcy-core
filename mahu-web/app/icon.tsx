import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Favicon généré — juste l'icône "signal de diffusion" (voir
 * components/Logo.tsx), sans le wordmark : à cette taille, seul le
 * médaillon reste lisible. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 40 40">
          <circle cx="20" cy="28" r="4" fill="#e31b23" />
          <path
            d="M11 22a12 12 0 0 1 18 0"
            stroke="#e31b23"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M5 16a20 20 0 0 1 30 0"
            stroke="#e31b23"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
