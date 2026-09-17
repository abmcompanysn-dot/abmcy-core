import { MobileHome } from "@/components/MobileHome";
import { OrdersPageContent } from "@/components/OrdersPageContent";

export default function HomePage() {
  return (
    <div>
      {/* Accueil mobile : hub avec accès rapide, remplace la vue Commandes
          directe sur petit écran ("Commandes" du hub mène à /commandes,
          la version mobile dédiée). Le desktop garde le comportement
          existant : Commandes affichées directement sur "/". */}
      <MobileHome />

      <div className="hidden md:block">
        <OrdersPageContent variant="desktop" />
      </div>
    </div>
  );
}
