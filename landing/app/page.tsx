import { ArchitectureAnimation } from "@/components/ArchitectureAnimation";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />

        <section id="architecture" className="py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Une architecture pensée pour le multi-tenant
              </h2>
              <p className="mt-4 text-balance text-lg text-slate-600">
                Vos dashboards s&apos;appuient sur un backend unique, qui
                orchestre en toute sécurité la base de données, le stockage
                des photos, les emails et les paiements.
              </p>
            </div>

            <div className="mt-16">
              <ArchitectureAnimation />
            </div>
          </div>
        </section>

        <Features />
      </main>
      <Footer />
    </>
  );
}
