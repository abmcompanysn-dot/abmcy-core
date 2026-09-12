import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "MAHU | L'Excellence de l'Information Africaine",
  description:
    "MAHU — L'information africaine de référence. Actualités, analyses et dossiers de toute l'Afrique et du monde.",
};

// Applique le thème stocké AVANT le premier rendu React pour éviter un
// flash de thème par défaut (dark) chez un visiteur ayant choisi le clair.
const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem('mahu-theme');
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${playfair.variable}`}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
