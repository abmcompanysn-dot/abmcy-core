import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SuspendedNotice } from "@/components/SuspendedNotice";
import { isTenantActive } from "@/lib/api";

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nathan — Produits numériques",
  description:
    "Ebooks, templates et fichiers numériques prêts à télécharger, payables en Wave, Orange Money, MTN MoMo ou carte.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const active = await isTenantActive();

  return (
    <html
      lang="fr"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {active ? (
          <>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </>
        ) : (
          <SuspendedNotice />
        )}
      </body>
    </html>
  );
}
