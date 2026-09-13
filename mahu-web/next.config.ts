import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.abmcy.com",
      },
      {
        // Domaine R2 public réellement configuré pour ce déploiement
        // (R2_PUBLIC_URL) — les deux tenants n'utilisent pas forcément le
        // même hostname, donc les deux restent autorisés.
        protocol: "https",
        hostname: "abmcy.mahu.cards",
      },
      {
        // Bibliothèque d'images de secours (components/admin/
        // ImageLibraryPicker.tsx) — un article peut finir avec une image
        // Unsplash comme cover_image_url, affichée ensuite via next/image.
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
