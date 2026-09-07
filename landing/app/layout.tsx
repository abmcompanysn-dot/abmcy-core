import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://core.abmcy.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ABMCY Core — La plateforme multi-tenant pour digitaliser votre commerce",
  description:
    "ABMCY Core connecte commandes, paiements mobile money, photos produits et notifications dans une seule plateforme, pensée pour les commerçants et artisans ouest-africains.",
  keywords: [
    "ABMCY",
    "multi-tenant",
    "SaaS",
    "Sénégal",
    "commerce",
    "artisan",
    "couture sur-mesure",
    "mobile money",
    "CinetPay",
  ],
  openGraph: {
    title: "ABMCY Core — La plateforme multi-tenant pour digitaliser votre commerce",
    description:
      "Commandes, paiements mobile money, photos produits et notifications : tout ce qu'il faut pour digitaliser un commerce, dans une seule plateforme.",
    url: siteUrl,
    siteName: "ABMCY Core",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
